# Angular 21 Best-Practice Findings – Teil 2

> Folge-Review vom 03.06.2026 · Angular 21.2 · `apps/web/`
> Aufbauend auf dem abgeschlossenen `sonnet-findings-01.md`.

---

## Legende

- `[ ]` – offen · `[x]` – erledigt
- Aufwand: **XS** < **S** < **M** < **L** < **XL**
- Impact: **Low** · **Medium** · **High**

---

## Ausgangslage

Nach Teil 1 ist das Frontend bereits: standalone, signals-first (`input()`/`output()`),
durchgängig `OnPush`, zoneless, mit ausgelagertem `NvmStateService` und neuem Control-Flow
(`@if`/`@for` mit `track`). Dieser Plan schließt die verbleibenden Lücken zu einem
„rundum modernen" Angular-21-Setup.

---

## Tier 1 – Echte Lücken

### Schritt 1 – ESLint + angular-eslint (Flat Config)

**Aufwand:** M · **Impact:** High

Aktuell existiert **keinerlei** Linting (kein Config-File, kein `lint`-Script) — obwohl
ein `lint-reminder.sh`-Hook vorhanden ist.

- [x] `eslint`, `typescript-eslint`, `angular-eslint` in `apps/web` installiert
- [x] `apps/web/eslint.config.mjs` (Flat Config) mit TS- + Template-Regeln angelegt
- [x] Prefix-Regel `app` (kebab-case Komponenten, camelCase Direktiven), `tsRecommended` + `templateRecommended` + `templateAccessibility`, zusätzlich `prefer-standalone` + `prefer-on-push-component-change-detection`
- [x] `lint` + `lint:fix` in `apps/web/package.json`
- [x] Root-`package.json`: `lint` + `lint:web`
- [x] Lint-Fehler behoben (OnPush an Test-Host-Komponente, ungenutzte Konstante entfernt) → 0 Fehler

### Schritt 2 – Datenabruf auf `httpResource()` umstellen

**Aufwand:** L · **Impact:** High

Read-Endpoints nutzten manuelles `subscribe()` mit handgepflegten `loading`/`error`-Signals.
Umgestellt auf **`rxResource()`** (aus `@angular/core/rxjs-interop`) — deklarativ, signal-basiert,
und behält `NvmApiService` als `stream`-Loader (Service-Schicht + Error-Handling bleiben intakt).

Betroffen (nur **GET**-Reads — Mutationen bleiben imperativ):

- [x] `status-card`: `getStatus()` → `rxResource`; Fehler über `statusError`-Computed im Template
- [x] `remote-versions-card`: `getRemoteVersions()` → `rxResource` (lazy via `shouldLoad`-Trigger-Param)
- [x] `nvm-state.service`: `getInstalledVersions()` → `rxResource` mit `.reload()` nach Mutationen; `installedVersions`/`installedRaw` als `computed`; Auto-Load ersetzt `App.ngOnInit`
- [x] `aliases-card`: `getAliases()` → `rxResource` mit reaktivem `refreshTrigger` als `params` (ersetzt zugleich den `effect`)
- [x] Wichtig: `resource.value()` wirft im Fehlerzustand → alle Value-Zugriffe mit `hasValue()` abgesichert
- [x] Fehler-Weiterleitung via `effect(() => resource.error())` → `logged`/`addLog`
- [x] Tests angepasst (async `flush()` über `ApplicationRef.whenStable()`), 185 Tests grün

> Hinweis: `install`/`use`/`uninstall`/`setAlias`/`updateNvm` sind befehlsartige POSTs/DELETEs
> und bleiben als imperative Calls (kein Resource-Use-Case).
>
> Designentscheidung: `rxResource` (experimental) statt `httpResource` (stabil) gewählt,
> um die `NvmApiService`-Abstraktion + zentrale Error-Normalisierung zu erhalten.

---

## Tier 2 – Idiomatische Feinheiten

### Schritt 3 – `action-card`: `effect()` → `linkedSignal()`

**Aufwand:** S · **Impact:** Medium

Der `prefillVersion`-`effect()` schreibt in das lokale `versionInput`. Genau dieses
„abgeleiteter, aber überschreibbarer Zustand"-Muster ist der Anwendungsfall für `linkedSignal()`.

- [x] `versionInput` von Plain-Property auf `linkedSignal` umgestellt (Quelle: `prefillVersion`, Fallback `previous?.value || '22'`)
- [x] Template auf `[ngModel]="versionInput()"` + `(ngModelChange)="versionInput.set($event)"` umgestellt
- [x] `effect()` + Konstruktor entfernt
- [x] Tests angepasst (Signal-Zugriff `()`/`.set()`), inkl. neuem Test „manuelle Eingabe bleibt erhalten"

> Der `refreshTrigger`-`effect()` in `aliases-card` bleibt — er löst einen Reload aus
> (legitimer Seiteneffekt) und wird ggf. durch Schritt 2 (reaktiver httpResource) abgelöst.

### Schritt 4 – Zentrales Error-Handling

**Aufwand:** M · **Impact:** Medium

- [x] Funktionaler `httpErrorInterceptor` (`core/http-error.interceptor.ts`) — normalisiert `HttpErrorResponse` → `Error` mit API-`{error}`-Body oder Transport-Message
- [x] `GlobalErrorHandler` (`core/global-error-handler.ts`) als `ErrorHandler` registriert (Safety-Net + zentrales Logging)
- [x] `provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor]))` + `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` in `app.config.ts`
- [x] Dedizierte Specs für Interceptor und ErrorHandler angelegt

### Schritt 5 – `handleError`-Methodenreferenz absichern

**Aufwand:** XS · **Impact:** Low

In `nvm-api.service.ts` wurde `catchError(this.handleError)` als Methodenreferenz übergeben.
Funktionierte nur, weil `this` nicht genutzt wurde — fragil.

- [x] Gelöst durch Schritt 4: `handleError` + alle `catchError`-Pipes komplett entfernt, die
  Normalisierung übernimmt jetzt der zentrale `httpErrorInterceptor`. Der Service besteht nur
  noch aus schlanken HTTP-Aufrufen.

---

## Tier 3 – Optional / Qualität

### Schritt 6 – Accessibility

**Aufwand:** M · **Impact:** Medium

- [x] `install-modal`: Fokus-Management — `viewChild`-basierter Fokus auf den Schließen-Button (bzw. Dialog) beim Öffnen via `effect()`, Fokus-Wiederherstellung auf das vorher fokussierte Element beim Schließen
- [x] `install-modal`: `Escape` schließt (Host-Listener `(document:keydown.escape)`), aber **nicht** während `phase === 'running'` (bewusst nicht-dismissbar)
- [x] `log-card`: `role="log"` + `aria-live="polite"` + `aria-relevant="additions"` für neue Log-Einträge
- [x] `aliases-card` Inline-Confirm: `role="alert"` am Bestätigungs-Prompt (Screenreader-Ansage); Buttons sind nativ keyboard-bedienbar
- [x] `role="dialog"` / `aria-modal` am Modal vorhanden + `aria-labelledby="modal-title"` (Titel-IDs ergänzt), `tabindex="-1"` für Fokussierbarkeit
- [x] Tests: Escape-Verhalten (Fehler/running/geschlossen), aria-Attribute und Fokus auf Schließen-Button — 200 Tests grün, Lint sauber

---

## Fortschrittsübersicht

| Schritt | Beschreibung | Tier | Aufwand | Status |
|---------|-------------|------|---------|--------|
| 1 | ESLint + angular-eslint | 1 | M | erledigt |
| 2 | rxResource() Migration | 1 | L | erledigt |
| 3 | linkedSignal() action-card | 2 | S | erledigt |
| 4 | Error-Interceptor + ErrorHandler | 2 | M | erledigt |
| 5 | handleError absichern | 2 | XS | erledigt (via Schritt 4) |
| 6 | Accessibility | 3 | M | erledigt |
