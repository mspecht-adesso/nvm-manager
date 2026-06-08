# REST-API – Aktueller Stand (Lernunterlagen)

> **Stand:** Version 0.8.0 · 2026-06-05
> **Verhältnis zu [API.md](API.md):** Das Kerndokument erklärt REST-Grundlagen
> ausführlich (HTTP-Verben, Statuscodes, SSE). Dieses Dokument listet den
> **tatsächlich vorhandenen Vertrag** und erklärt zu jedem Endpunkt knapp das
> **wie** (Aufruf) und **warum** (Designgrund).

## Lernziele

Nach dem Durcharbeiten kannst du:

- alle heute existierenden Endpunkte aufzählen und ihrem HTTP-Verb zuordnen
- das einheitliche Fehlerformat erklären
- begründen, **warum** es scheinbar doppelte Endpunkte gibt (`/use` vs. `/default`)
- den Status des SSE-Endpunkts korrekt einordnen

## Voraussetzungen

- [API.md](API.md) gelesen oder REST-Grundlagen bekannt
- Backend läuft (`cd apps/api && npm run dev`)

## Eckdaten (Ist-Zustand)

- **Base URL:** `http://127.0.0.1:3789`
- **Präfix:** alle Endpunkte unter `/api`
- **Format:** JSON (Request-Body und Response)
- **Auth:** keine (nur lokal erreichbar)
- **CORS:** ausschließlich `http://localhost:4201`

> 💡 **Konzept: Warum keine Authentifizierung?**
> Die API ist an `127.0.0.1` gebunden und damit nur vom eigenen Rechner aus
> erreichbar. Ein Login würde keine zusätzliche Sicherheit bringen, aber Komplexität
> hinzufügen. Die *eigentliche* Schutzschicht ist die Eingabevalidierung vor jedem
> Shell-Aufruf – nicht eine Zugangskontrolle.

## Vollständige Endpunkt-Liste (aktuell)

```
GET    /api/status                          ← nvm-Version + neueste verfügbare Version
POST   /api/nvm/update                      ← nvm per git aktualisieren
POST   /api/nvm/open-dir                    ← NVM_DIR im Dateimanager öffnen
GET    /api/versions/installed              ← installierte Versionen (Dateisystem)
GET    /api/versions/remote                 ← verfügbare Versionen (nodejs.org)
GET    /api/versions/aliases                ← alle Aliase
GET    /api/versions/install/stream         ← SSE-Live-Output (vorbereitet)
POST   /api/versions/install                ← Version installieren
POST   /api/versions/use                    ← Version aktivieren (persistent)
POST   /api/versions/default                ← Default setzen (auch LTS-Codename)
POST   /api/versions/stable                 ← stable-Alias setzen
POST   /api/versions/uninstall              ← Version deinstallieren
POST   /api/versions/aliases                ← Alias erstellen/überschreiben
POST   /api/versions/aliases/lts            ← LTS-Alias als Datei schreiben
DELETE /api/versions/aliases/lts/:codename  ← LTS-Alias löschen
DELETE /api/versions/aliases/:name          ← Alias löschen
```

## Einheitliches Fehlerformat

Bei HTTP 400 oder 500 antwortet die API immer im selben Schema:

```json
{ "error": "Fehlermeldung", "stdout": "", "stderr": "" }
```

`stdout`/`stderr` sind nur bei nvm-Ausführungsfehlern gefüllt (rohe Shell-Ausgabe).

**Wie es entsteht:** Route-Handler fangen Fehler per `try/catch` und reichen sie
per `next(err)` an die zentrale `errorMiddleware` weiter. **Warum zentral?** So gibt
es genau *eine* Stelle, die das Antwortformat bestimmt – kein Endpunkt muss es
selbst kennen.

## Endpunkte – wie & warum

| Endpunkt | Wie aufrufen | Warum so gestaltet |
|----------|--------------|--------------------|
| `GET /status` | ohne Body | 200 + `ok:false` bei fehlendem nvm (kein 500) – fehlendes nvm ist erwartet |
| `POST /nvm/update` | ohne Body | git-Upgrade, weil `nvm upgrade` versionsübergreifend unzuverlässig ist |
| `POST /nvm/open-dir` | ohne Body | kein Nutzer-Input → nur serverseitiger Pfad, injektionssicher |
| `GET /versions/installed` | ohne Body | liest Dateisystem (< 10 ms); `stdout` daher immer leer |
| `GET /versions/remote` | ohne Body | Netzwerkabfrage; neueste Versionen zuerst sortiert |
| `GET /versions/aliases` | ohne Body | liefert `editable`/`deletable`-Flags für die UI |
| `POST /versions/install` | `{ "version": "22" }` | blockierend (Timeout 3 min); Whitelist-validiert |
| `POST /versions/use` | `{ "version": "20.18.0" }` | ruft intern `nvm alias default` → persistent |
| `POST /versions/default` | `{ "version": "lts/iron" }` | akzeptiert zusätzlich LTS-Codenames |
| `POST /versions/stable` | `{ "version": "lts/iron" }` | setzt den `stable`-Alias |
| `POST /versions/uninstall` | `{ "version": "18.20.7" }` | entfernt eine Version |
| `POST /versions/aliases` | `{ "name", "target" }` | generischer Alias (kein `lts/`) |
| `POST /versions/aliases/lts` | `{ "codename", "version" }` | schreibt Datei direkt – nvm unterstützt `lts/`-Aliase nicht über `nvm alias` |
| `DELETE /versions/aliases/:name` | URL-Param | blockt geschützte Aliase mit 400 |
| `DELETE /versions/aliases/lts/:codename` | URL-Param | löscht die Alias-Datei direkt |

### Warum `/use` und `/default` getrennt?

> 💡 **Konzept: `nvm use` ist flüchtig**
> `nvm use X` ändert die aktive Version nur in der *aktuellen* Shell-Session. Da
> jeder API-Aufruf eine neue Subshell startet, wäre der Effekt sofort weg. Deshalb
> ruft `/use` intern `nvm alias default X` auf und schreibt die Wahl dauerhaft in
> `~/.nvm/alias/default`.

`/use` nimmt nur einfache Versions-Strings; `/default` akzeptiert zusätzlich
LTS-Codenames (`lts/iron`), damit der Default dauerhaft eine LTS-Linie verfolgen kann.

## Status des SSE-Endpunkts

> 💡 **Konzept: Server-Sent Events (SSE)**
> Statt einer einzelnen Antwort hält der Server die Verbindung offen und schickt
> nach und nach Events im Format `data: <text>\n\n`. Der Browser liest sie mit
> `EventSource`. Ideal für Einbahn-Kommunikation Server → Browser (z.B. Live-Fortschritt).

`GET /api/versions/install/stream?version=22` ist **vollständig implementiert und
getestet**: Es streamt `stdout`/`stderr`/`done`-Events und beendet den nvm-Prozess
(`child.kill()`), wenn der Client die Verbindung trennt. **Aktuell nutzt das
Frontend diesen Endpunkt jedoch nicht** – es ruft den blockierenden `POST /install`
auf. Der Stream steht für eine spätere Live-Fortschritts-UI bereit.

## Validierungsregeln (aktuell aktiv)

| Eingabe | Regex (Kurzform) | Erlaubte Beispiele |
|---------|------------------|--------------------|
| Version | `node\|stable\|lts/*\|\d+(.\d+){0,2}` | `node`, `lts/*`, `22`, `22.11.0` |
| Alias-Ziel | `node\|stable\|unstable\|lts/<x>\|v?\d…` | `lts/iron`, `v22.11.0`, `stable` |
| Alias-Name | `[a-zA-Z][a-zA-Z0-9_-]{0,49}` | `my-project`, `prod` |
| LTS-Codename | `[\w*-]+` (max. 30) | `iron`, `hydrogen`, `*` |

## Verständnisfragen

1. Warum liefert `GET /api/status` bei fehlendem nvm den Code 200?
2. Worin unterscheiden sich `POST /use` und `POST /default` fachlich?
3. Welche Endpunkte verändern Daten, welche nur lesen?
4. Ist der SSE-Endpunkt funktionsfähig – und wird er aktuell vom Frontend genutzt?

## Übungsaufgaben

1. **API erkunden:** Rufe nacheinander `/api/status` und `/api/versions/installed`
   per `curl` ab und vergleiche die JSON-Struktur.
2. **Fehlerformat provozieren:** Sende einen ungültigen Alias-Namen an
   `POST /api/versions/aliases` und ordne `error`/`stdout`/`stderr` zu.
3. **SSE testen:** Rufe `curl -N "http://127.0.0.1:3789/api/versions/install/stream?version=22"`
   auf und beobachte die einzelnen `data:`-Events.
