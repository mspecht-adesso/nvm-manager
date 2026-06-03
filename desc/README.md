# nvm-manager – Technische Dokumentation (Lernunterlagen)

Dieses Verzeichnis enthält detaillierte technische Beschreibungen der
Implementierung und Architektur des nvm-manager Projekts. Die Dokumente sind
für die **Aus- und Weiterbildung** aufbereitet: Sie erklären nicht nur *was*
der Code tut, sondern auch *warum* er so gebaut ist und *welche Konzepte*
dahinterstehen.

## Wie diese Unterlagen aufgebaut sind

Jedes Dokument folgt der gleichen didaktischen Struktur:

- **Lernziele** – Was du nach dem Durcharbeiten verstanden haben solltest
- **Voraussetzungen** – Welches Vorwissen hilfreich ist
- **Konzept-Boxen** (mit dem Symbol 💡) – Erklären ein zugrundeliegendes Konzept
  (z.B. Promise, Observable, CORS) in wenigen Sätzen, bevor es im Code auftaucht
- **Code-Erklärungen** – Der eigentliche Inhalt mit Bezug zu den Quelldateien
- **Glossar** – Nachschlagewerk der Fachbegriffe
- **Verständnisfragen** – Zur Selbstkontrolle
- **Übungsaufgaben** – Zum aktiven Anwenden und Erweitern

> **Lern-Tipp:** Öffne immer die genannte Quelldatei parallel im Editor und lies
> den echten Code mit. Die Dokumente nennen Dateipfade und Funktionsnamen
> bewusst, damit du hin- und herspringen kannst.

## Empfohlener Lernpfad

Die Reihenfolge ist so gewählt, dass jedes Dokument auf dem vorherigen aufbaut:

1. **[BACKEND.md](BACKEND.md)** – Wie führt eine Node.js/Express-Anwendung sicher
   Shell-Befehle aus? Hier lernst du Server-Grundlagen, Prozesssteuerung und
   Sicherheit kennen.
2. **[API.md](API.md)** – Welche Schnittstelle (REST) bietet das Backend an?
   Hier lernst du HTTP-Verben, Request/Response-Design und Eingabevalidierung.
3. **[FRONTEND.md](FRONTEND.md)** – Wie konsumiert eine moderne Angular-Anwendung
   diese API? Hier lernst du Komponenten, Signals und Datenfluss kennen.

## Das Projekt in einem Satz

nvm-manager ist ein lokales Web-Dashboard, das die Kommandozeilen-Funktion **nvm**
(Node Version Manager) über eine grafische Oberfläche bedienbar macht – aufgeteilt
in ein **Express-Backend** (führt nvm aus) und ein **Angular-Frontend** (zeigt die UI).

## Schnelleinstieg (zum Mitexperimentieren)

Das Projekt besteht aus zwei unabhängigen Apps:

```bash
# Backend starten
cd apps/api && npm run dev     # http://127.0.0.1:3789

# Frontend starten (in separatem Terminal)
cd apps/web && npm start       # http://localhost:4201
```

Das Frontend proxyt `/api` automatisch an den Backend-Port.

## Übergreifendes Glossar

Begriffe, die in mehreren Dokumenten vorkommen:

| Begriff | Kurzerklärung |
|---------|---------------|
| **nvm** | *Node Version Manager*; ein Shell-Werkzeug zum Installieren und Wechseln mehrerer Node.js-Versionen |
| **Backend** | Server-Teil der Anwendung; hier nicht im Browser sichtbar, läuft als Node.js-Prozess |
| **Frontend** | Browser-Teil der Anwendung; die sichtbare Oberfläche (UI) |
| **API** | *Application Programming Interface*; die definierte Schnittstelle, über die Frontend und Backend kommunizieren |
| **REST** | Architekturstil für Web-APIs; nutzt HTTP-Verben (GET, POST, DELETE) auf Ressourcen |
| **Monorepo** | Ein Git-Repository, das mehrere Anwendungen enthält (hier: `apps/api`, `apps/web`, `apps/e2e`) |
| **TypeScript** | JavaScript mit statischen Typen; wird vor der Ausführung in JavaScript übersetzt |
