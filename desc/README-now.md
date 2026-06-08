# Aktueller Stand – nvm-manager (Lernunterlagen)

> **Stand:** Version 0.8.0 · 2026-06-05
> **Zweck dieses Dokuments:** Eine Momentaufnahme („now") des Projekts. Während
> die Kerndokumente [BACKEND.md](BACKEND.md), [API.md](API.md) und
> [FRONTEND.md](FRONTEND.md) die Konzepte zeitlos erklären, beschreibt diese
> Datei **wie** das Projekt *heute* tatsächlich gebaut ist und **warum** es an
> diesen Punkt gekommen ist.

## Lernziele

Nach dem Durcharbeiten dieses Dokuments kannst du:

- den aktuellen Funktionsumfang der Anwendung benennen (was kann ein Nutzer heute tun?)
- die aktuelle technische Architektur über alle drei Apps hinweg einordnen
- erklären, **wie** sich der Code seit der ersten Version weiterentwickelt hat und **warum**
- unterscheiden, was fertig ist und was bewusst nur *vorbereitet* wurde

## Voraussetzungen

- Du hast einen groben Überblick über das Projekt (siehe [README.md](README.md))
- Grundbegriffe Frontend/Backend/API sind dir vertraut

> 💡 **Konzept: Was bedeutet „Stand der Entwicklung"?**
> Ein Software-Projekt ist nie „fertig", sondern befindet sich immer in einem
> bestimmten *Zustand*: Welche Features funktionieren? Welche Technik-Entscheidungen
> gelten aktuell? Was ist Schuld (technische Schulden) und was ist bewusst offen
> gelassen? Diese Momentaufnahme festzuhalten hilft beim Lernen, weil man so den
> Unterschied zwischen *Idealbild* (Konzept) und *Ist-Zustand* (Code) sieht.

## Das Projekt in einem Satz

nvm-manager ist ein **lokales Web-Dashboard**, das die Kommandozeilen-Funktion
**nvm** (Node Version Manager) über eine grafische Oberfläche bedienbar macht –
aufgeteilt in ein **Express-Backend** (führt nvm aus) und ein **Angular-Frontend**
(zeigt die UI).

## Was die Anwendung heute kann

Diese Funktionen sind **vollständig nutzbar** (UI + API + Tests):

| Funktion | Wie es der Nutzer bedient | Warum es so gelöst ist |
|----------|---------------------------|------------------------|
| nvm-Status anzeigen | Status-Card beim Start | Sofortige Rückmeldung, ob nvm überhaupt verfügbar ist |
| nvm selbst aktualisieren | „Aktualisieren"-Button, wenn neuere Version existiert | git-basiertes Upgrade, weil `nvm upgrade` versionsübergreifend unzuverlässig ist |
| NVM_DIR im Dateimanager öffnen | Ordner-Icon neben dem Pfad | Schneller Sprung ins Verzeichnis ohne Terminal |
| Installierte Versionen auflisten | Tabelle „Installierte Versionen" | Liest direkt das Dateisystem → < 10 ms statt ~20 s |
| Version installieren | Eingabefeld + „Installieren" | Whitelist-validierte Eingabe, blockierender Aufruf mit Fortschritts-Modal |
| Version aktivieren / als Default setzen | „Verwenden" / „Default" | Schreibt persistent `nvm alias default`, nicht das flüchtige `nvm use` |
| Version deinstallieren | „Deinstallieren" (mit Schutz für aktive/System-Version) | Verhindert das Entfernen der gerade aktiven Version |
| Verfügbare Versionen durchsuchen | „Verfügbare Versionen" (lazy geladen) | Netzwerkabfrage erst auf Klick, um den Start schnell zu halten |
| Aliase verwalten (CRUD) | Aliases-Card inkl. LTS-Aliase | Inline-Bearbeitung mit Dropdown statt Freitext |
| Aktivitätslog | Log-Card (max. 20 Einträge) | Transparenz über jede ausgeführte Aktion |
| Hell-/Dunkel-Modus | Toggle im Header | Persistiert in `localStorage`, respektiert System-Präferenz |

### Bewusst nur *vorbereitet* (noch nicht in der UI)

> 💡 **Konzept: „Vorbereitet, aber nicht verdrahtet"**
> Manchmal baut man Infrastruktur, die noch keine sichtbare Funktion hat – als
> Fundament für später. Das ist kein Fehler, sondern eine Investition. Wichtig ist
> nur, es klar zu kennzeichnen, damit niemand denkt, es sei „kaputt".

- **SSE-Streaming der Installation** (`GET /api/versions/install/stream`) ist im
  Backend vollständig implementiert und getestet, aber das Frontend nutzt weiterhin
  den blockierenden `POST /install`. *Warum?* Das MVP kam mit dem einfacheren Pfad
  schneller ans Ziel; der Streaming-Endpunkt steht für eine spätere Live-Fortschritts-Anzeige bereit.
- **Angular-Router** ist aktiviert (`provideRouter`), die Routen-Liste ist aber leer.
  *Warum?* Die App hat nur eine Ansicht; die Router-Infrastruktur ist Fundament für
  z.B. eine spätere Einstellungs-Seite.

## Architektur auf einen Blick (aktuell)

```
nvm-manager/  (Monorepo, npm workspaces-artig über Prefix-Skripte)
├── apps/api/   Express 5 · TypeScript · Port 3789 (bind 127.0.0.1)
├── apps/web/   Angular 21 · Standalone · Signals · Port 4201
├── apps/e2e/   Playwright (Chromium) · Smoke- + Flow-Tests
├── desc/       Diese Lernunterlagen (Markdown + HTML)
└── docs/       Benutzerhandbuch
```

### Technologiestand (aktuell installiert)

| Bereich | Technologie | Version |
|---------|-------------|---------|
| Frontend-Framework | Angular | ^21.2.0 |
| Backend-Framework | Express | ^5.2.1 |
| Sprache | TypeScript | ~5.9 (web) / ^6.0 (api) |
| Tests | Vitest + Supertest + Playwright | ^4.x / ^7.x |
| Linting | ESLint 10 + angular-eslint + typescript-eslint | flat config |
| Reaktivität | Angular Signals (zoneless) | — |

> 💡 **Konzept: „zoneless"**
> Ältere Angular-Apps brauchten die Bibliothek `zone.js`, um zu erkennen, wann sich
> Daten geändert haben. Diese App kommt **ohne** aus: Sie nutzt durchgängig Signals,
> wodurch Angular präzise weiß, was sich geändert hat. Das spart Bundle-Größe und
> macht das Verhalten vorhersehbarer.

## Wie sich der Code entwickelt hat (und warum)

Die wichtigsten Wendepunkte – chronologisch verdichtet aus dem
[CHANGELOG](../CHANGELOG.md):

1. **0.1.0 – Grundgerüst.** Frontend + Backend + Monorepo stehen. *Warum zuerst?*
   Ein durchgehender „vertikaler Schnitt" (UI → API → nvm) beweist, dass die
   Gesamtidee funktioniert.
2. **0.2.x – Atomic Design + Tests.** Komponenten in Atoms/Molecules/Organisms
   zerlegt; vollständige Testabdeckung aufgebaut. *Warum?* Wartbarkeit und ein
   Sicherheitsnetz vor weiteren Umbauten.
3. **0.3.0 – Performance + Aliase.** `nvm ls` (~20 s) durch direktes Lesen des
   Dateisystems ersetzt (< 10 ms); volle Alias-Verwaltung inkl. LTS. *Warum?*
   Die langsame Liste machte die App im Alltag unbenutzbar.
4. **0.5.0 – Self-Service.** nvm-Update, Ordner öffnen, Hell-/Dunkel-Modus.
5. **0.6.0 – Angular-21-Modernisierung.** God-Component aufgelöst
   (`NvmStateService`), Signal Inputs/Outputs, OnPush überall, zoneless,
   `rxResource()`, zentrales Error-Handling, Accessibility. *Warum?* Den Code auf
   den aktuellen Angular-Standard heben – das eigentliche Lernziel des Projekts.
6. **0.7.0 – Dokumentation.** Diese Lernunterlagen (Markdown + HTML) entstehen.
7. **0.8.0 – Feinschliff UI.** Konsistente Badges, Modal-Feedback für alle
   Alias-Änderungen, durchgängig signal-basierte Formfelder.

## Qualitäts-Stand

- **Tests:** Nach der letzten großen Review-Runde liefen über 200 Tests grün
  (Backend Unit + Integration via Supertest, Frontend Component-Tests via Vitest,
  E2E via Playwright). *Wie prüfen?* `npm test` (API + Web) bzw. `npm run test:e2e`.
- **Lint:** 0 Fehler, `--max-warnings 0` erzwingt Sauberkeit. *Wie prüfen?* `npm run lint`.
- **Sicherheit:** Bind nur auf `127.0.0.1`, Whitelist-Validierung + Single-Quote-Escaping
  vor jedem nvm-Aufruf, CORS nur für `http://localhost:4201`.

## Schnelleinstieg (zum Mitexperimentieren)

```bash
# Beides gleichzeitig (aus dem Projekt-Root)
npm run dev

# oder einzeln:
cd apps/api && npm run dev   # Backend → http://127.0.0.1:3789
cd apps/web && npm start     # Frontend → http://localhost:4201
```

## Weiterlesen – die „-now"-Detaildokumente

- **[BACKEND-now.md](BACKEND-now.md)** – aktueller Stand des Express-Backends
- **[API-now.md](API-now.md)** – der REST-Vertrag, wie er heute existiert
- **[FRONTEND-now.md](FRONTEND-now.md)** – aktueller Stand der Angular-App
  (inkl. der Modernisierung, die in [FRONTEND.md](FRONTEND.md) noch nicht steht)

## Verständnisfragen

1. Welche Funktion ist im Backend fertig, aber im Frontend noch nicht verdrahtet – und warum?
2. Warum liest die Anwendung installierte Versionen aus dem Dateisystem statt über `nvm ls`?
3. Was bedeutet „zoneless", und welcher Mechanismus ersetzt `zone.js`?
4. Welcher Umbau in 0.6.0 verbesserte die Testbarkeit am stärksten und wieso?

## Übungsaufgaben

1. **Stand verifizieren:** Führe `npm test` aus und vergleiche die tatsächliche
   Testanzahl mit der hier genannten Größenordnung.
2. **Feature-Landkarte:** Öffne die laufende App und ordne jede sichtbare Card
   einem Eintrag der Funktionstabelle oben zu.
3. **Lücke schließen (Konzept):** Skizziere, welche Schritte nötig wären, um den
   SSE-Streaming-Endpunkt im Frontend zu nutzen (Stichwort `EventSource`).
