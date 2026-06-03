# Backend – nvm-manager API

## Lernziele

Nach dem Durcharbeiten dieses Dokuments kannst du:

- erklären, wie eine Express-Anwendung aufgebaut wird und wie Middleware funktioniert
- beschreiben, wie Node.js externe Programme und Shell-Befehle ausführt (`child_process`)
- den Unterschied zwischen `execFile` (einmalige Ausgabe) und `spawn` (Datenstrom) benennen
- nachvollziehen, warum und wie man eine Anwendung gegen **Shell-Injection** absichert
- die Rolle von TypeScript-Typen und Validierungsfunktionen für sichere Eingaben einordnen

## Voraussetzungen

- Grundkenntnisse in JavaScript/TypeScript (Funktionen, Objekte, `async`/`await`)
- Verständnis, was ein HTTP-Request grob ist (siehe [API.md](API.md))
- Du weißt, was eine Kommandozeile/Terminal ist

> 💡 **Konzept: Was ist ein "Backend"?**
> Das Backend ist der Teil der Anwendung, der **nicht** im Browser läuft, sondern
> als eigenständiger Prozess auf einem Rechner. Es hat Zugriff auf Dinge, die der
> Browser aus Sicherheitsgründen nicht darf – hier z.B. das Ausführen von
> Shell-Befehlen auf dem Computer. Das Frontend (Browser) bittet das Backend per
> HTTP, etwas zu tun; das Backend erledigt es und antwortet.

## Überblick

Das Backend ist eine schlanke **Express**-Anwendung in TypeScript (`apps/api/`), die als sicherer Proxy zwischen der Angular-UI und dem lokalen **nvm**-Tool agiert. Es gibt keine Datenbank: nvm selbst – und damit das Dateisystem unter `~/.nvm` – ist die einzige Quelle der Wahrheit.

```
apps/api/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── server.ts                  ← Express-App-Factory + HTTP-Einstiegspunkt
    ├── routes/
    │   └── nvm.routes.ts          ← Alle /api/versions/* Routen
    └── nvm/
        ├── nvm.service.ts         ← Shell-Ausführung (execFile / spawn)
        ├── nvm.parser.ts          ← Parst nvm stdout → TypeScript-Objekte
        └── nvm.types.ts           ← Typen, NvmError-Klasse, Validierungs-Guards
```

### Abhängigkeiten

| Paket | Zweck |
|-------|-------|
| `express` | HTTP-Server |
| `cors` | Cross-Origin-Headers für den Angular-Dev-Server |
| `morgan` | Request-Logging (nur außerhalb von Tests) |
| `tsx` | TypeScript-Ausführung ohne Build-Schritt (Dev) |
| `vitest` + `supertest` | Unit- und Integrationstests |

---

## `server.ts` – App-Factory

### Factory-Pattern

```typescript
export function createApp(): Express {
  const app = express();
  // ... Middlewares, Routen
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  createApp().listen(3789, '127.0.0.1', () => { ... });
}
```

**Warum eine Factory-Funktion und kein direktes `app.listen()`?**
Vitest und Supertest importieren `createApp()` und erhalten eine frische, saubere
Express-Instanz ohne Port-Binding. Der Guard `NODE_ENV !== 'test'` verhindert, dass
beim Testrun ein tatsächlicher Server auf Port 3789 startet – das würde parallele
Tests blockieren und Ports belegen.

### Bind-Adresse: ausschließlich `127.0.0.1`

Das Backend führt Shell-Kommandos auf dem Host aus. Ein Bind an `0.0.0.0` (alle
Netzwerkschnittstellen) würde es im lokalen Netzwerk erreichbar machen und Dritten
die Ausführung beliebiger nvm-Kommandos erlauben. `127.0.0.1` schränkt den Zugriff
auf den lokalen Rechner ein.

### Middleware-Stack

> 💡 **Konzept: Was ist Middleware?**
> Eine Middleware ist eine Funktion, die jeden eingehenden Request **bearbeitet,
> bevor** er beim eigentlichen Routen-Handler ankommt – wie eine Kette von
> Bearbeitungsstationen. Jede Station kann den Request verändern (z.B. den
> JSON-Body parsen), etwas protokollieren (Logging) oder ihn ablehnen. Express
> ruft die Middlewares in genau der Reihenfolge auf, in der sie mit `app.use()`
> registriert wurden.

```
express.json()          ← Request-Body als JSON parsen
morgan('dev')           ← HTTP-Logging (nur außerhalb von Tests)
cors({ origin: ... })   ← Nur http://localhost:4201 erlaubt (Angular Dev-Server)
```

**Warum CORS?**
Im Entwicklungsbetrieb laufen Angular (Port 4201) und Express (Port 3789) auf
verschiedenen Ports → verschiedene Origins. CORS-Header erlauben dem Browser den
Cross-Origin-Zugriff. Im Produktionsbetrieb könnten beide vom selben Origin
ausgeliefert werden, und CORS wäre nicht mehr nötig.

### Fehler-Middleware

```typescript
const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const isNvmError = err instanceof NvmError;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Interner Fehler',
    stdout: isNvmError ? err.stdout : '',
    stderr: isNvmError ? err.stderr : '',
  });
};
```

Alle Route-Handler fangen Fehler per `try/catch` und leiten sie per `next(err)`
weiter. Die zentrale Fehler-Middleware wandelt `NvmError`-Objekte in strukturierte
JSON-Antworten um, inklusive der rohen `stdout`/`stderr`-Ausgabe – nützlich zur
Diagnose im Frontend.

---

## `nvm/nvm.service.ts` – Shell-Ausführung

### Das nvm-Shell-Problem

`nvm` ist **keine ausführbare Datei** (kein `/usr/bin/nvm`), sondern eine
**Shell-Funktion**, die beim Shell-Start aus `~/.nvm/nvm.sh` in die aktuelle
Shell-Session geladen wird. Node.js-`child_process`-APIs können Shell-Funktionen
nicht direkt aufrufen.

**Lösung:** Jeder nvm-Aufruf startet eine neue `bash -c`-Subshell, die zuerst
alle nötigen Umgebungsvariablen setzt, `nvm.sh` sourcet und dann den gewünschten
Befehl ausführt.

> 💡 **Konzept: Subshell, `bash -c` und "sourcen"**
> Eine **Subshell** ist eine vom Programm gestartete, frische Shell-Sitzung – wie
> wenn man ein neues Terminalfenster öffnet. Das Flag `-c` übergibt den auszuführenden
> Befehl als Text. (Das früher genutzte `-l` für Login-Shell wurde entfernt, weil es
> alle Profil-Dateien lädt und dadurch 15–30 Sekunden dauern kann.)
> **"Sourcen"** (`. datei.sh` bzw. `source datei.sh`) bedeutet, ein Shell-Skript
> in der *aktuellen* Sitzung auszuführen, sodass dessen Funktionen und Variablen
> danach verfügbar sind. Genau das ist nötig, damit die `nvm`-Funktion in der
> Subshell existiert.

> 💡 **Konzept: `child_process` in Node.js**
> Node.js kann mit dem eingebauten Modul `node:child_process` andere Programme als
> **Kindprozesse** starten. Die wichtigsten Funktionen: `execFile` sammelt die
> komplette Ausgabe und liefert sie am Ende auf einmal; `spawn` liefert die Ausgabe
> als kontinuierlichen Datenstrom (Stream), während das Programm noch läuft. Beide
> werden hier genutzt – siehe "Die drei Ausführungsmodi".

### NVM_HEADER

```typescript
const NVM_HEADER = `
  unset npm_config_prefix;
  unset NPM_CONFIG_PREFIX;
  export NVM_DIR="${NVM_DIR}";
  export HOME="${process.env['HOME'] ?? ''}";
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
`;
```

Dieser Shell-Preamble wird jedem nvm-Aufruf vorangestellt. Er:

1. **`unset npm_config_prefix`** – Wenn der Express-Server selbst unter einer
   nvm-verwalteten Node-Version läuft, ist `npm_config_prefix` auf das
   nvm-Verzeichnis dieser Version gesetzt. Ohne `unset` schlägt `nvm install`
   oder `nvm use` mit einem Konfliktfehler fehl (`npm_config_prefix is set to...`).

2. **`export NVM_DIR`** – Setzt das nvm-Verzeichnis explizit, da Subshells
   Umgebungsvariablen ihrer Elternprozesse nicht automatisch erben.

3. **`export HOME`** – Setzt `HOME` explizit, da die nicht-login Shell
   (`bash -c`) es nicht automatisch erhält.

4. **`. "$NVM_DIR/nvm.sh"`** – Sourcet (lädt) die nvm-Shell-Funktion.

**Warum `bash -c` und nicht `bash -lc` (Login-Shell)?**
Die Login-Shell (`-l`) lädt alle Profil-Dateien (`.bash_profile`, oh-my-zsh usw.),
was auf manchen Systemen 15–30 Sekunden dauern kann. Da der `NVM_HEADER` alle
benötigten Variablen manuell setzt, ist `-l` überflüssig. Ohne `-l` dauert ein
nvm-Aufruf nur noch Millisekunden statt Sekunden.

### Shell-Injection-Schutz

> 💡 **Konzept: Was ist Shell-Injection?**
> Wenn man Benutzereingaben ungeprüft in einen Shell-Befehl einbaut, kann ein
> Angreifer Sonderzeichen einschleusen, um eigene Befehle auszuführen. Beispiel:
> Gibt jemand als "Version" den Text `22; rm -rf ~` ein und wird dieser direkt in
> den Befehl eingesetzt, würde nach dem nvm-Aufruf das `rm`-Kommando ausgeführt –
> mit potenziell katastrophalen Folgen. Schutz bieten zwei Maßnahmen, die hier
> **kombiniert** werden: (1) gefährliche Zeichen *escapen* (unschädlich machen)
> und (2) Eingaben vorab per *Whitelist* auf erlaubte Muster prüfen.

```typescript
function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}
```

Alle Argumente werden single-quote-escaped, bevor sie in den Shell-Befehl
eingefügt werden. Einfache Anführungszeichen im Argument (`'`) werden durch die
Sequenz `'\''` (Quote-Ende, Escaped-Quote, Quote-Start) ersetzt.

**Zweite Sicherheitslinie:** Die Whitelist-Validatoren in `nvm.types.ts` prüfen
Eingaben per Regex, bevor sie überhaupt `escapeArgs` erreichen.

### Die vier Ausführungsmodi

> 💡 **Konzept: Promise**
> Ein **Promise** ist ein Platzhalter für einen Wert, der erst *später* verfügbar
> ist – typisch bei Operationen, die Zeit brauchen (Dateizugriff, Netzwerk,
> Prozessausführung). Ein Promise kann sich *erfüllen* (`resolve`, Erfolg) oder
> *scheitern* (`reject`, Fehler). Mit `await` wartet man auf das Ergebnis, ohne den
> Rest des Programms zu blockieren. `runNvm` verpackt den Kindprozess in ein Promise,
> sodass die Routen einfach `const result = await runNvm(...)` schreiben können.

#### `runNvm(args)` – Standard-Aufruf

```typescript
export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }>
```

Verwendet `execFile('bash', ['-c', cmd])` mit:
- **Timeout:** 3 Minuten (für `nvm install`, das Downloads durchführt)
- **maxBuffer:** 10 MB (Ausgabe von `nvm ls-remote` kann groß sein)

Gibt ein Promise zurück, das bei Fehler ein `NvmError` wirft.

#### `runNvmLsFast()` – Dateisystem-basiertes Versions-Listing

```typescript
export async function runNvmLsFast(): Promise<InstalledVersionsResponse>
```

**Warum kein Shell-Prozess für `nvm ls`?**

`nvm ls` dauert auf vielen Systemen 10–30 Sekunden, weil es intern alle Alias-Ketten
auflöst und durch das gesamte nvm-Alias-Verzeichnis iteriert. Das führte zu Timeouts
in der UI.

`runNvmLsFast()` liest die gleichen Informationen direkt aus dem Dateisystem:

| Was | Wie | Dauer |
|-----|-----|-------|
| Installierte Versionen | `readdir(~/.nvm/versions/node/)` | < 1 ms |
| Default-Version | `readFile(~/.nvm/alias/default)` + Alias-Auflösung | < 1 ms |
| Aktive Version | aus `process.env.PATH` extrahieren | 0 ms |

**Alias-Auflösung:** Die interne Funktion `resolveAlias()` löst Ketten auf:
`default → lts/* → v22.14.0`. Sie verfolgt maximal 5 Ebenen, um Zyklen zu
vermeiden.

#### `setLtsAliasFile(codename, version)` – LTS-Alias direkt schreiben

```typescript
export async function setLtsAliasFile(codename: string, version: string): Promise<void>
```

Schreibt `v<version>` in `~/.nvm/alias/lts/<codename>`. Erstellt das
`lts/`-Unterverzeichnis falls nötig.

**Warum direkt ins Dateisystem?** `nvm alias lts/<codename> <version>` schlägt
mit „Aliases in subdirectories are not supported" fehl. nvm verwaltet lts-Aliases
intern als Dateien – dieser Endpunkt tut dasselbe.

#### `deleteLtsAliasFile(codename)` – LTS-Alias direkt löschen

```typescript
export async function deleteLtsAliasFile(codename: string): Promise<void>
```

Löscht die Datei `~/.nvm/alias/lts/<codename>`. `nvm unalias lts/<codename>`
schlägt aus demselben Grund fehl wie `nvm alias`.

#### `spawnNvm(args)` – Streaming-Aufruf

```typescript
export function spawnNvm(args: string[]): ChildProcess
```

Verwendet `spawn('bash', ['-c', cmd])` statt `execFile`. Gibt den `ChildProcess`
direkt zurück, damit die Route den `stdout`/`stderr`-Stream über **Server-Sent Events**
(SSE) live an den Browser weiterleiten kann.

---

## `nvm/nvm.parser.ts` – Output-Parsing

nvm gibt seine Ausgabe mit **ANSI-Farbcodes** aus. Alle Parser beginnen damit, diese
zu entfernen:

```typescript
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;
line.replace(ANSI_ESCAPE, '')
```

### `parseInstalledVersions(stdout)`

Parst die Ausgabe von `nvm ls`. Echte Versionszeilen folgen dem Muster:

```
->     v22.11.0 (default)
       v20.18.0
       v18.20.7
```

Der Filter `/^\s*(->)?\s*v\d+\.\d+\.\d+/` erkennt genau diese Zeilen.
Alias-Zeilen wie `default -> v22.11.0 (-> v22.11.0)` werden bewusst ignoriert –
sie folgen einem anderen Muster (`name -> target`).

Jede Versionszeile wird zu einem `InstalledNodeVersion`-Objekt:

```typescript
{
  version: string;   // "22.11.0" (ohne "v")
  active: boolean;   // line beginnt mit "->"
  default: boolean;  // line enthält "(default)"
  system: boolean;   // line enthält "system"
}
```

### `parseAliases(stdout)`

Parst die Ausgabe von `nvm alias`. Jede Zeile hat das Format:

```
default -> lts/* (-> v22.20.0)
node    -> stable (-> v22.20.0) (default)
lts/iron -> v20.19.1 (-> N/A)
my-project -> v18.18.0
```

Der Parser extrahiert:
- `name` – Alias-Name (linke Seite des ersten ` -> `)
- `target` – Direkt-Ziel (erster Token nach ` -> `)
- `resolved` – Aufgelöste Semver-Version aus `(-> vX.Y.Z)`, falls vorhanden

Flags werden aus dem Namen abgeleitet:

```typescript
const PROTECTED_ALIASES = new Set(['default', 'node', 'stable', 'unstable', 'iojs']);

editable:  !name.startsWith('lts/')           // lts/-Aliases haben eigenen Endpunkt
deletable: !PROTECTED_ALIASES.has(name)       // Kern-Aliases sind geschützt
```

- `editable: false` nur für `lts/`-Aliases – alle anderen (auch `node`, `stable`,
  `unstable`, `default`) sind editierbar. LTS-Aliases haben einen dedizierten Endpunkt.
- `deletable: false` für `default`, `node`, `stable`, `unstable`, `iojs` –
  diese Kern-Aliases sind dauerhaft vor dem Löschen geschützt.

### `parseRemoteVersions(stdout)`

Parst die Ausgabe von `nvm ls-remote`. Format:

```
   v24.15.0   (LTS: Krypton)
   v24.16.0   (Latest LTS: Krypton)
   v25.0.0
```

Ein einziger Aufruf liefert alle Versionen – LTS-Informationen sind bereits inline.
Kein separater `--lts`-Aufruf nötig.

Die Versionen werden am Ende umgekehrt (`.reverse()`), um neueste Versionen zuerst
zu liefern.

---

## `nvm/nvm.types.ts` – Typen und Validierung

### Typen

```typescript
InstalledNodeVersion  // { version, active, default, system }
InstalledVersionsResponse  // { stdout, stderr, versions[] }
NvmAlias              // { name, target, resolved, editable, deletable }
AliasesResponse       // { stdout, stderr, aliases[] }
RemoteNodeVersion     // { version, lts: string | null }
RemoteVersionsResponse // { stdout, stderr, versions[] }
NvmStatus             // { ok, nvmVersion?, nvmDir?, error? }
```

### `NvmError`-Klasse

```typescript
export class NvmError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
  ) { ... }
}
```

Erweitert den Standard-`Error` um `stdout` und `stderr`, damit die Fehler-Middleware
den vollständigen nvm-Output im HTTP-Response mitliefern kann.

### Whitelist-Validatoren

> 💡 **Konzept: Regulärer Ausdruck (Regex) & "Whitelist"**
> Ein **regulärer Ausdruck** beschreibt ein Suchmuster für Text. Beispiel:
> `/^\d+$/` bedeutet "von Anfang (`^`) bis Ende (`$`) nur Ziffern (`\d+`)".
> Eine **Whitelist** (Positivliste) erlaubt *ausschließlich* das, was explizit
> dem Muster entspricht, und lehnt alles andere ab – das Gegenteil einer Blacklist,
> die nur bekannte schlechte Werte sperrt. Whitelists sind sicherer, weil man nicht
> jeden denkbaren Angriff vorhersehen muss.

> 💡 **Konzept: Typ-Guard (`v is string`)**
> Eine Funktion mit Rückgabetyp `v is string` ist ein **Type Guard**. Gibt sie
> `true` zurück, "weiß" der TypeScript-Compiler danach, dass `v` wirklich ein
> `string` mit gültigem Inhalt ist. So verbinden diese Funktionen Laufzeit-Prüfung
> (Regex) und statische Typsicherheit in einem.

Vier Typ-Guard-Funktionen schützen gegen Shell-Injection auf Anwendungsebene:

#### `isValidVersionInput(v)`

```typescript
/^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/
```

Erlaubt: `node`, `stable`, `lts/*`, `22`, `22.11`, `22.11.0`

#### `isValidAliasName(v)`

```typescript
/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/
```

Muss mit einem Buchstaben beginnen, max. 50 Zeichen. Erlaubt Buchstaben, Ziffern,
Bindestrich, Unterstrich. Verhindert Sonderzeichen, die Shell-Metacharacter sein könnten.

#### `isValidAliasTarget(v)`

```typescript
/^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/
```

Erlaubt: `node`, `stable`, `unstable`, `lts/<codename>`, `lts/*`, `v22.11.0`, `22`

#### `isValidLtsCodename(v)`

```typescript
/^[\w*-]+$/  (Länge 1–30)
```

Erlaubt: `iron`, `hydrogen`, `*` – der Teil nach `lts/` in Requests an
`POST /aliases/lts` und `DELETE /aliases/lts/:codename`.

---

## Entwicklungsworkflow

```bash
cd apps/api

# Entwicklung mit Hot-Reload
npm run dev        # tsx watch src/server.ts → http://127.0.0.1:3789

# Tests
npm test           # vitest run (einmalig)
npm run test:watch # vitest (watch-Modus)
npm run test:coverage  # mit Coverage-Report

# Produktion
npm run build      # tsc → dist/
npm start          # node dist/server.js
```

## Sicherheitskonzept zusammengefasst

| Maßnahme | Wo | Wirkung |
|----------|----|---------|
| Bind nur `127.0.0.1` | `server.ts` | Kein Netzwerkzugriff von außen |
| Whitelist-Regex | `nvm.types.ts` | Nur explizit erlaubte Eingaben |
| Single-Quote-Escaping | `nvm.service.ts` | Shell-Injection verhindert |
| CORS eingeschränkt | `server.ts` | Nur bekannter Origin erlaubt |
| Geschützte Kern-Aliases | `nvm.routes.ts` + `nvm.parser.ts` | `default`, `node`, `stable`, `unstable`, `iojs` können nicht gelöscht werden |
| Kein Login-Shell-Flag (`-l`) | `nvm.service.ts` | Kein Laden von Profil-Dateien, verhindert Timeouts |
| Direkte Dateisystem-Operationen für LTS | `nvm.service.ts` | Umgeht `nvm`-CLI-Einschränkungen für `lts/`-Unterverzeichnisse |

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Express** | Beliebtes, schlankes Web-Framework für Node.js zum Bauen von Servern und APIs |
| **Middleware** | Funktion, die einen Request bearbeitet, bevor er den Routen-Handler erreicht |
| **Routen-Handler** | Funktion, die einen konkreten Endpunkt (z.B. `GET /api/status`) bedient |
| **Subshell** | Vom Programm gestartete, eigenständige Shell-Sitzung |
| **`bash -c`** | Startet eine Bash-Subshell und führt den nachfolgenden Befehlstext aus |
| **sourcen** | Ein Shell-Skript in der aktuellen Sitzung laden (`.` bzw. `source`) |
| **`child_process`** | Node.js-Modul zum Starten externer Programme |
| **`execFile`** | Führt ein Programm aus und liefert die gesammelte Ausgabe am Ende |
| **`spawn`** | Führt ein Programm aus und liefert die Ausgabe als Stream (live) |
| **stdout / stderr** | Standard-Ausgabe-Kanal bzw. Standard-Fehler-Kanal eines Prozesses |
| **Promise** | Platzhalter für einen erst später verfügbaren (asynchronen) Wert |
| **Shell-Injection** | Angriff durch Einschleusen von Shell-Befehlen über Eingaben |
| **Escaping** | Sonderzeichen unschädlich machen, damit sie nicht als Befehl interpretiert werden |
| **Whitelist** | Positivliste: nur explizit Erlaubtes wird akzeptiert |
| **Regex** | Regulärer Ausdruck; ein Suchmuster für Text |
| **Type Guard** | Funktion, die zur Laufzeit prüft und dem Compiler den Typ bestätigt |
| **SSE** | Server-Sent Events; Server schickt fortlaufend Daten an den Browser (siehe [API.md](API.md)) |
| **ANSI-Escape-Codes** | Unsichtbare Steuerzeichen für Terminalfarben, hier aus der Ausgabe entfernt |

---

## Verständnisfragen

Versuche, die Fragen aus dem Gedächtnis zu beantworten, und prüfe dann im Text.

1. Warum wird `createApp()` als Factory-Funktion gebaut, statt den Server direkt zu starten?
2. Was würde passieren, wenn der Server an `0.0.0.0` statt `127.0.0.1` gebunden wäre?
3. Warum kann Node.js `nvm` nicht direkt als Programm aufrufen?
4. Wozu dient `unset npm_config_prefix` im `NVM_HEADER`?
5. Welche zwei Mechanismen schützen gemeinsam gegen Shell-Injection?
6. Worin unterscheiden sich `runNvm`, `runNvmLsFast` und `spawnNvm`?
7. Warum liest `runNvmLsFast()` Versionen und Aliases direkt vom Dateisystem,
   statt `nvm ls` aufzurufen?
8. Was ist der Vorteil einer Whitelist gegenüber einer Blacklist bei der Eingabeprüfung?
9. Warum können `lts/`-Aliases nicht über `nvm alias`/`nvm unalias` verwaltet werden,
   und wie löst das Backend dieses Problem?

---

## Übungsaufgaben

> **Hinweis:** Mache vor Änderungen einen Git-Branch oder eine Sicherung. Diese
> Aufgaben dienen dem Lernen – die bestehende Funktionalität soll erhalten bleiben.

1. **Code lesen:** Öffne `apps/api/src/nvm/nvm.service.ts` und markiere im
   `NVM_HEADER` jede der fünf Zeilen mit einem Kommentar, der ihren Zweck erklärt.
2. **Validierung testen:** Schreibe auf Papier oder im Kopf durch, welche der
   folgenden Eingaben `isValidVersionInput` akzeptiert: `22`, `v22`, `lts/iron`,
   `22.11.0`, `22; ls`, `node`. Prüfe dann mit dem Regex aus `nvm.types.ts`.
3. **Neuer Endpunkt (Konzept):** Skizziere, welche Schritte nötig wären, um einen
   Endpunkt `GET /api/versions/current` zu bauen, der nur die aktive Version
   zurückgibt. Welche bestehenden Funktionen (Service, Parser) könntest du
   wiederverwenden?
4. **Fehlerfall nachstellen:** Stoppe das Backend und rufe im Frontend
   "Aktualisieren" auf. Beobachte im Browser-Netzwerk-Tab, welcher Fehler
   ankommt, und finde im Code die Stelle, die ihn erzeugt.
5. **Vertiefung Tests:** Sieh dir `apps/api/src/nvm/nvm.parser.spec.ts` an.
   Welche Eingabe-Ausgabe-Paare werden getestet? Ergänze gedanklich einen Testfall
   für eine Alias-Zeile mit `(-> N/A)`.
6. **Dateisystem-Modus verstehen:** Öffne `runNvmLsFast()` in `nvm.service.ts`.
   Welche Dateien werden gelesen? Wie wird `active` vs. `default` ermittelt?
   Welche Fehlerfälle könnten auftreten, wenn `~/.nvm/versions/node/` fehlt?
