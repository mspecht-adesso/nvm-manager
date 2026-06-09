# API – Änderungen im Rahmen der Refactoring-Reviews

> Dokumentiert alle Änderungen am API-Vertrag und an der API-Konsumierung,
> die im Rahmen der Reviews sonnet-findings-01.md und sonnet-findings-02.md
> sowie der vorbereitenden Changelog-Schritte umgesetzt wurden.

---

## Überblick

Aus den Review-Runden entstanden keine neuen REST-Endpunkte – die API-Oberfläche
blieb stabil. Die wesentlichen Änderungen betreffen die **Art und Weise, wie die
API konsumiert** wird (Frontend-seitig) und wie **Fehler durch die Schichten
fließen** (Interceptor-Muster). Hinzu kommen API-Erweiterungen aus dem Changelog,
die Grundlage für neue Frontend-Features waren.

| Bereich | Art der Änderung |
|---------|-----------------|
| Fehler-Normalisierung | `HttpErrorResponse` → `Error` via Interceptor |
| GET-Endpunkte | Konsumierung via `rxResource()` statt manuellem `subscribe()` |
| `GET /api/status` | Neues optionales Feld `nvmLatestVersion` |
| `POST /api/nvm/update` | Neuer Endpunkt: nvm selbst aktualisieren |
| `POST /api/nvm/open-dir` | Neuer Endpunkt: NVM_DIR öffnen |
| LTS-Aliases | Zwei neue Endpunkte für Dateisystem-basiertes LTS-Alias-Management |
| `POST /api/versions/stable` | Neuer Endpunkt: `stable`-Alias setzen |
| `POST /api/versions/use` | Jetzt persistent (schreibt `default`-Alias) |

---

## Fehler-Normalisierung: Einheitliches Fehlerformat

### Problem vor dem Refactoring

Vor dem Interceptor (sonnet-findings-02.md, Schritt 4) gab es keine garantierte
Einheitlichkeit: Jede `NvmApiService`-Methode wandelte `HttpErrorResponse` lokal
um. Das führte zu inkonsistentem Fehlerformat im Rest der Anwendung.

### Eingeführter `httpErrorInterceptor`

```typescript
// apps/web/src/app/core/http-error.interceptor.ts
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message = err.error?.error ?? err.message;
      return throwError(() => new Error(message));
    })
  );
```

**Verarbeitungsreihenfolge:**

```
HTTP Response (4xx/5xx)
        ↓
HttpErrorResponse (Angular)
        ↓
httpErrorInterceptor
        ↓
Error({ message: api_body.error ?? transport_message })
        ↓
rxResource.error() / catchError in Service
        ↓
Anzeige im Log-Panel / Template
```

Das Backend-Fehlerformat `{ "error": "Fehlermeldung" }` wird durch den
Interceptor direkt extrahiert. Die Applikation arbeitet mit einfachen
`Error`-Objekten, nie mit `HttpErrorResponse`.

---

## GET-Endpunkte: Von `subscribe()` zu `rxResource()`

### Betroffen

| Endpunkt | Konsumiert von | Vorher | Nachher |
|----------|---------------|--------|---------|
| `GET /api/status` | `StatusCardComponent` | manuelles `subscribe()` | `rxResource()` |
| `GET /api/versions/available` | `RemoteVersionsCardComponent` | manuelles `subscribe()` | `rxResource()` |
| `GET /api/versions/installed` | `NvmStateService` | manuelles `subscribe()` | `rxResource()` |
| `GET /api/versions/aliases` | `AliasesCardComponent` | manuelles `subscribe()` | `rxResource()` |

### Warum diese Trennung?

`rxResource()` eignet sich für **idempotente Leseoperationen** (GET), die:
- einen klar definierten Lade-/Fehler-/Erfolgszustand haben
- reaktiv neu geladen werden müssen (z.B. nach Mutationen)
- deklarativ im Template nutzbar sein sollen (`resource.isLoading()`, `resource.value()`)

**Mutationen** (`POST /api/versions/install`, `DELETE`, etc.) bleiben
**imperativ**: Sie haben Seiteneffekte, sind nicht idempotent und ihr Ergebnis
ist die Auslösung eines Reloads, keine Darstellung eigener Daten.

### `rxResource()` statt `httpResource()`

Angular 21 bietet `httpResource()` (stabil) und `rxResource()` (experimental).
Wir nutzen `rxResource()`, weil:
- `NvmApiService` als Service-Schicht erhalten bleiben soll
- Zentrale Error-Normalisierung via Interceptor erhalten bleiben soll
- `httpResource()` direkt URL-Parameter erwartet, nicht Observable-Loader

```typescript
// Implementierungsbeispiel (nvm-state.service.ts)
private readonly installedResource = rxResource({
  loader: () => this.api.getInstalledVersions()
});

readonly installedVersions = computed(
  () => this.installedResource.hasValue()
    ? this.installedResource.value()!.versions
    : []
);

// Nach einer Mutation:
this.installedResource.reload();
```

---

## Neue API-Endpunkte (Changelog-Kontext)

Diese Endpunkte wurden im Rahmen des Feature-Developments eingeführt und
durch die Refactoring-Reviews dann korrekt in `rxResource()` bzw. imperative
Calls eingeordnet.

### `GET /api/status` – Erweiterung

```json
// Vorher
{
  "nvmAvailable": true,
  "nvmVersion": "0.39.7",
  "nodeVersion": "v22.3.0"
}

// Nachher (nvmLatestVersion optional)
{
  "nvmAvailable": true,
  "nvmVersion": "0.39.7",
  "nodeVersion": "v22.3.0",
  "nvmLatestVersion": "v0.40.1"
}
```

`nvmLatestVersion` wird nur geliefert, wenn die GitHub-Releases-API erreichbar
ist (5 s Timeout). Das Frontend zeigt bei Unterschied einen „Aktualisieren"-Button.

---

### `POST /api/nvm/update` – neu

Löst ein nvm-Update via `git fetch --tags && git checkout <version>` im
`NVM_DIR` aus. Nutzt SSE-Streaming (gleiche Mechanik wie `POST /api/versions/install`).

**Request:**
```json
{ "targetVersion": "v0.40.1" }
```

**Response:** SSE-Stream mit `progress`-Events, abschließend `complete` oder `error`.

---

### `POST /api/nvm/open-dir` – neu

Öffnet `NVM_DIR` im Dateimanager (`open` auf macOS, `xdg-open` auf Linux).
Kein User-Input – der Pfad kommt aus der Server-Konfiguration.

**Request:** kein Body erforderlich

**Response (200):**
```json
{ "opened": true }
```

**Sicherheitshinweis:** Kein User-Input bedeutet kein Injection-Risiko.
Der Pfad ist serverseitig fest.

---

### `POST /api/versions/aliases/lts` und `DELETE /api/versions/aliases/lts/:codename` – neu

nvm unterstützt `nvm alias lts/<codename>` nicht nativ. Die neuen Endpunkte
schreiben/löschen Alias-Dateien direkt im Dateisystem (`~/.nvm/alias/lts/`).

**POST Request:**
```json
{ "codename": "iron", "version": "20.12.2" }
```

**Validierung:** `isValidLtsCodename` – Whitelist-Regex `^[a-z]+$`.

---

### `POST /api/versions/stable` – neu

Setzt den `stable`-Alias auf eine beliebige Version oder LTS-Linie.

**Request:**
```json
{ "version": "22.3.0" }
```

---

### `POST /api/versions/use` – Verhalten geändert

Vorher: Temporäres `nvm use X` (nur in der Child-Prozess-Session wirksam).
Nachher: Permanent via `nvm alias default X`, sodass auch zukünftige Shells die
gewählte Version verwenden.

---

## Eingabevalidierung: Whitelist-Strategie

Alle Endpunkte, die Versions- oder Alias-Namen entgegennehmen, validieren
diese **vor** der Shell-Übergabe:

| Funktion | Regex / Logik |
|----------|---------------|
| `isValidVersionInput` | `/^(\d+\.\d+\.\d+\|lts\/[a-z]+\|[a-z]+\|\d+)$/` |
| `isValidAliasName` | `/^[\w.\-/]+$/` |
| `isValidAliasTarget` | Wie `isValidVersionInput` |
| `isValidLtsCodename` | `/^[a-z]+$/` |

Bei Verletzung: HTTP 400 `{ "error": "Invalid ..." }` — keine Shell-Ausführung.

---

## Auswirkungen der Refactorings auf den API-Vertrag

| Aspekt | Vor den Reviews | Nach den Reviews |
|--------|----------------|-----------------|
| Fehlerformat (Frontend) | `HttpErrorResponse` oder `Error` | immer `Error` |
| Ladestate (GET) | Signal `loading = signal(false)` | `resource.isLoading()` |
| Fehlerstate (GET) | Signal `error = signal(null)` | `resource.error()` |
| Reload nach Mutation | manuelle Methode `loadXyz()` | `resource.reload()` |
| Service-Methoden | HTTP-Call + `catchError` | reiner HTTP-Call |
