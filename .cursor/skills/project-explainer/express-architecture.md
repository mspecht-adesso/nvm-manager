# Express-Architektur – nvm-manager

## Verzeichnisstruktur

```
apps/api/src/
  server.ts              – Express-App-Factory + Einstiegspunkt
  routes/
    nvm.routes.ts        – Alle /api/versions/* Endpunkte
  nvm/
    nvm.service.ts       – Shell-Ausführung (runNvm, runNvmLs, spawnNvm)
    nvm.parser.ts        – Parst nvm stdout in strukturierte Objekte
    nvm.types.ts         – TypeScript-Typen, NvmError-Klasse, Validierungsfunktionen
```

## server.ts – App-Factory Pattern

```typescript
export function createApp(): Express { ... }

if (process.env['NODE_ENV'] !== 'test') {
  createApp().listen(3789, '127.0.0.1', () => { ... });
}
```

**Warum Factory-Funktion?**
Vitest/Supertest-Tests importieren `createApp()` und erhalten eine frische Instanz
ohne Side-Effects. Der Guard `NODE_ENV !== 'test'` verhindert, dass der Server beim
Testrun auf Port 3789 lauscht und andere Tests blockiert.

**CORS:** Nur `http://localhost:4201` erlaubt (Angular dev-server default).
Im Production-Betrieb würden Frontend und Backend vom gleichen Origin stammen
und CORS wäre nicht nötig – aber für lokale Entwicklung mit Proxy-Wechsel ist
der explizite Allow nötig.

## nvm.service.ts – Shell-Ausführung

### Das nvm-Shell-Problem

nvm ist **keine ausführbare Datei** (`/usr/local/bin/nvm`), sondern eine **Shell-Funktion**,
die in `~/.nvm/nvm.sh` definiert ist. Sie kann nur in einer Shell geladen und aufgerufen werden.

**Lösung:** Jeder Aufruf startet eine neue `bash -lc` Shell, lädt nvm.sh und führt den Befehl aus:

```typescript
const NVM_HEADER = `
  unset npm_config_prefix;
  unset NPM_CONFIG_PREFIX;
  export NVM_DIR="${NVM_DIR}";
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
`;

execFile('bash', ['-lc', NVM_HEADER + `nvm ${escapeArgs(args)}`], ...)
```

**Warum `unset npm_config_prefix`?**
Wenn der Express-Server unter einer nvm-verwalteten Node-Version läuft, ist
`npm_config_prefix` auf das nvm-Verzeichnis gesetzt. Ohne `unset` schlägt
`nvm use` mit einem `npm_config_prefix`-Konfliktfehler fehl.

### Shell-Injection-Schutz

```typescript
function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}
```

Argumente werden single-quote-escaped. **Zusätzlich** validiert `nvm.types.ts` jeden
Eingabewert per Whitelist-Regex, bevor er überhaupt `escapeArgs` erreicht.

### runNvm vs. runNvmLs vs. spawnNvm

| Funktion | Verwendung | Warum |
|----------|------------|-------|
| `runNvm(args)` | Alle Einzel-Befehle (install, use, alias, ...) | Einfaches Promise, 3 min Timeout |
| `runNvmLs()` | GET /versions/installed | Führt erst `nvm use default >/dev/null` aus, dann `nvm ls`. So zeigt `->` die korrekte aktive Version, unabhängig davon mit welcher Node der Express-Server gestartet wurde |
| `spawnNvm(args)` | SSE /versions/install/stream | Streaming für Live-Output via Server-Sent Events |

**Warum `runNvmLs` statt einfach `runNvm(['ls'])`?**
Der Express-Prozess läuft mit einer bestimmten Node-Version. Wenn man in diesem
Prozess `nvm ls` aufruft, zeigt `->` die Node-Version des Express-Prozesses, nicht
die tatsächlich aktive Default-Version. `nvm use default` vor `nvm ls` korrigiert das.

## nvm.parser.ts – Output-Parsing

nvm gibt ANSI-Farbcodes in der Ausgabe zurück. Alle Parser beginnen mit:
```typescript
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;
line.replace(ANSI_ESCAPE, '')
```

### parseInstalledVersions
Erkennt nur echte Versionszeilen (Regex: `/^\s*(->)?\s*v\d+\.\d+\.\d+/`).
Alias-Zeilen wie `default -> v22.11.0` werden bewusst ignoriert.

### parseAliases
Parst `nvm alias` Ausgabe. Unterscheidet zwischen:
- **editierbar/löschbar:** User-definierte Aliases
- **readonly:** `node`, `stable`, `unstable`, `lts/*` (von nvm verwaltet)
- **nur editierbar:** `default` (kann gesetzt, aber nicht gelöscht werden)

### parseRemoteVersions
Parst `nvm ls-remote`. LTS-Informationen sind in Klammern inline:
`v24.16.0   (Latest LTS: Krypton)` → `{ version: "24.16.0", lts: "Krypton" }`
Gibt in aufsteigender Reihenfolge zurück (`.reverse()` am Ende).

## nvm.types.ts – Validierung

Drei Whitelist-Validatoren verhindern Shell-Injection auf API-Ebene:

```typescript
// Erlaubt: node, stable, lts/*, 22, 22.11, 22.11.0
isValidVersionInput(v)  →  /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/

// Erlaubt: Buchstaben + Ziffern + - + _
isValidAliasName(v)     →  /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/

// Erlaubt: node, stable, unstable, lts/<codename>, vX.Y.Z
isValidAliasTarget(v)   →  /^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/
```

## API-Endpunkte Übersicht

| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | /api/status | nvm-Version + NVM_DIR |
| GET | /api/versions/installed | Installierte Versionen (via nvm ls) |
| GET | /api/versions/remote | Verfügbare Versionen (via nvm ls-remote) |
| GET | /api/versions/aliases | Alle Aliases (via nvm alias) |
| GET | /api/versions/install/stream | SSE: Live-Output von nvm install |
| POST | /api/versions/install | Version installieren |
| POST | /api/versions/use | Aktive Version wechseln (nvm alias default) |
| POST | /api/versions/default | Default setzen (nvm alias default) |
| POST | /api/versions/uninstall | Version deinstallieren |
| POST | /api/versions/aliases | Alias erstellen/überschreiben |
| DELETE | /api/versions/aliases/:name | Alias löschen |

**Warum setzt `use` intern `nvm alias default` statt `nvm use`?**
`nvm use` ändert die aktive Version nur im aktuellen Shell-Prozess. Da jeder
API-Aufruf eine neue Bash-Subshell spawnt, würde diese Änderung sofort verloren gehen.
`nvm alias default` schreibt die Präferenz dauerhaft nach `~/.nvm/alias/default` –
beim nächsten Shell-Start wird automatisch die richtige Version aktiviert.

## Fehlerbehandlung

`NvmError` erweitert `Error` um `stdout`/`stderr`:
```typescript
class NvmError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) { ... }
}
```

Das Error-Middleware in `server.ts` gibt bei `NvmError` die rohen Streams zurück,
damit das Frontend bei Bedarf den vollständigen nvm-Output anzeigen kann.
