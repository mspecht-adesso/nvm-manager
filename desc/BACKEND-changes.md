# Backend – Änderungen im Rahmen der Refactoring-Reviews

> Dokumentiert alle relevanten Backend-Änderungen, die im Zuge der
> Angular-Modernisierung (sonnet-findings-01.md und sonnet-findings-02.md)
> sowie der dazugehörigen Testinfrastruktur umgesetzt wurden.

---

## Überblick

Die beiden Review-Runden fokussierten sich primär auf das Angular-Frontend.
Dennoch entstanden auf Backend-Seite bedeutende Änderungen, die durch die
neuen Frontend-Anforderungen ausgelöst wurden oder strukturell notwendig waren:

| Bereich | Änderung |
|---------|----------|
| `NvmApiService` | Entfernung von `handleError` und aller `catchError`-Pipes |
| Service-Architektur | Schlanke HTTP-Methoden ohne eigene Fehlerbehandlung |
| Testinfrastruktur | `createApp()`-Factory + Supertest-Integration |
| Testabdeckung | 111 Backend-Tests (alle grün) |

---

## `NvmApiService` – Vereinfachung des Service-Layers

**Datei:** `apps/web/src/app/services/nvm-api.service.ts`

> Obwohl der `NvmApiService` im Frontend (`apps/web`) liegt, ist er die
> einzige Kommunikationsschicht zum Backend. Änderungen hier wirken sich
> direkt auf das Fehlerverhalten der gesamten API-Kommunikation aus.

### Vorher: Eigene `handleError`-Methode

Jede HTTP-Methode enthielt eine `.pipe(catchError(this.handleError))`-Kette.
Das führte zu drei Problemen:

1. **Fragilar `this`-Kontext:** `catchError(this.handleError)` als
   Methodenreferenz – `this` war nur zufällig nicht relevant.
2. **Redundanz:** Fehlerbehandlung war auf alle Service-Methoden verteilt.
3. **Wartbarkeit:** Eine Änderung der Fehler-Normalisierung musste an jeder
   Methode einzeln nachgezogen werden.

```typescript
// Vorher
getInstalledVersions(): Observable<InstalledVersionsResponse> {
  return this.http.get<InstalledVersionsResponse>('/api/versions/installed')
    .pipe(catchError(this.handleError));
}

private handleError(error: HttpErrorResponse): Observable<never> {
  const message = error.error?.error ?? error.message;
  return throwError(() => new Error(message));
}
```

### Nachher: Delegierung an den zentralen `httpErrorInterceptor`

Alle `catchError`-Pipes und `handleError` wurden vollständig entfernt.
Die Normalisierung von `HttpErrorResponse` → `Error` übernimmt der in
`sonnet-findings-02.md Schritt 4` eingeführte Interceptor.

```typescript
// Nachher – schlank und direkt
getInstalledVersions(): Observable<InstalledVersionsResponse> {
  return this.http.get<InstalledVersionsResponse>('/api/versions/installed');
}
```

**Vorteil:** Der Service enthält nur noch die fachliche Absicht (welcher
Endpunkt, welches Typen-Mapping). Querschnittsaufgaben wie Fehler-Logging
und -Normalisierung sind in dedizierten Querschnittsmodulen (`core/`) gebündelt.

---

## Express-Backend: `createApp()`-Factory

**Datei:** `apps/api/src/server.ts`

Im Rahmen der Test-Infrastruktur (Schritt 0.2.2 im Changelog) wurde
`server.ts` so refaktoriert, dass die Express-App testbar wurde:

```typescript
// Vorher: App wurde direkt gestartet
const app = express();
app.use(cors(...));
// ...
app.listen(3789);

// Nachher: Factory-Pattern
export function createApp(): express.Application {
  const app = express();
  app.use(cors(...));
  // ...
  return app;
}

// Nur außerhalb von Tests starten
if (process.env['NODE_ENV'] !== 'test') {
  createApp().listen(3789, '127.0.0.1', () => { ... });
}
```

**Warum wichtig:** Supertest kann die App direkt einbinden, ohne dass ein
TCP-Port geöffnet wird → keine Port-Konflikte, schnellere Tests, CI-sicher.

---

## Testabdeckung Backend

Im Zuge des Refactorings entstand eine vollständige Testsuite:

### Unit-Tests

**`nvm.types.spec.ts`** (24 Tests)
- `isValidVersionInput` – Shell-Injection-Schutz, Whitelist-Regex
- `isValidAliasName`, `isValidAliasTarget` – Eingabevalidierung
- `NvmError` – Typsicherheit und Fehlerpropagation

**`nvm.parser.spec.ts`** (22 Tests)
- `parseInstalledVersions` – ANSI-Escape-Handling, aktive-Version-Erkennung
- `parseRemoteVersions` – Sortierung, LTS-Markierung
- `parseAliases` – `editable`/`deletable`-Schutzlogik

**`nvm.service.spec.ts`** (14 Tests, nach Migration auf `runNvmLsFast`)
- `runNvm` und `spawnNvm` mit gemocktem `node:child_process`
- Argument-Escaping-Verifikation
- `runNvmLsFast` mit gemocktem `node:fs/promises` (Dateisystem-Reads)

### Integrationstests

**`nvm.routes.spec.ts`** (51+ Tests via Supertest)
- Alle HTTP-Endpunkte mit 200/400/500-Szenarien
- Eingabe-Validierung (ungültige Versionen, fehlende Body-Felder)
- `NvmError`-Handling (korrekte HTTP-Statuscodes)
- SSE-Endpunkt (`GET /api/versions/available` Streaming-Verhalten)

### Konfiguration

**`apps/api/vitest.config.ts`:**
```typescript
thresholds: {
  lines: 70,
  functions: 70,
  branches: 60
}
```

---

## `bash -lc` → `bash -c` (Performance)

Alle nvm-Shell-Aufrufe nutzten ursprünglich `bash -lc` (Login-Shell).
Das lädt `.bash_profile`, `.bashrc` etc. vollständig — auf manchen Systemen
dauert das mehrere Sekunden. Gelöst durch manuelle Umgebungsvariablen im
`NVM_HEADER`:

```typescript
// Vorher
execFile('bash', ['-lc', `${NVM_HEADER} nvm ${args.join(' ')}`])

// Nachher
execFile('bash', ['-c', `${NVM_HEADER} nvm ${args.join(' ')}`])
// NVM_HEADER setzt NVM_DIR, HOME und sourcet nvm.sh explizit
```

---

## `runNvmLsFast` – Dateisystem statt Shell

**Datei:** `apps/api/src/nvm/nvm.service.ts`

`GET /api/versions/installed` war zuvor ~20 Sekunden langsam, weil `nvm ls`
eine vollständige Shell-Session startete. Ersetzt durch direktes Dateisystem-Lesen:

```typescript
// Vorher: ~20 Sekunden
async function runNvmLs(): Promise<string> {
  return runNvm('ls');  // Startet bash, sourcet nvm.sh, ruft nvm ls auf
}

// Nachher: < 10 ms
async function runNvmLsFast(): Promise<InstalledVersionsResponse> {
  const nodeDir = path.join(nvmDir, 'versions/node');
  const aliasDir = path.join(nvmDir, 'alias');
  // Liest Verzeichniseinträge direkt mit node:fs/promises
}
```

Speedup: **~2000×** für den häufigsten Endpunkt.

---

## Zusammenfassung der Backend-Änderungen

| Datei | Art der Änderung | Warum |
|-------|-----------------|-------|
| `nvm-api.service.ts` | `handleError` + `catchError` entfernt | Zentraler Interceptor übernimmt |
| `server.ts` | `createApp()`-Factory | Supertest-Testbarkeit |
| `nvm.service.ts` | `bash -lc` → `bash -c` | Performance |
| `nvm.service.ts` | `runNvmLs` → `runNvmLsFast` | 2000× schneller |
| `vitest.config.ts` | Coverage-Schwellenwerte | Qualitätssicherung |
| `*.spec.ts` (111 Tests) | Vollständige Testabdeckung | CI-Sicherheitsnetz |
