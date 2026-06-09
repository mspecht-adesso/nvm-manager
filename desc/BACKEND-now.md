# Backend – Aktueller Stand (Lernunterlagen)

> **Stand:** Version 0.8.0 · 2026-06-05
> **Verhältnis zu [BACKEND.md](BACKEND.md):** Das Kerndokument erklärt die
> *Konzepte* (Middleware, `child_process`, Shell-Injection-Schutz). Dieses Dokument
> beschreibt den **Ist-Zustand** des Codes in `apps/api/` – also **wie** das Backend
> heute konkret aufgebaut ist und **warum** die einzelnen Bausteine so existieren.

## Lernziele

Nach dem Durcharbeiten kannst du:

- die heute vorhandenen Quelldateien und ihre Aufgabe benennen
- erklären, **wie** der Server eingehende Requests verarbeitet und **warum** er an `127.0.0.1` bindet
- die vier Ausführungswege zu nvm unterscheiden und begründen
- den aktuellen Sicherheits- und Teststand einordnen

## Voraussetzungen

- [BACKEND.md](BACKEND.md) gelesen oder Express-Grundlagen bekannt
- Grundverständnis von `async`/`await`

## Dateistruktur (Ist-Zustand)

```
apps/api/
├── package.json          ← Express 5, cors, morgan; Dev via tsx
├── tsconfig.json
├── vitest.config.ts      ← Coverage-Schwellenwerte
├── eslint.config.mjs     ← flat config, strictTypeChecked
└── src/
    ├── server.ts                  ← App-Factory + 3 Top-Level-Handler
    ├── routes/
    │   └── nvm.routes.ts          ← alle /api/versions/* Routen
    └── nvm/
        ├── nvm.service.ts         ← Shell-Ausführung + Dateisystem-Zugriffe
        ├── nvm.parser.ts          ← parst nvm-stdout → TypeScript-Objekte
        └── nvm.types.ts           ← Typen, NvmError, Validierungs-Guards
```

> 💡 **Konzept: Warum kein Datenbank-Layer?**
> Es gibt bewusst **keine Datenbank**. nvm selbst – konkret das Verzeichnis
> `~/.nvm` – ist die einzige Quelle der Wahrheit. Jeder Request fragt den
> tatsächlichen Zustand live ab. Das vermeidet die schwierigste Klasse von Bugs:
> Daten, die zwischen einer Kopie und dem Original auseinanderlaufen.

## `server.ts` – wie der Einstieg heute aussieht

Drei Handler liegen direkt in `server.ts`, der Rest hängt am Versions-Router:

```typescript
app.get('/api/status', statusHandler);       // nvm-Version + neueste Version (GitHub)
app.post('/api/nvm/update', nvmUpdateHandler);// nvm per git aktualisieren
app.post('/api/nvm/open-dir', openDirHandler);// NVM_DIR im Dateimanager öffnen
app.use('/api/versions', versionsRouter);     // alle Versions-/Alias-Routen
app.use(errorMiddleware);                      // zentrale Fehlerbehandlung
```

**Wie die Middleware-Kette aktuell aussteht** (Reihenfolge zählt):

```
express.json()                  → JSON-Body parsen
morgan('dev')                   → Logging, NUR wenn NODE_ENV !== 'test'
cors({ origin: 'http://localhost:4201' })  → genau ein erlaubter Origin
```

**Warum `createApp()` als Factory?** Supertest importiert die Funktion und erhält
eine frische Express-Instanz *ohne* Port-Binding. Der Guard
`process.env['NODE_ENV'] !== 'test'` verhindert, dass beim Testlauf ein echter
Server auf Port 3789 startet.

**Warum Bind nur an `127.0.0.1`?** Das Backend führt Shell-Befehle auf dem Host
aus. Ein Bind an `0.0.0.0` würde es im Netzwerk erreichbar machen – ein
Sicherheitsrisiko. Der lokale Loopback schließt externe Zugriffe aus.

### Status-Handler im Detail

`statusHandler` ruft **parallel** `runNvm(['--version'])` und
`fetchNvmLatestVersion()` (GitHub-Releases-API) auf. Ist nvm nicht installiert,
antwortet er bewusst mit HTTP **200** und `ok: false` – kein 500, denn „nvm fehlt"
ist ein erwarteter Zustand, kein Serverfehler.

## `nvm/nvm.service.ts` – die vier Wege zu nvm

> 💡 **Konzept: nvm ist eine Shell-Funktion, kein Programm**
> Es gibt kein `/usr/bin/nvm`. nvm wird beim Shell-Start aus `~/.nvm/nvm.sh`
> geladen. Node.js kann Shell-Funktionen nicht direkt aufrufen – deshalb startet
> jeder Aufruf eine `bash -c`-Subshell, die zuerst die nötigen Variablen setzt und
> `nvm.sh` sourcet (`NVM_HEADER`).

| Weg | Funktion | Wann genutzt | Warum so |
|-----|----------|--------------|----------|
| Standard | `runNvm(args)` | install, use, default, uninstall, --version | `execFile('bash', ['-c', cmd])`, Timeout 3 min, maxBuffer 10 MB |
| Schnell-Listing | `runNvmLsFast()` | `GET /versions/installed` | liest Dateisystem statt `nvm ls` → ~2000× schneller |
| LTS-Alias-Datei | `setLtsAliasFile` / `deleteLtsAliasFile` | LTS-Aliase | `nvm alias lts/<x>` wird von nvm nicht unterstützt |
| Streaming | `spawnNvm(args)` | SSE-Install-Stream | liefert Live-Output als Stream |

**Warum `runNvmLsFast()`?** `nvm ls` löst intern alle Alias-Ketten auf und kann
10–30 Sekunden dauern → UI-Timeouts. Stattdessen liest die Funktion direkt:

- installierte Versionen: `readdir(~/.nvm/versions/node/)`
- Default: `readFile(~/.nvm/alias/default)` + Auflösung der Alias-Kette (max. 5 Ebenen gegen Zyklen)
- aktive Version: aus `process.env.PATH` extrahiert

**Warum git statt `nvm upgrade`?** `updateNvm()` ermittelt die Zielversion über die
GitHub-API und führt dann `git fetch --tags origin && git checkout <version>` im
`NVM_DIR` aus. `nvm upgrade` existiert in vielen nvm-Versionen (z.B. 0.39.x) gar
nicht – der git-Weg ist die offiziell dokumentierte, versionsübergreifende Methode.

**`openNvmDir()`** wählt plattformabhängig `open` (macOS) bzw. `xdg-open` (Linux).
Es wird **kein** Nutzer-Input an die Shell übergeben – nur der serverseitig
bekannte `NVM_DIR`-Pfad.

## Sicherheit – wie sie aktuell umgesetzt ist

> 💡 **Konzept: Zwei Verteidigungslinien (Defense in Depth)**
> Sicherheit verlässt sich nie auf eine einzige Maßnahme. Hier greifen zwei
> unabhängige Schichten ineinander: Eine Eingabe muss *beide* passieren, um die
> Shell zu erreichen.

1. **Whitelist-Validatoren** in `nvm.types.ts` (vor dem Aufruf): vier Typ-Guards
   (`isValidVersionInput`, `isValidAliasName`, `isValidAliasTarget`,
   `isValidLtsCodename`) prüfen Eingaben per Regex. Ungültiges → HTTP 400.
2. **Single-Quote-Escaping** in `escapeArgs()` (beim Aufruf): jedes Argument wird
   in `'…'` gekapselt, enthaltene `'` werden zu `'\''` neutralisiert.

| Maßnahme | Wo | Wirkung |
|----------|----|---------|
| Bind nur `127.0.0.1` | `server.ts` | kein Netzwerkzugriff von außen |
| Whitelist-Regex | `nvm.types.ts` | nur explizit erlaubte Eingaben |
| Single-Quote-Escaping | `nvm.service.ts` | Shell-Injection verhindert |
| CORS auf einen Origin | `server.ts` | nur `http://localhost:4201` |
| Geschützte Kern-Aliase | `nvm.routes.ts` | `default`, `node`, `stable`, `unstable`, `iojs` nicht löschbar |
| Kein Login-Shell-Flag (`-c` statt `-lc`) | `nvm.service.ts` | kein Laden von Profilen → keine Timeouts |

## Teststand (aktuell)

- **Unit-Tests** für Parser, Typen/Validatoren und Service (mit gemocktem
  `node:child_process` bzw. `node:fs/promises`).
- **Integrationstests** aller HTTP-Endpunkte via Supertest (200/400/500, SSE).
- **Coverage-Schwellenwerte** in `vitest.config.ts` erzwingen Mindestabdeckung.

```bash
cd apps/api
npm run dev            # tsx watch → http://127.0.0.1:3789
npm test               # vitest run
npm run test:coverage  # mit Coverage-Report
npm run lint           # ESLint, 0 Fehler
```

## Verständnisfragen

1. Welche drei Handler liegen direkt in `server.ts`, und welche Routen kommen vom Router?
2. Warum antwortet `GET /api/status` bei fehlendem nvm mit 200 statt 500?
3. Wodurch ist `runNvmLsFast()` so viel schneller als `nvm ls`?
4. Warum nutzt `updateNvm()` git statt `nvm upgrade`?
5. Welche zwei Sicherheitsschichten muss eine Versionseingabe passieren?

## Übungsaufgaben

1. **Code lesen:** Öffne `nvm.service.ts` und finde im `NVM_HEADER` jede Zeile;
   notiere ihren Zweck.
2. **Endpunkt nachverfolgen:** Sende `curl http://127.0.0.1:3789/api/status` und
   ordne die Antwortfelder dem `statusHandler` zu.
3. **Sicherheit testen:** Sende eine ungültige Version (z.B. `22; ls`) an
   `POST /api/versions/install` und finde die Code-Stelle, die mit 400 ablehnt.
