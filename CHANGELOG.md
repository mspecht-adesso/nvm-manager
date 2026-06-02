# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [Unreleased]

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

[Unreleased]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mspecht-adesso/nvm-manager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mspecht-adesso/nvm-manager/releases/tag/v0.1.0
