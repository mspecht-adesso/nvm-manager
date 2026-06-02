# nvm Manager – Benutzerhandbuch

> Lokales Web-Tool zur Verwaltung von Node.js-Versionen via nvm

---

## Inhaltsverzeichnis

1. [Was ist nvm Manager?](#was-ist-nvm-manager)
2. [Voraussetzungen](#voraussetzungen)
3. [Installation und Start](#installation-und-start)
4. [Benutzeroberfläche](#benutzeroberfläche)
5. [Funktionen im Detail](#funktionen-im-detail)
6. [Häufige Fehler und Lösungen](#häufige-fehler-und-lösungen)
7. [Sicherheitshinweise](#sicherheitshinweise)
8. [Bekannte Einschränkungen](#bekannte-einschränkungen)

---

## Was ist nvm Manager?

**nvm Manager** ist ein lokales Web-Tool für macOS und Linux. Es ermöglicht die
Verwaltung von Node.js-Versionen über eine grafische Browser-Oberfläche, ohne
dass Sie Terminalbefehle kennen müssen.

Unter der Haube nutzt es [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm),
das auf Ihrem System installiert sein muss.

---

## Voraussetzungen

| Voraussetzung | Prüfbefehl | Mindestversion |
|---------------|------------|----------------|
| macOS oder Linux | – | – |
| nvm | `nvm --version` | beliebig |
| Node.js | `node --version` | ≥ 18 |
| npm | `npm --version` | ≥ 9 |

Falls `nvm --version` einen Fehler zeigt, folgen Sie der
[nvm-Installationsanleitung](https://github.com/nvm-sh/nvm#installing-and-updating).

---

## Installation und Start

### Erstmalige Installation

```bash
# Im Projektordner
npm install

# Frontend und Backend gleichzeitig starten
npm run dev
```

Öffnen Sie dann Ihren Browser:

- **Frontend:** [http://localhost:4200](http://localhost:4200)
- **API (nur intern):** http://127.0.0.1:3789

### Nur Backend starten

```bash
npm run dev:api
```

### Nur Frontend starten

```bash
npm run dev:web
```

---

## Benutzeroberfläche

Die Oberfläche gliedert sich in folgende Bereiche:

```
┌─────────────────────────────────────┐
│           nvm Manager               │  ← Header
├─────────────────────────────────────┤
│  Status-Card                        │  ← API-Status, nvm-Version, NVM_DIR
├─────────────────────────────────────┤
│  Aktionen-Card                      │  ← Eingabefeld + Aktions-Buttons
├─────────────────────────────────────┤
│  Installierte Versionen             │  ← Tabelle + rohe Ausgabe
├─────────────────────────────────────┤
│  Remote LTS-Versionen               │  ← Laden und anzeigen
├─────────────────────────────────────┤
│  Log                                │  ← Letzte Aktion, Fehlermeldungen
└─────────────────────────────────────┘
```

---

## Funktionen im Detail

### Status prüfen

Die **Status-Card** zeigt beim Start automatisch:

- **API erreichbar**: Grüner/roter Indikator
- **nvm-Version**: z.B. `0.39.7`
- **NVM_DIR**: Pfad zur nvm-Installation (z.B. `/Users/name/.nvm`)

Falls die API nicht erreichbar ist, stellen Sie sicher dass das Backend läuft (`npm run dev:api`).

---

### Installierte Versionen anzeigen

Klicken Sie auf **Aktualisieren** in der Card „Installierte Versionen".

Die Tabelle zeigt:

| Version | Aktiv | Default |
|---------|-------|---------|
| 22.11.0 | ✓ | ✓ |
| 20.5.0 | – | – |

Darunter wird zusätzlich die rohe `nvm ls`-Ausgabe angezeigt.

---

### Remote LTS-Versionen anzeigen

Klicken Sie auf **Laden** in der Card „Remote LTS-Versionen".

Dieser Vorgang kann einige Sekunden dauern (Netzwerkanfrage an nodejs.org).
Die Ausgabe listet alle verfügbaren LTS-Versionen.

---

### Node-Version installieren

1. Geben Sie die gewünschte Version in das Eingabefeld ein.
2. Klicken Sie auf **Installieren**.
3. Der Button wird während der Installation deaktiviert.
4. Nach Abschluss werden die installierten Versionen automatisch aktualisiert.

**Erlaubte Versionseingaben:**

| Eingabe | Bedeutung |
|---------|-----------|
| `22` | Neueste Node 22.x.x |
| `22.11` | Neueste Node 22.11.x |
| `22.11.0` | Exakte Version |
| `node` | Neueste verfügbare Version |
| `stable` | Neueste stabile Version |
| `lts/*` | Neueste LTS-Version |

> ⚠️ Die Installation kann mehrere Minuten dauern.

---

### Version als aktiv setzen (`nvm use`)

1. Gewünschte Version eingeben.
2. **Verwenden** klicken.

> ⚠️ **Wichtiger Hinweis:** `nvm use` gilt nur für die aktuelle Server-Session.
> Bereits geöffnete Terminal-Fenster sind **nicht** betroffen. Für neue Terminals
> verwenden Sie stattdessen **Als Default setzen**.

---

### Default-Version setzen

1. Gewünschte Version eingeben.
2. **Als Default setzen** klicken.

Die Default-Version wird automatisch in neuen Terminal-Fenstern verwendet.
Äquivalent zu `nvm alias default <version>`.

---

### Version deinstallieren

1. Zu deinstallierende Version eingeben.
2. **Deinstallieren** klicken.
3. **Sicherheitsabfrage bestätigen** – ohne Bestätigung wird nichts gelöscht.

> Die aktive Version kann nicht deinstalliert werden. Setzen Sie vorher eine andere Version aktiv.

---

## Häufige Fehler und Lösungen

### „API nicht erreichbar"

**Ursache:** Das Backend läuft nicht.

**Lösung:**
```bash
npm run dev:api
# Warten bis „nvm manager api läuft auf http://127.0.0.1:3789" erscheint
```

---

### „nvm: command not found"

**Ursache:** nvm ist nicht installiert oder `NVM_DIR` ist nicht korrekt gesetzt.

**Lösung:**
```bash
# nvm-Installation prüfen
ls ~/.nvm/nvm.sh

# Falls vorhanden, NVM_DIR setzen
export NVM_DIR="$HOME/.nvm"
```

---

### „Ungültige Versionseingabe"

**Ursache:** Das Backend lehnt nicht unterstützte Versionseingaben ab.

**Lösung:** Nur erlaubte Formate verwenden (siehe Tabelle oben). Keine Sonderzeichen.

---

### Installation hängt / kein Fortschritt

**Ursache:** `nvm install` lädt die Version herunter – das kann bei langsamer Verbindung dauern.

**Lösung:** Warten Sie bis zu 3 Minuten. Das Backend hat ein Timeout von 3 Minuten.

---

### Remote-Versionen laden schlägt fehl

**Ursache:** Keine Internetverbindung oder nodejs.org nicht erreichbar.

**Lösung:** Internetverbindung prüfen. Der Befehl `nvm ls-remote --lts` benötigt Netzwerkzugriff.

---

## Sicherheitshinweise

- Das Backend ist **ausschließlich auf `127.0.0.1`** erreichbar – kein Zugriff von anderen Geräten im Netzwerk.
- Es werden **nur fest definierte nvm-Befehle** ausgeführt – keine freie Shell-Ausführung.
- Alle Versionseingaben werden streng validiert – Sonderzeichen werden abgelehnt.
- Das Tool ist **nicht für den Einsatz auf einem öffentlichen Server** gedacht.

---

## Bekannte Einschränkungen

### `nvm use` betrifft nur die Backend-Session

`nvm use` ändert die aktive Node-Version nur für den Backend-Prozess selbst.
Bereits geöffnete Terminals oder andere Prozesse sind **nicht** betroffen.

**Empfehlung:** Für dauerhaften Effekt **„Als Default setzen"** verwenden.

### Kein automatisches Parsen aller nvm-Ausgaben

Bei ungewöhnlichen nvm-Konfigurationen kann das Parsen der installierten Versionen
unvollständig sein. Die **rohe Ausgabe** (`nvm ls`) wird immer korrekt angezeigt.

### Keine `.nvmrc`-Unterstützung (MVP)

Die Verwaltung von `.nvmrc`-Dateien pro Projekt ist für eine spätere Version geplant.

---

*Stand: automatisch generiert – bitte bei Änderungen am Tool aktualisieren.*
