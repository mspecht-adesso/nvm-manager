# REST-API – nvm-manager

## Lernziele

Nach dem Durcharbeiten dieses Dokuments kannst du:

- erklären, was eine REST-API ist und wofür die HTTP-Verben GET, POST und DELETE stehen
- den Aufbau von Request und Response (Body, Statuscode, JSON) beschreiben
- nachvollziehen, warum Eingaben **serverseitig** validiert werden müssen
- den Unterschied zwischen einer normalen Antwort und einem **Datenstrom** (SSE) erklären
- eine API selbstständig mit Werkzeugen wie `curl` ausprobieren

## Voraussetzungen

- Du hast [BACKEND.md](BACKEND.md) gelesen oder kennst Express-Grundlagen
- Du weißt grob, was ein Server und ein Browser sind

> 💡 **Konzept: Was ist eine REST-API?**
> Eine **API** ist eine vereinbarte Schnittstelle zwischen zwei Programmen. **REST**
> ist ein verbreiteter Stil für Web-APIs: Man spricht **Ressourcen** über URLs an
> (z.B. `/api/versions/installed`) und nutzt **HTTP-Verben**, um die Absicht
> auszudrücken:
> - **GET** = Daten *lesen* (verändert nichts)
> - **POST** = etwas *erstellen* oder eine *Aktion auslösen*
> - **DELETE** = etwas *löschen*
>
> Die Antwort enthält einen **Statuscode** (z.B. `200` = OK, `400` = fehlerhafte
> Anfrage, `500` = Serverfehler) und meist einen **Body** im JSON-Format.

## Allgemeines

- **Base URL:** `http://127.0.0.1:3789`
- **Format:** JSON (Request-Body und Response)
- **Auth:** keine (nur lokal erreichbar, Bind an `127.0.0.1`)
- **CORS:** nur `http://localhost:4201` erlaubt

Alle Endpunkte befinden sich unter dem Präfix `/api`. Der Angular-Dev-Server
proxyt `/api/*` → `http://127.0.0.1:3789/api/*` via `proxy.conf.json`.

> 💡 **Konzept: CORS und "Origin"**
> Ein **Origin** ist die Kombination aus Protokoll, Host und Port (z.B.
> `http://localhost:4201`). Aus Sicherheitsgründen verbietet der Browser
> standardmäßig, dass eine Webseite Anfragen an einen *anderen* Origin schickt.
> **CORS** (*Cross-Origin Resource Sharing*) ist der Mechanismus, mit dem ein
> Server dem Browser per Antwort-Header erlaubt: "Anfragen von diesem bestimmten
> Origin sind in Ordnung." Im Entwicklungsbetrieb umgeht der Angular-**Proxy** das
> Thema zusätzlich, indem er die Anfragen serverseitig weiterleitet – aus Sicht des
> Browsers bleibt alles auf einem Origin.

---

## Fehlerformat

Bei einem Fehler (HTTP 400 oder 500) antwortet die API immer mit:

```json
{
  "error": "Fehlermeldung",
  "stdout": "",
  "stderr": ""
}
```

`stdout` und `stderr` sind nur bei nvm-Ausführungsfehlern gefüllt und enthalten
die rohe Shell-Ausgabe.

---

## Endpunkte

### `GET /api/status`

Prüft, ob nvm verfügbar ist und gibt die installierte Version zurück. Ruft parallel
die GitHub-Releases-API ab, um die neueste verfügbare nvm-Version zu ermitteln.

**Response 200:**
```json
{
  "ok": true,
  "nvmVersion": "0.39.3",
  "nvmLatestVersion": "0.40.4",
  "nvmDir": "/Users/username/.nvm"
}
```

> `nvmLatestVersion` ist nur vorhanden wenn die GitHub-Abfrage erfolgreich war (Timeout: 5 s).

**Response 200 (nvm nicht gefunden):**
```json
{
  "ok": false,
  "error": "nvm not found"
}
```

**Implementierung:** `server.ts → statusHandler`
Ruft `runNvm(['--version'])` und `fetchNvmLatestVersion()` parallel auf.
Schlägt der nvm-Aufruf fehl (nvm nicht installiert), wird `ok: false` zurückgegeben –
kein HTTP-500-Fehler, da dies ein erwarteter Zustand ist.

---

### `POST /api/nvm/update`

Aktualisiert nvm auf die neueste verfügbare Version via `nvm upgrade`.

**Request:** kein Body erforderlich

**Response 200:**
```json
{
  "stdout": "Downloading nvm from git to '/Users/username/.nvm'\n...",
  "stderr": ""
}
```

**Response 500:**
```json
{
  "error": "nvm upgrade failed",
  "stdout": "",
  "stderr": "..."
}
```

**Implementierung:** `server.ts → nvmUpdateHandler`
Ruft `updateNvm()` auf. Die Funktion:
1. Ermittelt die Zielversion via `fetchNvmLatestVersion()` (GitHub API).
2. Führt `git fetch --tags origin && git checkout <version>` im `NVM_DIR` aus.

> **Warum git statt `nvm upgrade`?** `nvm upgrade` ist kein stabiles, versionsübergreifendes
> Kommando – in nvm v0.39.x und früheren Versionen existiert es nicht. Der git-Weg ist die
> offizielle Upgrade-Methode laut nvm-Dokumentation und funktioniert für alle Versionen,
> bei denen nvm über das Install-Script (= git clone) eingerichtet wurde.

Timeout: 3 Minuten.

---

### `POST /api/nvm/open-dir`

Öffnet das `NVM_DIR`-Verzeichnis im nativen Dateimanager des Systems.

**Request:** kein Body erforderlich

**Response 200:**
```json
{ "ok": true }
```

**Response 500:**
```json
{
  "error": "open failed: No such file or directory",
  "stdout": "",
  "stderr": ""
}
```

**Implementierung:** `server.ts → openDirHandler` → `nvm.service.ts → openNvmDir()`
Ermittelt `NVM_DIR` aus `process.env`, wählt dann plattformabhängig den Befehl:
- **macOS:** `open <NVM_DIR>`
- **Linux:** `xdg-open <NVM_DIR>`

Kein User-Input wird an die Shell übergeben – ausschließlich der serverseitig
konfigurierte Pfad wird geöffnet.

---

### `GET /api/versions/installed`

Gibt alle lokal installierten Node.js-Versionen zurück.

**Response 200:**
```json
{
  "stdout": "",
  "stderr": "",
  "versions": [
    { "version": "22.14.0", "active": false, "default": true,  "system": false },
    { "version": "22.20.0", "active": true,  "default": false, "system": false },
    { "version": "20.17.0", "active": false, "default": false, "system": false }
  ]
}
```

**Felder:**

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `version` | `string` | Semver ohne `v`-Präfix |
| `active` | `boolean` | Version ist im `PATH` des laufenden Node.js-Prozesses aktiv |
| `default` | `boolean` | Version entspricht dem aufgelösten `default`-Alias |
| `system` | `boolean` | Immer `false` (System-Node nicht über Dateisystem ermittelbar) |

**Implementierung:** `nvm.routes.ts → getInstalledHandler`
Ruft `runNvmLsFast()` auf – liest die Daten direkt aus dem Dateisystem
(`~/.nvm/versions/node/`, `~/.nvm/alias/default`), ohne eine Shell zu starten.
Das macht den Endpunkt von ~20 Sekunden auf ~5 ms schnell.

- **`active`** wird aus `process.env.PATH` ermittelt: enthält der PATH einen
  `.nvm/versions/node/vX.Y.Z/bin`-Eintrag, ist das die aktive Version.
- **`default`** wird durch Auflösung der Alias-Kette in `~/.nvm/alias/` ermittelt
  (unterstützt Ketten wie `default → lts/* → v22.14.0`).
- `stdout`/`stderr` sind immer leer (kein Shell-Prozess).

---

### `GET /api/versions/remote`

Gibt alle bei nodejs.org verfügbaren Node.js-Versionen zurück.

**Achtung:** Dieser Aufruf führt `nvm ls-remote` aus, was eine Netzwerkanfrage
an nodejs.org macht und je nach Verbindung mehrere Sekunden dauern kann.

**Response 200:**
```json
{
  "stdout": "...",
  "stderr": "",
  "versions": [
    { "version": "24.16.0", "lts": "Krypton" },
    { "version": "24.15.0", "lts": "Krypton" },
    { "version": "22.16.0", "lts": "Jod" },
    { "version": "25.0.0",  "lts": null }
  ]
}
```

**Felder:**

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `version` | `string` | Semver ohne `v` |
| `lts` | `string \| null` | LTS-Codename oder `null` für Non-LTS |

**Sortierung:** Neueste Versionen zuerst (absteigende Semver-Reihenfolge).

---

### `GET /api/versions/aliases`

Gibt alle nvm-Aliases zurück.

**Response 200:**
```json
{
  "stdout": "...",
  "stderr": "",
  "aliases": [
    {
      "name": "default",
      "target": "lts/*",
      "resolved": "v22.20.0",
      "editable": true,
      "deletable": false
    },
    {
      "name": "node",
      "target": "stable",
      "resolved": "v22.20.0",
      "editable": true,
      "deletable": false
    },
    {
      "name": "lts/iron",
      "target": "v20.20.2",
      "resolved": "v20.20.2",
      "editable": false,
      "deletable": true
    },
    {
      "name": "my-project",
      "target": "v18.18.0",
      "resolved": "v18.18.0",
      "editable": true,
      "deletable": true
    }
  ]
}
```

**Felder:**

| Feld | Typ | Bedeutung |
|------|-----|-----------|
| `name` | `string` | Alias-Name |
| `target` | `string` | Direkt-Ziel (z.B. `lts/*`, `v22.11.0`) |
| `resolved` | `string \| null` | Aufgelöste Semver-Version oder `null` (N/A) |
| `editable` | `boolean` | `false` nur für `lts/`-Aliases (eigener Endpunkt) |
| `deletable` | `boolean` | `false` für `default`, `node`, `stable`, `unstable`, `iojs` |

---

### `POST /api/versions/install`

Installiert eine Node.js-Version via `nvm install`.

**Request-Body:**
```json
{ "version": "22" }
```

Erlaubte Versionswerte: `node`, `stable`, `lts/*`, `22`, `22.11`, `22.11.0`

**Response 200:**
```json
{
  "stdout": "Downloading and installing node v22.11.0...\n...",
  "stderr": ""
}
```

**Response 400 (ungültige Version):**
```json
{ "error": "Ungültige Version: ../evil" }
```

**Hinweis:** Dieser Endpunkt ist blockierend (bis zu 3 Minuten Timeout). Für
Live-Ausgabe während der Installation gibt es `GET /api/versions/install/stream`.

---

### `POST /api/versions/use`

Setzt eine installierte Version als aktive Default-Version.

**Request-Body:**
```json
{ "version": "20.18.0" }
```

**Response 200:**
```json
{
  "stdout": "default -> 20.18.0 (-> v20.18.0)\n",
  "stderr": ""
}
```

**Implementierung:** Führt intern `nvm alias default <version>` aus, **nicht**
`nvm use <version>`.

**Warum?** `nvm use` ändert die aktive Version nur im aktuellen Shell-Prozess.
Da jeder API-Aufruf eine neue `bash`-Subshell spawnt, würde diese Änderung sofort
verloren gehen. `nvm alias default` schreibt die Präferenz dauerhaft in
`~/.nvm/alias/default` – ab dem nächsten Shell-Start ist automatisch die richtige
Version aktiv.

---

### `POST /api/versions/default`

Setzt eine Version oder einen Alias als nvm-Default.

**Request-Body:**
```json
{ "version": "22.11.0" }
```

Erlaubte Werte: alle gültigen Alias-Ziele – Semver (`22.11.0`, `v22.11.0`),
`node`, `stable`, `unstable`, LTS-Codename (`lts/iron`, `lts/*`).

**Response 200:** wie `/use`

**Unterschied zu `/use`:** `/use` akzeptiert nur einfache Versions-Strings;
`/default` akzeptiert zusätzlich LTS-Codenames (z.B. `lts/iron`), sodass
Default dauerhaft eine LTS-Linie tracken kann.

---

### `POST /api/versions/stable`

Setzt den `stable`-Alias auf eine Version oder einen Alias-Namen.

**Request-Body:**
```json
{ "version": "lts/iron" }
```

Erlaubte Werte: identisch mit `/default`.

**Response 200:**
```json
{ "stdout": "stable -> lts/iron (-> v20.20.2)\n", "stderr": "" }
```

---

### `POST /api/versions/uninstall`

Deinstalliert eine Node.js-Version.

**Request-Body:**
```json
{ "version": "18.20.7" }
```

**Response 200:**
```json
{
  "stdout": "Uninstalled node v18.20.7\n",
  "stderr": ""
}
```

---

### `POST /api/versions/aliases`

Erstellt oder überschreibt einen nvm-Alias.

**Request-Body:**
```json
{
  "name": "my-project",
  "target": "v18.18.0"
}
```

Erlaubte Namen: `[a-zA-Z][a-zA-Z0-9_-]{0,49}` – muss mit Buchstaben beginnen.
Erlaubte Ziele: `node`, `stable`, `unstable`, `lts/<codename>`, `lts/*`, `vX.Y.Z`, `X.Y.Z`.

**Hinweis:** `lts/`-Aliases können nicht über diesen Endpunkt gesetzt werden –
dafür gibt es `POST /api/versions/aliases/lts` (technischer Grund: nvm unterstützt
keine Unterverzeichnis-Aliases über `nvm alias`).

**Response 200:**
```json
{
  "stdout": "my-project -> v18.18.0\n",
  "stderr": ""
}
```

---

### `POST /api/versions/aliases/lts`

Setzt einen LTS-Alias direkt als Datei in `~/.nvm/alias/lts/<codename>`.

**Hintergrund:** `nvm alias lts/<codename> <version>` schlägt mit „Aliases in
subdirectories are not supported" fehl. Dieser Endpunkt schreibt die Alias-Datei
direkt, wie nvm es intern tut.

**Request-Body:**
```json
{
  "codename": "iron",
  "version": "20.17.0"
}
```

`codename` ist der Teil nach `lts/` (z.B. `iron`, `hydrogen`, `*`).
`version` ist eine valide Semver-Angabe mit oder ohne `v`-Präfix.

**Response 200:**
```json
{ "stdout": "", "stderr": "" }
```

---

### `DELETE /api/versions/aliases/:name`

Löscht einen Alias. `:name` darf **kein** Schrägstrich enthalten (kein `lts/`).

**URL-Parameter:** `name` – Name des zu löschenden Alias (URL-encoded)

**Beispiel:** `DELETE /api/versions/aliases/my-project`

**Response 200:**
```json
{
  "stdout": "Deleted alias my-project\n",
  "stderr": ""
}
```

**Response 400 – geschützter Alias:**
```json
{ "error": "Alias 'default' ist geschützt und kann nicht gelöscht werden." }
```

Geschützt (nicht löschbar): `default`, `node`, `stable`, `unstable`, `iojs`.

---

### `DELETE /api/versions/aliases/lts/:codename`

Löscht einen LTS-Alias durch direktes Entfernen der Datei `~/.nvm/alias/lts/<codename>`.

**URL-Parameter:** `codename` – Teil nach `lts/` (z.B. `iron`, `hydrogen`)

**Beispiel:** `DELETE /api/versions/aliases/lts/iron`

**Response 200:**
```json
{ "stdout": "", "stderr": "" }
```

**Response 400 – ungültiger Codename:**
```json
{ "error": "Ungültiger LTS-Codename." }
```

---

### `GET /api/versions/install/stream`

> 💡 **Konzept: Server-Sent Events (SSE)**
> Normalerweise schickt der Server **eine** Antwort und schließt die Verbindung.
> Bei einer Installation will man aber den Fortschritt *live* sehen. **SSE** hält
> die Verbindung offen und der Server sendet nach und nach einzelne Nachrichten
> (Events) im Format `data: <text>\n\n`. Der Browser liest diese mit der
> eingebauten Klasse `EventSource`. SSE ist einfacher als WebSockets und genau
> richtig, wenn nur der Server senden muss (Einbahnstraße Server → Browser).

Streaming-Endpunkt für Live-Output während `nvm install`.
Liefert die Ausgabe als **Server-Sent Events (SSE)**.

**Query-Parameter:** `version` – zu installierende Version (gleiche Validierung
wie `POST /install`)

**Beispiel:** `GET /api/versions/install/stream?version=22`

**Response-Header:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Event-Format:**
Jedes Event ist ein `data:`-Zeile mit JSON:

```
data: {"type":"stdout","line":"Downloading and installing node v22.11.0..."}

data: {"type":"stderr","line":""}

data: {"type":"done","line":"0"}
```

| `type` | Bedeutung |
|--------|-----------|
| `stdout` | Standardausgabe des nvm-Prozesses |
| `stderr` | Fehlerausgabe des nvm-Prozesses |
| `done` | Prozess beendet; `line` enthält den Exit-Code |

**Client-Verbindungstrennung:** Wenn der Browser die Verbindung trennt
(Tab geschlossen, Navigation), wird der nvm-Prozess via `child.kill()` beendet.

**Hinweis:** Dieser Endpunkt ist im Frontend noch nicht vollständig integriert
(MVP nutzt `POST /install`), aber vollständig implementiert und für spätere
UI-Erweiterungen vorbereitet.

---

## Validierungsregeln (Zusammenfassung)

Alle Eingaben werden serverseitig per Whitelist-Regex validiert, bevor sie an
die Shell übergeben werden. Der Client kann keine unsicheren Werte einschleusen.

| Eingabe | Regex | Erlaubte Beispiele |
|---------|-------|--------------------|
| Version (`/install`, `/use`, `/uninstall`) | `/^(node\|stable\|lts\/\*\|\d+(\.\d+){0,2})$/` | `node`, `lts/*`, `22`, `22.11`, `22.11.0` |
| Alias-Ziel (`/default`, `/stable`, `/aliases`) | `/^(node\|stable\|unstable\|lts\/[\w.*-]+\|v?\d+(\.\d+){0,2})$/` | `lts/iron`, `lts/*`, `v22.11.0`, `stable` |
| Alias-Name | `/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/` | `my-project`, `prod`, `default` |
| LTS-Codename | `/^[\w*-]+$/`, max. 30 Zeichen | `iron`, `hydrogen`, `*` |

---

## Routing-Übersicht

```
GET    /api/status
GET    /api/versions/installed
GET    /api/versions/remote
GET    /api/versions/aliases
GET    /api/versions/install/stream        ← SSE
POST   /api/versions/install
POST   /api/versions/use
POST   /api/versions/default
POST   /api/versions/stable
POST   /api/versions/uninstall
POST   /api/versions/aliases
POST   /api/versions/aliases/lts           ← LTS-Alias direkt schreiben
DELETE /api/versions/aliases/lts/:codename ← LTS-Alias direkt löschen
DELETE /api/versions/aliases/:name
```

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **API** | Schnittstelle zwischen zwei Programmen |
| **REST** | Architekturstil für Web-APIs auf Basis von HTTP-Verben und Ressourcen |
| **Endpunkt** | Eine konkrete, aufrufbare Adresse der API (Verb + Pfad) |
| **HTTP-Verb** | Art der Aktion: GET (lesen), POST (erstellen/auslösen), DELETE (löschen) |
| **Statuscode** | Numerisches Ergebnis: 200 OK, 400 Client-Fehler, 500 Server-Fehler |
| **Request-Body** | Die mitgesendeten Daten einer Anfrage (hier JSON) |
| **Response** | Die Antwort des Servers (Statuscode + Body) |
| **JSON** | Textformat für strukturierte Daten (`{ "key": "value" }`) |
| **Origin** | Kombination aus Protokoll + Host + Port |
| **CORS** | Mechanismus, der Cross-Origin-Anfragen kontrolliert erlaubt |
| **Proxy** | Vermittler, der Anfragen an ein anderes Ziel weiterleitet |
| **Validierung** | Prüfung, ob eine Eingabe den erlaubten Regeln entspricht |
| **SSE** | Server-Sent Events; fortlaufender Datenstrom Server → Browser |
| **idempotent** | Mehrfaches Ausführen hat denselben Effekt wie einmaliges (z.B. GET) |

---

## Verständnisfragen

1. Welches HTTP-Verb würdest du erwarten, um eine Ressource zu *löschen*? Welcher
   Endpunkt im Projekt nutzt es?
2. Warum gibt `GET /api/status` bei fehlendem nvm den Statuscode `200` mit
   `ok: false` zurück und nicht `500`?
3. Was bedeutet der Statuscode `400`, und in welchen Fällen liefert die API ihn?
4. Warum reicht es nicht, Eingaben nur im Frontend zu prüfen – warum muss der
   Server zusätzlich validieren?
5. Worin unterscheidet sich die Antwort von `GET /api/versions/install/stream`
   technisch von der Antwort von `POST /api/versions/install`?
6. `POST /use` und `POST /default` machen backend-seitig dasselbe. Warum existieren
   trotzdem zwei Endpunkte?

---

## Übungsaufgaben

> Für diese Übungen muss das Backend laufen (`cd apps/api && npm run dev`).

1. **API mit `curl` erkunden:** Rufe den Status ab und beobachte die Antwort:
   ```bash
   curl http://127.0.0.1:3789/api/status
   ```
   Rufe danach `GET /api/versions/installed` ab und vergleiche die JSON-Struktur
   mit der Dokumentation oben.
2. **POST mit Body senden:** Sende einen gültigen und einen ungültigen Versionswert
   und vergleiche Statuscode und Antwort:
   ```bash
   curl -X POST http://127.0.0.1:3789/api/versions/install \
     -H "Content-Type: application/json" -d '{"version":"22"}'

   curl -X POST http://127.0.0.1:3789/api/versions/install \
     -H "Content-Type: application/json" -d '{"version":"22; rm -rf ~"}'
   ```
   Welche Antwort liefert der zweite Aufruf, und welche Code-Stelle ist dafür
   verantwortlich (siehe [BACKEND.md](BACKEND.md), Validatoren)?
3. **Endpunkt-Tabelle ergänzen:** Erstelle eine eigene Tabelle, die jeden Endpunkt
   einem HTTP-Verb und der Frage "verändert er Daten?" (ja/nein) zuordnet.
4. **Fehlerformat verstehen:** Provoziere einen Fehler (z.B. ungültiger Alias-Name
   bei `POST /api/versions/aliases`) und ordne die Felder `error`, `stdout`,
   `stderr` der Antwort den jeweiligen Code-Stellen zu.
5. **Integrationstests lesen:** Sieh dir `apps/api/src/routes/nvm.routes.spec.ts`
   an. Welche Endpunkte werden getestet, und wie werden die nvm-Aufrufe dabei
   ersetzt (gemockt)?
