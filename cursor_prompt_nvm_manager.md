# CursorAI Build Prompt: Lokaler nvm Manager mit Angular + Express

## Ziel

Baue ein webbasiertes lokales Tool namens **nvm-manager**, mit dem ich meinen lokalen **nvm (Node Version Manager)** verwalten kann.

Das Tool soll lokal laufen:

- Angular Frontend auf `http://localhost:4200`
- Express Backend auf `http://127.0.0.1:3789`
- Das Backend führt kontrolliert `nvm`-Kommandos aus.
- Das Frontend zeigt installierte und verfügbare Node-Versionen an und ermöglicht Installieren, Deinstallieren, Default setzen und Verwenden einer Version.

Wichtig: Das Tool ist für den lokalen Gebrauch gedacht, nicht für Deployment auf einem öffentlichen Server.

---

## Tech Stack

Verwende:

- Angular, möglichst aktuelle Standalone-Architektur
- TypeScript
- SCSS
- Express
- Node.js
- `tsx` für das lokale Express-Development
- Keine Datenbank im MVP
- Keine Authentifizierung im MVP, aber Backend ausschließlich an `127.0.0.1` binden

---

## Projektstruktur

Erstelle eine Monorepo-ähnliche Struktur:

```txt
nvm-manager/
├─ apps/
│  ├─ web/                  # Angular Frontend
│  └─ api/                  # Express Backend
├─ package.json             # Root Scripts zum Starten beider Apps
├─ README.md
└─ .gitignore
```

Angular-App:

```txt
apps/web/
├─ src/
│  ├─ app/
│  │  ├─ app.config.ts
│  │  ├─ app.routes.ts
│  │  ├─ app.ts
│  │  ├─ app.html
│  │  ├─ app.scss
│  │  ├─ services/
│  │  │  └─ nvm-api.service.ts
│  │  └─ models/
│  │     └─ nvm.models.ts
```

Express-App:

```txt
apps/api/
├─ src/
│  ├─ server.ts
│  ├─ nvm/
│  │  ├─ nvm.service.ts
│  │  ├─ nvm.parser.ts
│  │  └─ nvm.types.ts
│  └─ routes/
│     └─ nvm.routes.ts
├─ package.json
└─ tsconfig.json
```

---

## Funktionaler Umfang MVP

Implementiere folgende Funktionen:

### 1. Status prüfen

Endpoint:

```txt
GET /api/status
```

Soll zurückgeben:

```ts
{
  ok: boolean;
  nvmVersion?: string;
  nvmDir?: string;
  error?: string;
}
```

Das Backend soll dafür `nvm --version` ausführen.

---

### 2. Installierte Versionen anzeigen

Endpoint:

```txt
GET /api/versions/installed
```

Soll `nvm ls` ausführen und sowohl rohe Ausgabe als auch nach Möglichkeit geparste Versionen zurückgeben.

Response-Idee:

```ts
{
  stdout: string;
  stderr: string;
  versions: InstalledNodeVersion[];
}
```

Typ:

```ts
export type InstalledNodeVersion = {
  version: string;
  active: boolean;
  default: boolean;
  system: boolean;
};
```

Wenn das Parsen nicht vollständig zuverlässig ist, soll zumindest `stdout` korrekt angezeigt werden.

---

### 3. Remote LTS-Versionen anzeigen

Endpoint:

```txt
GET /api/versions/remote
```

Soll ausführen:

```bash
nvm ls-remote --lts
```

Response:

```ts
{
  stdout: string;
  stderr: string;
}
```

---

### 4. Version installieren

Endpoint:

```txt
POST /api/versions/install
```

Body:

```ts
{
  version: string;
}
```

Soll ausführen:

```bash
nvm install <version>
```

Erlaubte Versionseingaben im MVP:

- `node`
- `stable`
- `lts/*`
- Major-Version: `22`
- Major.Minor: `22.11`
- Major.Minor.Patch: `22.11.0`

Ungültige Eingaben müssen mit HTTP 400 abgelehnt werden.

---

### 5. Version verwenden

Endpoint:

```txt
POST /api/versions/use
```

Body:

```ts
{
  version: string;
}
```

Soll ausführen:

```bash
nvm use <version>
```

Hinweis im UI anzeigen:

> `nvm use` gilt nur für die Shell-Session des Backend-Prozesses und verändert nicht automatisch bereits geöffnete Terminals. Für neue Terminals sollte die Default-Version gesetzt werden.

---

### 6. Default-Version setzen

Endpoint:

```txt
POST /api/versions/default
```

Body:

```ts
{
  version: string;
}
```

Soll ausführen:

```bash
nvm alias default <version>
```

---

### 7. Version deinstallieren

Endpoint:

```txt
POST /api/versions/uninstall
```

Body:

```ts
{
  version: string;
}
```

Soll ausführen:

```bash
nvm uninstall <version>
```

Im Frontend muss vor dem Aufruf ein Browser-Confirm angezeigt werden.

---

## Backend-Anforderungen

### Express Server

Der Server muss auf `127.0.0.1:3789` laufen.

```ts
app.listen(3789, '127.0.0.1', () => {
  console.log('nvm manager api läuft auf http://127.0.0.1:3789');
});
```

CORS nur für Angular erlauben:

```ts
app.use(cors({
  origin: 'http://localhost:4200',
}));
```

---

### nvm-Ausführung

Da `nvm` normalerweise eine Shell-Funktion ist, muss vor jedem `nvm`-Befehl `nvm.sh` geladen werden.

Nutze etwa diesen Ansatz:

```ts
import { execFile } from 'node:child_process';

const NVM_DIR = process.env.NVM_DIR || `${process.env.HOME}/.nvm`;

export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const escapedArgs = args
      .map((arg) => `'${arg.replace(/'/g, `'\\''`)}'`)
      .join(' ');

    const command = `
      export NVM_DIR="${NVM_DIR}";
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
      nvm ${escapedArgs}
    `;

    execFile(
      'bash',
      ['-lc', command],
      {
        timeout: 180_000,
        maxBuffer: 1024 * 1024 * 10,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject({
            message: error.message,
            stdout,
            stderr,
          });
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}
```

Wichtig:

- Niemals beliebige Shell-Kommandos aus dem Frontend annehmen.
- Nur fest definierte nvm-Aktionen erlauben.
- Versionseingaben streng validieren.
- Keine freie Übergabe von CLI-Argumenten aus dem Frontend.
- Backend nur an `127.0.0.1` binden.

---

### Validierung

Implementiere eine zentrale Validierungsfunktion:

```ts
export function isValidVersionInput(version: unknown): version is string {
  if (typeof version !== 'string') {
    return false;
  }

  return /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/.test(version);
}
```

---

## Frontend-Anforderungen

### Angular Service

Erstelle einen Service:

```txt
apps/web/src/app/services/nvm-api.service.ts
```

Der Service soll folgende Methoden haben:

```ts
getStatus()
getInstalledVersions()
getRemoteVersions()
installVersion(version: string)
useVersion(version: string)
setDefaultVersion(version: string)
uninstallVersion(version: string)
```

Basis-URL:

```ts
private readonly baseUrl = 'http://127.0.0.1:3789/api';
```

---

### Angular UI

Baue zunächst eine einfache Single-Page-Oberfläche.

Sie soll enthalten:

1. Header mit Titel `nvm Manager`
2. Status-Card
   - API erreichbar?
   - nvm-Version
   - NVM_DIR
3. Action-Card
   - Eingabefeld für Version, Default-Wert z. B. `22`
   - Button `Installieren`
   - Button `Verwenden`
   - Button `Als Default setzen`
   - Button `Deinstallieren`
4. Card `Installierte Versionen`
   - Button `Aktualisieren`
   - Anzeige als Tabelle, wenn geparste Versionen vorhanden sind
   - Zusätzlich rohe Ausgabe in `<pre>` anzeigen
5. Card `Remote LTS-Versionen`
   - Button `Laden`
   - Ausgabe in `<pre>`
6. Card `Log`
   - letzte Aktion anzeigen
   - Fehler lesbar darstellen

---

### UX-Anforderungen

- Während eine Aktion läuft, Buttons deaktivieren.
- Ladezustand anzeigen, z. B. `Installiere Node 22 ...`.
- Nach Installation, Deinstallation oder Default-Änderung die installierten Versionen neu laden.
- Vor Deinstallation `confirm()` verwenden.
- Fehler im UI lesbar anzeigen.
- Keine komplexe UI-Bibliothek verwenden. Einfaches SCSS reicht.

---

## TypeScript-Modelle im Frontend

Erstelle:

```txt
apps/web/src/app/models/nvm.models.ts
```

Mit:

```ts
export type NvmCommandResult = {
  stdout: string;
  stderr: string;
};

export type NvmStatus = {
  ok: boolean;
  nvmVersion?: string;
  nvmDir?: string;
  error?: string;
};

export type InstalledNodeVersion = {
  version: string;
  active: boolean;
  default: boolean;
  system: boolean;
};

export type InstalledVersionsResponse = NvmCommandResult & {
  versions: InstalledNodeVersion[];
};
```

---

## Root Scripts

Im Root-`package.json` sollen Scripts vorhanden sein, um Frontend und Backend bequem zu starten.

Beispiel:

```json
{
  "scripts": {
    "dev:api": "npm --prefix apps/api run dev",
    "dev:web": "npm --prefix apps/web start",
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\""
  },
  "devDependencies": {
    "concurrently": "latest"
  }
}
```

Falls `concurrently` noch nicht installiert ist, installieren.

---

## README.md

Erstelle eine kurze README mit:

- Beschreibung
- Voraussetzungen
- Installation
- Start
- Sicherheitshinweisen
- Erklärung der `nvm use`-Einschränkung

Beispielinhalt:

```md
# nvm Manager

Lokales Web-Tool zum Verwalten von Node-Versionen über nvm.

## Voraussetzungen

- macOS oder Linux
- nvm installiert
- Node.js installiert
- npm installiert

## Start

npm install
npm run dev

Frontend: http://localhost:4200  
API: http://127.0.0.1:3789

## Sicherheit

Das Backend bindet nur an 127.0.0.1 und führt ausschließlich fest definierte nvm-Kommandos aus.
```

---

## Akzeptanzkriterien

Das Projekt gilt als fertig, wenn:

1. `npm run dev` im Root startet Frontend und Backend parallel.
2. `GET http://127.0.0.1:3789/api/status` gibt eine sinnvolle Antwort zurück.
3. Das Angular-Frontend lädt und zeigt den nvm-Status an.
4. Installierte Node-Versionen werden angezeigt.
5. Remote-LTS-Versionen können geladen werden.
6. Eine gültige Node-Version kann installiert werden.
7. Eine gültige Node-Version kann als Default gesetzt werden.
8. Eine installierte Version kann nach Bestätigung deinstalliert werden.
9. Ungültige Versionseingaben werden vom Backend mit HTTP 400 abgelehnt.
10. Das Backend nimmt keine beliebigen Shell-Kommandos entgegen.

---

## TypeScript-Konfiguration

### API (`apps/api/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Web (`apps/web/tsconfig.json`)

Basiert auf dem Angular CLI-Standard, wichtig:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "useDefineForClassFields": false
  }
}
```

---

## Fehlerbehandlung

### NvmError-Klasse (Backend)

Erstelle eine eigene Fehlerklasse in `apps/api/src/nvm/nvm.types.ts`:

```ts
export class NvmError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'NvmError';
  }
}
```

### Zentrales Error-Middleware (Backend)

Am Ende von `server.ts` registrieren (nach allen Routen):

```ts
import { ErrorRequestHandler } from 'express';

const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const isNvmError = err instanceof NvmError;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Interner Fehler',
    stdout: isNvmError ? err.stdout : '',
    stderr: isNvmError ? err.stderr : '',
  });
};

app.use(errorMiddleware);
```

### Frontend-Fehlerbehandlung

In Angular-Services:

```ts
catchError((err: HttpErrorResponse) => {
  const message = err.error?.error ?? err.message;
  return throwError(() => new Error(message));
})
```

---

## Logging

Installiere `morgan` im Backend:

```bash
npm install morgan @types/morgan --prefix apps/api
```

Einbinden in `server.ts`:

```ts
import morgan from 'morgan';
app.use(morgan('dev'));
```

Kein `console.log` in Request-Handlern – nur in Startup-Code und Fehler-Middleware.

---

## Streaming-Unterstützung (SSE) für `nvm install`

`nvm install` kann mehrere Minuten dauern. Implementiere einen optionalen SSE-Endpoint für Live-Output:

Endpoint:

```txt
GET /api/versions/install/stream?version=22
```

Implementierung in `nvm.routes.ts`:

```ts
import { spawn } from 'node:child_process';

router.get('/install/stream', (req, res) => {
  const { version } = req.query;
  if (!isValidVersionInput(version)) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const NVM_DIR = process.env.NVM_DIR ?? `${process.env.HOME}/.nvm`;
  const cmd = `
    export NVM_DIR="${NVM_DIR}";
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
    nvm install '${version.replace(/'/g, "'\\''")}'
  `;
  const child = spawn('bash', ['-lc', cmd]);

  const send = (type: string, line: string) =>
    res.write(`data: ${JSON.stringify({ type, line })}\n\n`);

  child.stdout.on('data', (chunk: Buffer) => send('stdout', chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => send('stderr', chunk.toString()));
  child.on('close', code => { send('done', String(code)); res.end(); });
  req.on('close', () => child.kill());
});
```

Im Angular-Frontend per `EventSource` konsumieren (für spätere Implementierung vorbereiten, MVP nutzt regulären POST).

---

## Angular Proxy-Konfiguration (Development)

Erstelle `apps/web/proxy.conf.json` um CORS-Probleme im Dev-Modus zu vermeiden:

```json
{
  "/api": {
    "target": "http://127.0.0.1:3789",
    "secure": false,
    "changeOrigin": true
  }
}
```

In `apps/web/angular.json` unter `serve > options`:

```json
"proxyConfig": "proxy.conf.json"
```

Damit kann das Angular-Frontend im Dev-Modus über `http://localhost:4200/api/...` direkt auf das Backend zugreifen – alternativ zur direkten `127.0.0.1:3789`-URL.

---

## Dependencies-Übersicht

### Backend (`apps/api/package.json`)

```json
{
  "dependencies": {
    "cors": "latest",
    "express": "latest",
    "morgan": "latest"
  },
  "devDependencies": {
    "@types/cors": "latest",
    "@types/express": "latest",
    "@types/morgan": "latest",
    "@types/node": "latest",
    "tsx": "latest",
    "typescript": "latest"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

### Frontend (`apps/web/package.json`)

Standard Angular CLI-Dependencies, keine zusätzlichen UI-Bibliotheken.

---

## Optional nach MVP

Bitte noch nicht im ersten Schritt bauen, aber Code so strukturieren, dass es später möglich ist:

- `.nvmrc` pro Projekt lesen und schreiben (Endpoint: `GET/POST /api/nvmrc?path=...`)
- Projektordner verwalten
- Live-Logs per SSE (Endpoint bereits vorbereitet, s.o.)
- Remote-Versionen parsen und als Tabelle anzeigen (Typen in `nvm.types.ts` vorbereiten)
- Filter für LTS, Current und Major-Versionen
- Dark Mode (CSS-Custom-Properties in `_variables.scss` mit `prefers-color-scheme`)
- Packaging mit Tauri oder Electron
- Unit-Tests für `nvm.parser.ts` (reines TypeScript, einfach testbar mit Vitest)
- Integration-Tests für Express-Routes mit Supertest

---

## Wichtig für CursorAI

Bitte arbeite iterativ:

1. Projektstruktur erstellen
2. Express-API implementieren (inkl. `NvmError`-Klasse, Error-Middleware, morgan)
3. Angular-Service implementieren
4. Angular-UI implementieren
5. Root-Scripts und README ergänzen
6. TypeScript-Fehler beheben
7. Startfähigkeit prüfen

Achte besonders auf Sicherheit bei der Ausführung von `nvm`-Kommandos. Keine freie Shell-Ausführung aus dem Frontend erlauben.

### Verfügbare Cursor-Unterstützung

Für dieses Projekt sind folgende Cursor-Ressourcen eingerichtet:

**Skills:**
- `angular-expert` – Angular 17+ Standalone, Signals, HttpClient, SCSS
- `nodejs-express-expert` – Express, Child Process, SSE, Fehlerbehandlung

**Rules (automatisch aktiv bei passenden Dateien):**
- `project-conventions.mdc` – Immer aktiv: Struktur, TypeScript, Sicherheit
- `nvm-security.mdc` – Immer aktiv: Shell-Injection-Prävention, Whitelist
- `angular-standalone.mdc` – Bei `apps/web/**`-Dateien
- `express-api.mdc` – Bei `apps/api/**`-Dateien
- `nodejs-typescript.mdc` – Bei `apps/api/**`-Dateien

**Hooks:**
- `sessionStart` – Lädt Projekt-Kontext automatisch
- `beforeShellExecution` – Warnt bei potenziell gefährlichen Kommandos
- `afterFileEdit` – Gibt kontextbezogene Hinweise nach Datei-Änderungen
