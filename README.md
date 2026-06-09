# nvm Manager

Lokales Web-Tool zum Verwalten von Node-Versionen über nvm.

## Voraussetzungen

- macOS oder Linux
- [nvm](https://github.com/nvm-sh/nvm) installiert
- Node.js ≥ 18 installiert
- npm installiert

## Installation

```bash
npm run install:all
```

Oder manuell:

```bash
npm install
npm --prefix apps/api install
npm --prefix apps/web install
npm --prefix apps/e2e install
```

Beim Installieren der E2E-Abhängigkeiten lädt ein `postinstall`-Hook automatisch den
benötigten Chromium-Browser für Playwright herunter. Manuell nachholen lässt sich das
jederzeit mit:

```bash
npm run install:browsers
```

## Start

```bash
npm run dev
```

Startet Frontend und Backend parallel:

| App      | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:4201        |
| API      | http://127.0.0.1:3789        |

### Einzeln starten

```bash
npm run dev:api   # nur Express API
npm run dev:web   # nur Angular Frontend
```

## Funktionen

- **Installierte Versionen** anzeigen (mit Tabelle und Rohdaten)
- **Remote LTS-Versionen** laden und anzeigen
- **Version installieren** – validierter POST an die API
- **Version verwenden** – `nvm use` in der Backend-Session
- **Default-Version setzen** – `nvm alias default`
- **Version deinstallieren** – mit Bestätigungsdialog

## Sicherheit

- Das Backend bindet **ausschließlich an `127.0.0.1`** – kein externer Zugriff.
- Es werden nur **fest definierte nvm-Kommandos** ausgeführt (keine freie Shell-Ausführung).
- Versionseingaben werden streng per Regex validiert: `node`, `stable`, `lts/*`, oder Semver (`22`, `22.11`, `22.11.0`).
- Ungültige Eingaben werden mit HTTP 400 abgelehnt.

## Hinweis zu `nvm use`

`nvm use` gilt nur für die **Shell-Session des Backend-Prozesses** und verändert nicht bereits geöffnete Terminals.  
Für neue Terminals sollte die **Default-Version** gesetzt werden (`nvm alias default`).

## Tests

```bash
npm test            # Unit-Tests (API + Web)
npm run test:api    # nur Express-API (Vitest)
npm run test:web    # nur Angular-Frontend
npm run test:e2e    # Klick-E2E-Tests (Playwright, Chromium, headless)
```

Die E2E-Tests mocken die `/api/**`-Schicht und führen **keine** echten nvm-Operationen aus.
Der benötigte Chromium-Browser wird über `npm run install:all` (bzw. `npm run install:browsers`)
bereitgestellt.

### E2E-Tests im Browser optisch nachvollziehen

```bash
npm run test:e2e:headed   # Chromium sichtbar, verlangsamt (SlowMo) – live mitschauen
npm run test:e2e:ui       # Playwright UI-Modus: Watch, Time-Travel, einzelne Tests
npm run test:e2e:report   # HTML-Report des letzten Laufs (inkl. Video & Trace) öffnen
```

- **`test:e2e:headed`** öffnet ein echtes Chromium-Fenster und führt jeden Klick verlangsamt
  aus (`PW_SLOWMO=400` ms), sodass die Flows mit dem Auge verfolgbar sind. Tempo anpassbar,
  z. B. `PW_SLOWMO=800 npm run test:e2e:headed`.
- **`test:e2e:ui`** ist die komfortabelste Variante: Tests einzeln starten, jeden Schritt im
  DOM-Snapshot zurückspulen und bei Änderungen automatisch neu ausführen.
- Im Headed-Modus werden **Video + Trace** je Test aufgezeichnet; `test:e2e:report` öffnet den
  Report zum Nachspielen. (Im normalen `test:e2e`-Lauf nur bei Fehlern – schlank für CI.)

## Projektstruktur

```
nvm-manager/
├── apps/
│   ├── web/          # Angular 21 Frontend (Standalone, Signals)
│   ├── api/          # Express Backend (TypeScript, tsx)
│   └── e2e/          # Playwright Klick-E2E-Tests (Chromium)
├── package.json      # Root Scripts (concurrently)
└── README.md
```

## Entwicklung

Das Angular-Frontend nutzt einen **Dev-Proxy** (`apps/web/proxy.conf.json`), der `/api`-Requests an `http://127.0.0.1:3789` weiterleitet.

Für Live-Output bei langen Installationen ist ein SSE-Endpoint unter  
`GET /api/versions/install/stream?version=<version>` vorbereitet.
