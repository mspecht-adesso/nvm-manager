# nvm Manager – Frontend (Angular)

Angular 21 Single-Page-Application für den **nvm Manager** – ein lokales Web-Tool zur Verwaltung von Node.js-Versionen via [nvm](https://github.com/nvm-sh/nvm).

## Voraussetzungen

- Node.js ≥ 18
- Das Backend (`apps/api`) muss laufen – Anfragen an `/api` werden per Proxy an `http://127.0.0.1:3789` weitergeleitet.

## Entwicklungsserver starten

**Empfohlen: Frontend und Backend zusammen starten (aus dem Projekt-Root)**

```bash
npm run dev
```

Oder nur das Frontend (aus dem Projekt-Root):

```bash
npm run dev:web
```

Die App ist dann unter [http://localhost:4200](http://localhost:4200) erreichbar und lädt bei Dateiänderungen automatisch neu.

## Proxy-Konfiguration

`proxy.conf.json` leitet alle Anfragen an `/api/*` an das Backend (`http://127.0.0.1:3789`) weiter. Das Frontend kommuniziert daher ausschließlich über relative URLs (`/api/status`, `/api/versions/...`).

## Projektstruktur

```
src/app/
├── app.ts              # Root-Komponente (standalone, Signals-basiert)
├── app.html            # Template
├── app.scss            # Styles
├── models/
│   └── nvm.models.ts   # TypeScript-Typen (NvmStatus, InstalledNodeVersion, NvmAlias, …)
└── services/
    └── nvm-api.service.ts  # HttpClient-Service für alle API-Aufrufe
```

## Build

```bash
ng build
```

Die Build-Artefakte werden im `dist/`-Verzeichnis abgelegt. Der Produktions-Build ist für Performance optimiert.

## Unit-Tests

Tests werden mit [Vitest](https://vitest.dev/) ausgeführt:

```bash
ng test
```

## Code-Scaffolding

```bash
ng generate component component-name
ng generate --help
```

## Weitere Ressourcen

- [Angular CLI Dokumentation](https://angular.dev/tools/cli)
- [nvm-manager Benutzerhandbuch](../../docs/BENUTZERHANDBUCH.md)
- Backend-API: `http://127.0.0.1:3789/api/status`
