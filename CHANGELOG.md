# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [Unreleased]

---

## [0.4.0] – 2026-06-03

### Hinzugefügt

- **„Deinstallieren"-Button in der Versions-Liste** – jede Zeile der Card „Installierte Versionen" enthält jetzt einen roten „Deinstallieren"-Button direkt neben „Verwenden"
  - Deaktiviert für die aktuell **aktive** Version (Tooltip erklärt den Grund)
  - Deaktiviert für System-Node (`v.system`)
  - Deaktiviert während einer laufenden Aktion (`isLoading`)
  - Bestätigungsdialog vor der Ausführung (`confirm()`)
  - Nach erfolgreicher Deinstallation wird die Versions-Liste automatisch aktualisiert
  - Fehler werden im Log-Panel angezeigt

### Geändert

- `InstalledVersionsCardComponent` – neuer `@Output() uninstallVersion: EventEmitter<string>`; Aktions-Spalte nutzt jetzt `.td-actions` (Flexbox mit `gap`) für einheitlichen Button-Abstand
- `app.html` – `(uninstallVersion)="onUninstall($event)"` verbindet den neuen Output mit der bereits vorhandenen `onUninstall()`-Methode der Root-Komponente

---

## [0.3.0] – 2026-06-03

### Hinzugefügt

- **LTS-Alias-Verwaltung** – Vollständiges CRUD für `lts/`-Aliases über einen dedizierten Backend-Endpunkt, da `nvm alias lts/<codename>` von nvm selbst nicht unterstützt wird:
  - `POST /api/versions/aliases/lts` – schreibt Alias-Datei direkt in `~/.nvm/alias/lts/<codename>`
  - `DELETE /api/versions/aliases/lts/:codename` – löscht die Alias-Datei direkt
  - `isValidLtsCodename` als neuer Whitelist-Validator in `nvm.types.ts`
  - `setLtsAliasFile()` und `deleteLtsAliasFile()` als neue Service-Funktionen in `nvm.service.ts`

- **`POST /api/versions/stable`** – neuer Endpunkt zum Setzen des `stable`-Alias auf eine beliebige Version oder LTS-Linie

- **LTS-Alias-Buttons im Frontend** – für jeden `lts/*`-Eintrag in der Aliases-Card:
  - **Bearbeiten** öffnet Dropdown mit nur den kompatiblen Major-Versionen (z.B. nur 22.x für `lts/krypton`)
  - **Default** setzt `nvm alias default lts/<codename>`
  - **Stable** setzt `nvm alias stable lts/<codename>`
  - **Löschen** entfernt den LTS-Alias dauerhaft

- **Dropdown-Editierung für alle Aliases** – statt freiem Texteingabefeld wählt man beim Bearbeiten aus einem Dropdown der installierten Versionen (vorselektiert auf die aktuell aufgelöste Version)

- **Alias-Badges in der Versions-Liste** – die Karte „Installierte Versionen" zeigt jetzt Badges für `stable`, `unstable` und `iojs`, sofern der jeweilige nvm-Alias auf diese Version zeigt

- **Automatischer Refresh nach Alias-Änderungen** – `AliasesCardComponent` emittiert `@Output() aliasChanged` nach jeder erfolgreichen Mutation; die Root-Komponente reagiert mit `loadInstalledVersions()`, sodass Badges und Default-Markierung immer aktuell sind

### Geändert

- **`GET /api/versions/installed` 100× schneller** – `runNvmLs()` durch `runNvmLsFast()` ersetzt: liest installierte Versionen und Alias-Informationen direkt aus dem Dateisystem (`~/.nvm/versions/node/`, `~/.nvm/alias/`), ohne eine Shell zu starten (vorher ~20 s, jetzt < 10 ms)

- **`bash -lc` → `bash -c`** – Login-Shell-Flag entfernt; alle benötigten Variablen (`NVM_DIR`, `HOME`) werden im `NVM_HEADER` manuell gesetzt, was bei Systemen mit langen `.bash_profile`-Ladezeiten erhebliche Zeitersparnisse bringt

- **Alias-Schutzlogik überarbeitet**:
  - `editable: false` gilt jetzt *nur* für `lts/`-Aliases (Bearbeitung über dedizierten Endpunkt)
  - `deletable: false` gilt für `default`, `node`, `stable`, `unstable`, `iojs` – Backend blockiert Löschanfragen serverseitig mit HTTP 400
  - Alle anderen Aliases (inkl. `node`, `stable`, `unstable`, `default`) sind über den generischen `setAlias`-Endpunkt editierbar

- **`InstalledNodeVersion`-Typ** um Felder `stable`, `unstable`, `iojs` (boolean) erweitert

- **`POST /api/versions/default`** akzeptiert jetzt auch LTS-Codenames als Ziel (z.B. `lts/iron`)

- **`AliasesCardComponent`** empfängt `installedVersions` als `@Input()` von der Root-Komponente (für Dropdown-Population)

### Tests

- `nvm.service.spec.ts` – `runNvmLs`-Tests durch `runNvmLsFast`-Tests ersetzt; mockt `node:fs/promises` statt `child_process`; `-lc` → `-c` in allen Assertions
- `nvm.parser.spec.ts` – Assertions für `editable`/`deletable` an neue Schutzlogik angepasst
- `nvm.routes.spec.ts` – `runNvmLsFast`-Mock mit neuen Typ-Feldern; `schreibgeschützt`-Test durch `lts/-Alias über generischen Endpunkt`-Test ersetzt

---

## [0.2.2] – 2026-06-02

### Hinzugefügt

- **Vollständige Testabdeckung Backend** (`apps/api/src/**/*.spec.ts`) mit Vitest + Supertest
  - `nvm.parser.spec.ts` – 22 Unit-Tests für `parseInstalledVersions`, `parseRemoteVersions` und `parseAliases` inkl. ANSI-Escape, Edge Cases und Sortierung
  - `nvm.types.spec.ts` – 24 Unit-Tests für `isValidVersionInput`, `isValidAliasName`, `isValidAliasTarget` und `NvmError`; prüft Shell-Injection-Schutz und Typsicherheit
  - `nvm.service.spec.ts` – 14 Unit-Tests für `runNvm`, `runNvmLs` und `spawnNvm` mit gemocktem `node:child_process`; verifiziert Argument-Escaping
  - `nvm.routes.spec.ts` – 51 Integrationstests aller 10 HTTP-Endpunkte via Supertest (400/200/500-Codes, Validierung, `NvmError`-Handling, SSE-Endpunkt)

- **Vollständige Testabdeckung Frontend** (`apps/web/src/app/**/*.spec.ts`) mit Vitest über `@angular/build:unit-test`
  - `app.spec.ts` – vollständig neu geschrieben: Signal-Zustand, Laden bei `ngOnInit`, Log-Limit, Modal-Close, Fehlerbehandlung (ersetzt veralteten Scaffold-Test)
  - `nvm-api.service.spec.ts` – 18 Tests für alle 10 HTTP-Methoden mit `HttpClientTestingModule`; prüft URL-Encoding und `handleError`-Mapping
  - `status-card.component.spec.ts` – Ladezustand, Erfolg- und Fehlerfall
  - `installed-versions-card.component.spec.ts` – Inputs, Outputs und Defaults
  - `install-modal.component.spec.ts` – Auto-Close-Timer (Fake-Timer), `getErrorInstructions` für alle Fehlercodes
  - `action-card.component.spec.ts` – `prefillVersion`-Setter, alle vier Aktionen inkl. Trim und Leerfeld-Schutz
  - `aliases-card.component.spec.ts` – `refreshTrigger`, `startEdit`/`cancelEdit`/`saveAlias`/`createAlias`/`deleteAlias` inkl. `confirm`-Mock und Fehler-Logs
  - `remote-versions-card.component.spec.ts` – `filteredVersions` und `availableCount` Computed Signals, Suche, Größenlimits, Fehlerbehandlung
  - `log-card.component.spec.ts` – Platzhalter, Eintragsrendering, CSS-Klassen je Log-Typ
  - `app-header.component.spec.ts` – Titel, Versions-Badge (mit/ohne aktive Version)
  - `card.component.spec.ts` – ng-content Slots (`card-title`, `card-actions`, Body)
  - `loading-state.component.spec.ts` / `spinner.component.spec.ts` – Rendering der Atom-Komponenten

- **Playwright E2E-Testinfrastruktur** (`apps/e2e/`)
  - `playwright.config.ts` – Chromium, `reuseExistingServer` für API (Port 3789) und Web (Port 4201)
  - `tests/smoke.spec.ts` – Alle 8 Haupt-Cards sichtbar, App-Titel, Status-Card-Ladezustand
  - `tests/install-flow.spec.ts` – Install-/Use-Modal öffnet sich, Log-Eintrag erscheint, Versions-Input akzeptiert gültige Werte

- **Test-Infrastruktur Backend**
  - `apps/api/vitest.config.ts` mit Coverage-Schwellenwerten (≥ 70 % Lines/Functions, ≥ 60 % Branches)
  - `vitest`, `@vitest/coverage-v8`, `supertest` und `@types/supertest` als Dev-Abhängigkeiten

### Geändert

- `apps/api/src/server.ts` refaktoriert: `createApp()` wird jetzt separat exportiert; `listen()` wird nur außerhalb von `NODE_ENV=test` aufgerufen – ermöglicht Supertest-Tests ohne Port-Konflikte
- `apps/api/package.json` um Skripte `test`, `test:watch` und `test:coverage` erweitert
- `apps/e2e/package.json` erstellt mit Skripten `test`, `test:ui` und `test:headed`
- Root `package.json` um Skripte `test:api`, `test:api:coverage`, `test:web`, `test:e2e` und `test` (API + Web kombiniert) erweitert; `install:all` schließt nun auch `apps/e2e` ein

---

## [0.2.1] – 2026-06-02

### Hinzugefügt

- **Modal-Feedback für „Verwenden"** – `InstallModalComponent` zeigt jetzt auch beim Versionswechsel einen geführten Fortschritts-Dialog (laufend / Erfolg / Fehler) mit action-spezifischen Texten
- `InstallModalState` um Feld `action: 'install' | 'use'` erweitert; `phase` von `'installing'` auf `'running'` umbenannt
- `ActionCardComponent` akzeptiert `@Input() prefillVersion`: Klick auf „Verwenden" in der Versions-Liste befüllt das Eingabefeld der Aktionskarte vor

### Geändert

- **`POST /api/versions/use` ist jetzt persistent** – der Endpunkt ruft intern `nvm alias default X` auf und schreibt die Wahl dauerhaft in `~/.nvm/alias/default`; ein temporäres `nvm use` (nur für die Child-Prozess-Session) hatte keine sichtbare Wirkung
- **`GET /api/versions/installed` zeigt korrekte aktive Version** – führt `nvm use default && nvm ls` in derselben Shell aus, sodass der `->` Indikator stets mit dem `default`-Alias übereinstimmt
- `nvm.service.ts` refaktoriert: gemeinsamer `NVM_HEADER`, neue Funktion `runNvmLs()` (mit vorgelagertem `nvm use default`), `escapeArgs()`-Hilfsfunktion extrahiert
- `AliasesCardComponent` lädt Alias-Liste nach „Verwenden" und „Als Default setzen" automatisch neu (`@Input() refreshTrigger`)
- `AppComponent`: `onUseFromList` und `onSetDefault` inkrementieren `aliasesRefreshTrigger` nach erfolgreichem API-Aufruf

### Behoben

- „Verwenden"-Button in der Versions-Liste hat nun sichtbares Feedback (Modal) und aktualisiert Header sowie installierte Versionen korrekt
- Aktive Version im Header und in der Versions-Liste blieb nach einem Versionswechsel unverändert (root cause: Child-Prozess-Isolation von `nvm use`)
- `AliasesCardComponent` importierte `Input` nicht aus `@angular/core` → Build-Fehler `TS2552` behoben

---

## [0.2.0] – 2026-06-02

### Hinzugefügt

- **Atomic Design Komponentenstruktur** (`apps/web/src/app/components/`)
  - *Atoms*
    - `SpinnerComponent` – isolierter Lade-Spinner, kontextunabhängig wiederverwendbar
    - `LoadingStateComponent` – Spinner + Textmeldung als kombinierter Ladezustand (`@Input message`)
  - *Molecules*
    - `CardComponent` – wiederverwendbare Card-Hülle mit benannten `ng-content`-Slots (`[card-title]`, `[card-actions]`, Body)
  - *Organisms*
    - `AppHeaderComponent` – Header mit aktiver-Version-Badge (`@Input activeVersion`)
    - `StatusCardComponent` – selbst-contained, verwaltet eigenen API-/nvm-Status-Zustand
    - `ActionCardComponent` – Versions-Eingabe und Aktions-Buttons, reine UI-Komponente mit `@Output` für install/use/setDefault/uninstall
    - `InstalledVersionsCardComponent` – Tabelle installierter Versionen, empfängt Daten via `@Input`, emittiert useVersion/refresh
    - `AliasesCardComponent` – selbst-contained mit vollständiger Alias-CRUD-Logik und `@Output logged`
    - `RemoteVersionsCardComponent` – selbst-contained, lädt Remote-Versionen, filtert bereits installierte heraus
    - `LogCardComponent` – reine Anzeige des Aktivitäts-Logs, empfängt Einträge via `@Input log`
- `LogEvent`- und `LogEntry`-Typen in `nvm.models.ts` für typisierte Log-Kommunikation zwischen Komponenten

### Geändert

- `AppComponent` von ~295 auf ~140 Zeilen reduziert – verwaltet nur noch geteilten Zustand (`isLoading`, `installedVersions`, `installModal`, `log`) und komponiert die Organisms
- `styles.scss` enthält jetzt alle globalen Utility-Klassen (`.btn`, `.badge`, `.input`, `.spinner`, `.loading-state`, `.versions-table` u. a.) statt der `app.scss`
- `app.scss` auf reines Layout-Styling (`.main`) reduziert
- `.spinner` erhält explizites `display: block` für kontextunabhängige Darstellung (zuvor abhängig von Blockifizierung als direktes Flex-Kind)

---

## [0.1.0] – 2026-06-02

### Hinzugefügt

- **Angular Frontend** (`apps/web/`, Port 4200)
  - Hauptkomponente `AppComponent` mit Signal-basiertem State-Management
  - Anzeige installierter und verfügbarer Node.js-Versionen per nvm
  - Aktive Version hervorheben und per Klick wechseln
  - `InstallModalComponent` für eine geführte Installations-Erfahrung mit Fortschrittsanzeige
  - `NvmApiService` als typisierter HTTP-Client für alle Backend-Endpunkte
  - Datenmodelle in `nvm.models.ts` (u. a. `NvmVersion`, `InstallProgress`)
  - Proxy-Konfiguration (`proxy.conf.json`) für lokale API-Weiterleitung
  - SCSS-Styling mit modernem, dunklem UI-Theme

- **Express Backend** (`apps/api/`, Port 3789)
  - REST-Endpunkte unter `/api/`:
    - `GET /api/status` – Überprüft ob nvm verfügbar ist
    - `GET /api/versions/installed` – Listet installierte Node-Versionen
    - `GET /api/versions/available` – Listet verfügbare Node-Versionen
    - `POST /api/versions/install` – Installiert eine Node-Version (mit SSE-Streaming)
    - `DELETE /api/versions/:version` – Deinstalliert eine Version
    - `POST /api/versions/use` – Wechselt die aktive Node-Version
    - `POST /api/versions/default` – Setzt die Standard-Version
  - `NvmService` für sichere Shell-Ausführung von nvm-Kommandos via `child_process`
  - `NvmParser` zum Parsen der nvm CLI-Ausgaben in strukturierte Typen
  - Strikte Eingabevalidierung (Whitelist-Regex für Versionsnummern)
  - CORS nur für `http://localhost:4200`
  - Server bindet ausschließlich an `127.0.0.1` (kein öffentlicher Zugriff)

- **Monorepo-Struktur**
  - Root `package.json` mit `npm run dev` (startet Frontend + Backend gleichzeitig via `concurrently`)
  - `apps/web/` – Angular 17+ Standalone-Projekt
  - `apps/api/` – Node.js/Express-Projekt mit TypeScript (`tsx` für Dev)

- **Cursor AI-Konfiguration** (`.cursor/`)
  - 5 Skills: `angular-expert`, `nodejs-express-expert`, `formatting-linting-expert`, `testing-expert`, `documentation-expert`
  - 7 Rules: Projektkonventionen, Angular Standalone, Express API, Node.js/TypeScript, Testing, Formatting, nvm-Security
  - Hooks: Security-Check vor Shell-Befehlen, Lint-Reminder nach Dateiänderungen, Session-Kontext beim Start, Qualitätsprüfung bei Abschluss

- **Dokumentation**
  - `README.md` mit Projektübersicht, Setup-Anleitung und Architekturdiagramm
  - `docs/BENUTZERHANDBUCH.md` – vollständiges deutsches Benutzerhandbuch
  - `apps/web/README.md` – Frontend-spezifische Dokumentation
  - MIT `LICENSE`

### Geändert

- Verbesserte Installations-Erfahrung: `InstallModalComponent` ersetzt einfache Inline-Anzeige
- nvm-Service gibt jetzt strukturierte Fehler-Objekte zurück
- Server-Logging um Request-Zeitstempel erweitert

---

[Unreleased]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mspecht-adesso/nvm-manager/releases/tag/v0.1.0
