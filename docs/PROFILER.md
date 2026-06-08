# nvm Manager – Profiler

---

## Projektüberschrift

**nvm Manager** – Browserbasiertes Node-Version-Management mit agentic AI-Entwicklung

---

## Projektbeschreibung

nvm Manager ist ein lokal betriebenes Web-Tool zur Verwaltung von Node.js-Versionen über nvm (Node Version Manager). Die Anwendung ersetzt die Kommandozeile durch eine moderne, zugängliche Browser-Oberfläche und macht die tägliche Arbeit mit mehreren Node-Versionen komfortabler und sicherer.

Das Projekt ist als Monorepo aufgebaut und besteht aus drei Apps: einem Angular-21-Frontend (SPA, Standalone Components, Signals), einem Express-Backend (TypeScript, REST-API) und einer Playwright-E2E-Testsuite. Das Backend kapselt alle nvm-Operationen in streng geprüften, signierten Shell-Aufrufen – `nvm` ist eine Shell-Funktion, kein Binary – und bindet ausschließlich an `127.0.0.1`, um externen Zugriff strukturell auszuschließen.

Ein besonderes Merkmal des Projekts ist sein vollständig durchdachtes **Agentic-AI-Development-Setup**: Über ein versioniertes `.cursor`-Verzeichnis mit Rules, Skills, Hooks und Settings wurde ein generischer KI-Assistent in einen projektkompetenten Entwicklungspartner verwandelt, der Konventionen, Sicherheitsregeln und Qualitätsgates kennt und durchsetzt – ohne dass diese bei jeder Session neu erklärt werden müssen.

---

## Meine Aufgaben

### Als AI-Experte

- Konzeption und Aufbau des gesamten Agentic-AI-Setups in Cursor (`.cursor/`-Verzeichnis als versioniertes Regelwerk)
- Entwicklung von **10 domänenspezifischen Skills** (Angular, Node.js/Express, Testing, Accessibility, Debugging, Refactoring, Code Review u. a.) mit präzisen Trigger-Beschreibungen für bedarfsgesteuertes Kontextladen
- Implementierung von **Lifecycle-Hooks** (`beforeShellExecution`, `beforeReadFile`, `afterFileEdit`, `sessionStart`, `stop`) zur aktiven Qualitäts- und Sicherheitskontrolle im Agenten-Workflow
- Entwurf eines mehrstufigen Hook-Systems: hartes Blockieren (`deny`) für Sicherheitsverstöße, dialogbasiertes Rückfragen (`ask`) für sensible Dateien, kontextuelles Anreichern (`additional_context`) für situativ relevante Hinweise nach Datei-Edits
- Erstellung von **Always-Apply-Rules** (Sicherheit, Konventionen, Definition of Done, Commit-Format, Kommentarsprache) als dauerhaft präsentes Projektgedächtnis
- Verfassen eines Praxisberichts über agentic Development (Architecture, Design Decisions, Lessons Learned)

### Als Software-Architekt

- Entwurf der Monorepo-Struktur mit klarer Trennung zwischen Frontend (`apps/web/`), Backend (`apps/api/`) und E2E-Tests (`apps/e2e/`)
- Architekturentscheidung: **Angular Signals + Zoneless Change Detection** statt NgRx – vollständig signal-basiertes State-Management (`NvmStateService`) mit `signal()`, `computed()`, `linkedSignal()`, `rxResource()` und reaktiven `effect()`s
- Design eines zweischichtigen **Shell-Injection-Schutzes**: Whitelist-Regex-Validierung in `nvm.types.ts` vor jedem Aufruf, Single-Quote-Escaping im `nvm.service.ts` zur Ausführungszeit
- Entscheidung für **direktes Filesystem-Lesen** statt `nvm ls` (100× schneller: < 10 ms statt ~20 s) durch direkte Analyse von `~/.nvm/versions/node/` und `~/.nvm/alias/`
- Auslegung der Komponentenhierarchie nach **Atomic Design** (Atoms → Molecules → Organisms) mit klarer Input-/Output-Kommunikation und `ChangeDetectionStrategy.OnPush` auf allen 13 Komponenten
- Sicherheitsarchitektur: Localhost-only-Bindung (`127.0.0.1:3789`), CORS ausschließlich für `http://localhost:4200`, kein freier Shell-Zugriff vom Frontend

### Als Software-Engineer

- Vollständige Implementierung des Angular-Frontends: Standalone Components, Signal Inputs/Outputs, `httpErrorInterceptor`, `GlobalErrorHandler`, Light-/Dark-Mode via CSS Custom Properties und `ThemeService`, fokusgesteuertes Modal mit Escape-Handling und WCAG-2.1-AA-konformer Barrierefreiheit
- Entwicklung des Express-Backends: typisierte Request-Handler, SSE-Streaming-Endpoint für Live-Installationsfortschritt, LTS-Alias-CRUD mit Direktzugriff auf das nvm-Dateisystem, nvm-Self-Update via GitHub-Releases-API und git-Checkout
- Aufbau der vollständigen Testpyramide: **200+ Unit- und Integrationstests** (Vitest + Supertest + Angular Unit Tests), **Playwright-E2E-Tests** mit API-Mocking (kein echtes nvm), Coverage-Gates (≥ 70 % Lines/Functions)
- Implementierung von ESLint (Flat Config, angular-eslint, templateAccessibility) und Prettier mit automatisMcher Format-on-Save-Konfiguration
- Fortlaufende Dokumentation: TSDoc auf allen öffentlichen Funktionen, `@openapi`-Annotationen auf allen Endpunkten, Benutzerhandbuch, HTML-Lerndokumentation mit Light-/Dark-Mode-Support

---

## Angewandte Skills und Technologien

### Frontend
- **Angular 21** – Standalone Components, Signals, Zoneless Change Detection, `ChangeDetectionStrategy.OnPush`, `rxResource()`, `linkedSignal()`
- **TypeScript** – Strict Mode, explizite Rückgabetypen, `unknown` + Type Guards statt `any`
- **SCSS** – CSS Custom Properties, semantische Design Tokens, Light-/Dark-Mode, Atomic Design
- **Angular Material / Custom UI** – vollständig eigene Komponentenbibliothek nach Atomic Design Pattern
- **Accessibility (WCAG 2.1 AA)** – ARIA Roles, Focus Management, Live Regions, Keyboard Navigation

### Backend
- **Node.js / Express** – REST-API, typisierte Middleware, SSE-Streaming, `child_process` (`execFile`)
- **TypeScript** – strikt typisierte Handler, Input-Validierung, Whitelist-Regex
- **Shell-Integration** – sichere nvm-Ausführung via `bash -c` Subshell, Single-Quote-Escaping, Shell-Injection-Schutz

### Testing
- **Vitest** – Unit- und Integrationstests, Fake Timer, Coverage-Reports (`@vitest/coverage-v8`)
- **Supertest** – HTTP-Integrationstests aller API-Endpunkte
- **Angular Testing Library** – Komponenten-Tests mit `@testing-library/angular`
- **Playwright** – E2E-Tests (Chromium, headless/headed, UI-Modus, Video + Trace)

### AI & Tooling
- **Cursor AI** – Agentic Development, Rules, Skills, Hooks, Settings
- **Agentic Workflow Design** – Lifecycle-Hook-Architektur, bedarfsgesteuertes Skill-Loading, prompt-basierte Self-Review-Gates
- **ESLint** (Flat Config, `angular-eslint`, `templateAccessibility`) + **Prettier**
- **Conventional Commits**, **Keep a Changelog**, **OpenAPI/Swagger**
- **Concurrently**, **tsx**, **knip**
