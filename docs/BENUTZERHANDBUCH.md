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
# Im Projektordner – installiert alle Abhängigkeiten (Root, API und Frontend)
npm run install:all

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
│   nvm Manager         Aktiv: v22.x  │  ← Header mit aktiver Versionsanzeige
├─────────────────────────────────────┤
│  Status                             │  ← API-Status, nvm-Version, NVM_DIR
├─────────────────────────────────────┤
│  Aktion                             │  ← Eingabefeld + Aktions-Buttons
├─────────────────────────────────────┤
│  Installierte Versionen             │  ← Tabelle mit Verwenden-Button pro Zeile
├─────────────────────────────────────┤
│  Aliases                            │  ← Aliases anzeigen, bearbeiten, anlegen
├─────────────────────────────────────┤
│  Verfügbare Versionen               │  ← Alle Remote-Versionen mit Suchfeld
├─────────────────────────────────────┤
│  Log                                │  ← Letzte Aktionen und Fehlermeldungen
└─────────────────────────────────────┘
```

---

## Funktionen im Detail

### Status prüfen

Die **Status-Card** zeigt beim Start automatisch:

- **API erreichbar**: Grüner/roter Indikator
- **nvm-Version**: z.B. `0.39.7`
- **NVM_DIR**: Pfad zur nvm-Installation (z.B. `/Users/name/.nvm`)

Der Header zeigt zudem die aktuell aktive Node.js-Version als Badge an (z.B. `Aktiv: v22.11.0`).

Falls die API nicht erreichbar ist, stellen Sie sicher dass das Backend läuft (`npm run dev:api`).

---

### Installierte Versionen anzeigen

Klicken Sie auf **Aktualisieren** in der Card „Installierte Versionen".

Die Tabelle zeigt:

| Version | Status | Aktion |
|---------|--------|--------|
| v22.11.0 (Aktiv, Default) | In Verwendung | Verwenden |
| v20.5.0 | Installiert | Verwenden |

- **Aktiv**: Die aktuell in Verwendung befindliche Version
- **Default**: Wird in neuen Terminal-Fenstern automatisch genutzt
- **Verwenden**: Aktiviert die jeweilige Version direkt aus der Tabelle

Unter der Tabelle wird zusätzlich die rohe `nvm ls`-Ausgabe als aufklappbares Element angezeigt.

---

### Node-Version installieren

**Über das Aktionsfeld:**

1. Geben Sie die gewünschte Version in das Eingabefeld ein.
2. Klicken Sie auf **Installieren**.
3. Der Button zeigt „Bitte warten …" während der Installation.
4. Nach Abschluss werden die installierten Versionen automatisch aktualisiert.

**Über die Verfügbare-Versionen-Liste:**

Klicken Sie in der Card „Verfügbare Versionen" direkt auf **Installieren** neben der gewünschten Version.

**Erlaubte Versionseingaben:**

| Eingabe | Bedeutung |
|---------|-----------|
| `22` | Neueste Node 22.x.x |
| `22.11` | Neueste Node 22.11.x |
| `22.11.0` | Exakte Version |
| `node` | Neueste verfügbare Version |
| `stable` | Neueste stabile Version |
| `lts/*` | Neueste LTS-Version |

> Die Installation kann mehrere Minuten dauern (Netzwerk-Download).

---

### Version als aktiv setzen (`nvm use`)

**Über das Aktionsfeld:**

1. Gewünschte Version eingeben.
2. **Verwenden** klicken.

**Direkt aus der Versions-Tabelle:**

Klicken Sie in der Zeile der gewünschten Version auf den **Verwenden**-Button (bei der bereits aktiven Version ist der Button deaktiviert).

> **Wichtiger Hinweis:** `nvm use` gilt nur für die aktuelle Server-Session.
> Bereits geöffnete Terminal-Fenster sind **nicht** betroffen. Für neue Terminals
> verwenden Sie stattdessen **Als Default setzen** oder passen Sie den `default`-Alias an.

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

### Aliases verwalten

nvm unterstützt benannte Aliases für Versionen (z.B. `default`, `my-project`). Die **Aliases-Card** ermöglicht die vollständige Verwaltung dieser Aliases.

#### Aliases anzeigen

Die Tabelle zeigt alle vorhandenen Aliases mit:

| Name | Ziel | Aufgelöst | Aktion |
|------|------|-----------|--------|
| `default` | `22` | `v22.11.0` | Bearbeiten |
| `my-project` | `18.18.0` | `v18.18.0` | Bearbeiten / Löschen |
| `node` | `stable` | `v22.11.0` | *(schreibgeschützt)* |

- **Name**: Der Alias-Name
- **Ziel**: Die hinterlegte Versionsangabe
- **Aufgelöst**: Die konkret zugeordnete Node.js-Version

#### Alias bearbeiten

Klicken Sie bei einem bearbeitbaren Alias auf **Bearbeiten**, geben Sie das neue Ziel ein und bestätigen mit **Speichern** (oder `Enter`). Mit **Abbrechen** oder `Escape` verwerfen Sie die Änderung.

> Der `default`-Alias kann bearbeitet, aber nicht gelöscht werden.
> Systemaliases (`node`, `stable`, `unstable`) und LTS-Aliases (`lts/*`) sind schreibgeschützt.

#### Alias löschen

Klicken Sie bei einem löschbaren Alias auf **Löschen** und bestätigen Sie die Sicherheitsabfrage.

#### Neuen Alias anlegen

Im Bereich „Neuen Alias anlegen" am Ende der Aliases-Card:

1. **Name** eingeben (z.B. `my-project`)
2. **Ziel** eingeben (z.B. `18`, `lts/*`, `v22.11.0`)
3. **Anlegen** klicken (oder `Enter` im Zielfeld)

---

### Verfügbare Versionen (Remote)

Klicken Sie auf **Laden** in der Card „Verfügbare Versionen".

Dieser Vorgang kann einige Sekunden dauern (Netzwerkanfrage an nodejs.org).

**Funktionen der Liste:**

- **Suchfeld**: Filtert nach Versionsnummer oder LTS-Name (z.B. `22`, `20`, `lts`, `iron`)
- **Standardansicht**: Zeigt die 30 neuesten nicht-installierten Versionen
- **Suchergebnisse**: Zeigt bis zu 100 Treffer aus allen verfügbaren Versionen
- **Typ**: LTS-Versionen sind mit einem Badge (`LTS: Iron`) markiert, Current-Versionen mit „Current"
- **Installieren**: Direkt-Button pro Zeile installiert die Version sofort

Bereits installierte Versionen werden automatisch ausgeblendet.

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

**Lösung:** Internetverbindung prüfen. Der Befehl `nvm ls-remote` benötigt Netzwerkzugriff.

---

### „Alias ist schreibgeschützt"

**Ursache:** Die Aliases `node`, `stable`, `unstable` und alle `lts/*`-Aliases werden von nvm intern verwaltet und können nicht bearbeitet oder gelöscht werden.

**Lösung:** Nur benutzerdefinierte Aliases (z.B. `default`, eigene Namen) bearbeiten.

---

## Sicherheitshinweise

- Das Backend ist **ausschließlich auf `127.0.0.1`** erreichbar – kein Zugriff von anderen Geräten im Netzwerk.
- Es werden **nur fest definierte nvm-Befehle** ausgeführt – keine freie Shell-Ausführung.
- Alle Versionseingaben und Alias-Namen werden streng validiert – Sonderzeichen werden abgelehnt.
- Schreibgeschützte System-Aliases können nicht überschrieben oder gelöscht werden.
- Das Tool ist **nicht für den Einsatz auf einem öffentlichen Server** gedacht.

---

## Bekannte Einschränkungen

### `nvm use` betrifft nur die Backend-Session

`nvm use` ändert die aktive Node-Version nur für den Backend-Prozess selbst.
Bereits geöffnete Terminals oder andere Prozesse sind **nicht** betroffen.

**Empfehlung:** Für dauerhaften Effekt **„Als Default setzen"** verwenden oder den `default`-Alias bearbeiten.

### Kein automatisches Parsen aller nvm-Ausgaben

Bei ungewöhnlichen nvm-Konfigurationen kann das Parsen der installierten Versionen
unvollständig sein. Die **rohe Ausgabe** (`nvm ls`) wird immer korrekt angezeigt.

### Keine `.nvmrc`-Unterstützung

Die Verwaltung von `.nvmrc`-Dateien pro Projekt ist für eine spätere Version geplant.

---

*Stand: Juni 2026*
