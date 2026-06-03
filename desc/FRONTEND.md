# Frontend – nvm-manager Angular-Anwendung

## Lernziele

Nach dem Durcharbeiten dieses Dokuments kannst du:

- erklären, was eine Single-Page-Application (SPA) ist und wie Angular aufgebaut ist
- den Unterschied zwischen **Standalone Components** und dem alten NgModule-Modell benennen
- beschreiben, wie **Angular Signals** reaktiven Zustand (State) verwalten
- nachvollziehen, wie Komponenten über `@Input()` und `@Output()` Daten austauschen
- den Datenfluss von einem Klick bis zum Backend-Aufruf und zurück verfolgen
- das Gestaltungsprinzip **Atomic Design** (Atoms → Molecules → Organisms) einordnen

## Voraussetzungen

- Grundkenntnisse in TypeScript und HTML
- Du hast [API.md](API.md) gelesen oder weißt, wie das Frontend mit dem Backend spricht

> 💡 **Konzept: Was ist ein "Frontend" und eine SPA?**
> Das **Frontend** ist alles, was im Browser läuft und der Benutzer sieht. Eine
> **Single-Page-Application (SPA)** lädt einmalig eine HTML-Seite und tauscht danach
> nur noch Daten mit dem Server aus (per API), statt für jede Aktion eine komplett
> neue Seite zu laden. Das fühlt sich an wie eine Desktop-App. **Angular** ist ein
> Framework, das beim Bau solcher SPAs hilft – mit Komponenten, Datenbindung und
> Werkzeugen für HTTP-Kommunikation.

## Überblick

Das Frontend ist eine **Angular 17+ Single-Page-Application** (`apps/web/`).
Sie nutzt ausschließlich **Standalone Components** (kein NgModule), **Angular Signals**
für State-Management und `HttpClient` für die Kommunikation mit dem Express-Backend.

```
apps/web/src/
├── main.ts                         ← Bootstrap-Einstiegspunkt
├── index.html
├── styles.scss                     ← Globale Styles
└── app/
    ├── app.ts                      ← Root-Komponente (State + Aktions-Koordinator)
    ├── app.html                    ← Root-Template
    ├── app.scss
    ├── app.config.ts               ← Angular-Konfiguration (Providers)
    ├── app.routes.ts               ← Router-Konfiguration (aktuell leer)
    ├── models/
    │   └── nvm.models.ts           ← Alle TypeScript-Typen
    ├── services/
    │   └── nvm-api.service.ts      ← HTTP-Service (einzige API-Kommunikation)
    └── components/
        ├── atoms/
        │   ├── spinner/            ← CSS-Spinner
        │   └── loading-state/     ← Spinner + Nachricht
        ├── molecules/
        │   └── card/               ← Generischer Card-Wrapper
        ├── organisms/
        │   ├── app-header/         ← Kopfzeile mit aktiver Version
        │   ├── status-card/        ← nvm-Verbindungsstatus
        │   ├── action-card/        ← Eingabe für Install/Use/Default/Uninstall
        │   ├── installed-versions-card/  ← Tabelle installierter Versionen
        │   ├── aliases-card/       ← Alias-Verwaltung (CRUD)
        │   ├── remote-versions-card/     ← Verfügbare Versionen + Suche
        │   └── log-card/           ← Aktivitätslog
        └── install-modal/          ← Fortschritts-Modal für Aktionen
```

### Abhängigkeiten

| Paket | Version | Zweck |
|-------|---------|-------|
| `@angular/core` | ^21.2.0 | Framework |
| `@angular/common` | ^21.2.0 | `DatePipe`, HTTP |
| `@angular/forms` | ^21.2.0 | `FormsModule` (Two-Way-Binding) |
| `@angular/router` | ^21.2.0 | Router (vorbereitet) |
| `rxjs` | ~7.8.0 | Observables für HTTP |
| `vitest` | ^4.0.8 | Unit-Tests |

---

## Bootstrap und Konfiguration

### `main.ts`

```typescript
bootstrapApplication(App, appConfig);
```

Angular 17 Standalone-Bootstrap – kein `AppModule`. Die Root-Komponente `App`
wird direkt mit einer Konfiguration gebootstrappt.

> 💡 **Konzept: Komponente, Standalone & "bootstrappen"**
> Eine **Komponente** ist ein wiederverwendbarer UI-Baustein aus drei Teilen:
> Logik (`.ts`), Darstellung (`.html`-Template) und Stil (`.scss`). Früher mussten
> Komponenten in **NgModules** (Sammelcontainer) registriert werden. Seit Angular 17
> sind **Standalone Components** der Standard: Jede Komponente deklariert ihre
> Abhängigkeiten selbst über `imports: [...]` – kein NgModule mehr nötig.
> **Bootstrappen** heißt: die Anwendung starten, indem die oberste Komponente in die
> Seite gehängt wird.

> 💡 **Konzept: Dependency Injection (DI) & `provide...`**
> Angular erzeugt benötigte Objekte (z.B. den `HttpClient`) selbst und "spritzt" sie
> dorthin, wo sie gebraucht werden – das nennt man **Dependency Injection**. Mit
> `provideHttpClient()` und `provideRouter()` sagt man Angular: "Stelle diese
> Dienste bereit." Komponenten holen sie sich dann per `inject(...)`, ohne sie
> selbst zu erzeugen. Das macht Code testbarer und entkoppelt.

### `app.config.ts`

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
  ],
};
```

**`provideHttpClient()`** registriert den `HttpClient` als Singleton.
Kein `withFetch()` – der Standard-XHR-Adapter wird verwendet.

**`provideRouter(routes)`** aktiviert den Angular-Router. Die Routen-Konfiguration
(`app.routes.ts`) ist aktuell leer (`Routes = []`) – es gibt nur eine einzige
Ansicht. Die Router-Infrastruktur ist vorbereitet für spätere Erweiterungen
(z.B. eine Einstellungs-Seite).

### Proxy-Konfiguration (`proxy.conf.json`)

```json
{ "/api": { "target": "http://127.0.0.1:3789", "secure": false, "changeOrigin": true } }
```

Der Angular-Dev-Server (`ng serve`) leitet alle Requests an `/api/*` an den
Express-Server weiter. Im Browser erscheinen alle Requests auf dem gleichen Origin
(`localhost:4201`) – es gibt keine CORS-Probleme aus Sicht des Browsers.

---

## State-Management: Angular Signals in der Root-Komponente

> 💡 **Konzept: State und Angular Signals**
> **State** (Zustand) sind die Daten, die sich zur Laufzeit ändern und die Anzeige
> bestimmen – z.B. "lädt gerade", "Liste der Versionen". Ein **Signal** ist ein
> Container für einen solchen Wert: Mit `signal(0)` erstellt man ihn, mit `wert()`
> liest man ihn, mit `.set(...)` oder `.update(...)` ändert man ihn. Das Besondere:
> Angular merkt automatisch, *wo* ein Signal im Template gelesen wird, und
> aktualisiert genau diese Stellen, wenn sich der Wert ändert – das nennt man
> **Reaktivität**. Ein `computed(...)` ist ein abgeleitetes Signal, das sich
> automatisch neu berechnet, wenn sich seine Quellen ändern.

### Designentscheidung: State in der Root

Die `App`-Komponente hält den gesamten applikationsweiten State als Signals:

```typescript
// apps/web/src/app/app.ts
readonly log              = signal<LogEntry[]>([]);
readonly isLoading        = signal(false);
readonly installedVersions = signal<InstalledNodeVersion[]>([]);
readonly installedRaw     = signal('');
readonly installedLoading = signal(false);
readonly installModal     = signal<InstallModalState>(null);
readonly prefillVersion   = signal('');
readonly aliasesRefreshTrigger = signal(0);

readonly activeVersion    = computed(() =>
  this.installedVersions().find((v) => v.active)
);
```

**Warum State in der Root und nicht in den Cards?**
Mehrere Cards reagieren auf dieselben Zustandsänderungen:
- `isLoading` blockiert gleichzeitig ActionCard-Buttons und InstalledVersionsCard-Buttons
- Nach `onInstall()` oder `onUseFromList()` muss sowohl das Modal aktualisiert
  als auch `loadInstalledVersions()` aufgerufen werden

State in der Root macht diese Abhängigkeiten explizit und verhindert Prop-Drilling
über mehrere Ebenen sowie inkonsistente Zustände zwischen Geschwister-Komponenten.

**Warum Signals statt NgRx oder Akita?**
Der State ist überschaubar: 7 Signals, 1 computed. Eine externe State-Management-
Bibliothek würde deutlich mehr Boilerplate erzeugen (Actions, Reducers, Effects,
Selectors) als die Problemstellung rechtfertigt. Angular Signals sind seit Angular 17
stabil und first-class, ohne externe Abhängigkeiten.

### `aliasesRefreshTrigger` – das Cross-Component-Refresh-Pattern

Die `AliasesCardComponent` hat ihren eigenen API-Aufruf (sie verwaltet lokalen
Alias-Editing-State). Wenn die Root eine Version als Default setzt oder aktiviert,
ändert sich auch der `default`-Alias. Die Root kann die Card nicht direkt
"refreshen" – aber sie kann einen Trigger inkrementieren:

```typescript
this.aliasesRefreshTrigger.update((n) => n + 1);
```

`AliasesCardComponent` empfängt dies als `@Input() refreshTrigger`:
```typescript
@Input() set refreshTrigger(value: number) {
  if (value > 0) this.load();
}
```

Der Setter ruft `load()` auf, sobald sich der Wert ändert.

---

## NvmApiService

**Datei:** `apps/web/src/app/services/nvm-api.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class NvmApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';
```

**`providedIn: 'root'`** → Singleton, automatisch im Root-Injector registriert.
Keine explizite Deklaration in `providers` nötig.

> 💡 **Konzept: Observable & RxJS (vs. Promise)**
> Angulars `HttpClient` liefert ein **Observable** statt eines Promise. Ein
> Observable ist ein "Datenstrom", den man **abonniert** (`.subscribe(...)`):
> sobald die Antwort eintrifft, wird der `next`-Callback aufgerufen; bei einem
> Fehler der `error`-Callback. Anders als ein Promise kann ein Observable mehrere
> Werte über die Zeit liefern und mit Operatoren wie `.pipe(catchError(...))`
> verarbeitet werden. Die Bibliothek dahinter heißt **RxJS**. Merksatz: Solange
> niemand `subscribe` aufruft, passiert nichts – der HTTP-Request wird erst beim
> Abonnieren tatsächlich abgeschickt.

> 💡 **Konzept: Singleton**
> Ein **Singleton** ist ein Objekt, von dem es in der gesamten Anwendung nur *eine*
> Instanz gibt. `providedIn: 'root'` macht den `NvmApiService` zum Singleton – alle
> Komponenten teilen sich denselben Service.

Alle Methoden geben `Observable<T>` zurück:

| Methode | HTTP | Endpunkt |
|---------|------|----------|
| `getStatus()` | GET | `/api/status` |
| `getInstalledVersions()` | GET | `/api/versions/installed` |
| `getRemoteVersions()` | GET | `/api/versions/remote` |
| `installVersion(version)` | POST | `/api/versions/install` |
| `useVersion(version)` | POST | `/api/versions/use` |
| `setDefaultVersion(version)` | POST | `/api/versions/default` |
| `uninstallVersion(version)` | POST | `/api/versions/uninstall` |
| `getAliases()` | GET | `/api/versions/aliases` |
| `setAlias(name, target)` | POST | `/api/versions/aliases` |
| `deleteAlias(name)` | DELETE | `/api/versions/aliases/:name` |

**Error-Handling:**
```typescript
private handleError(err: HttpErrorResponse): Observable<never> {
  const message = err.error?.error ?? err.message;
  return throwError(() => new Error(message));
}
```

`err.error?.error` extrahiert die `error`-Property aus der JSON-Fehlerantwort
des Express-Backends. Liegt kein strukturierter Fehler vor (z.B. Netzwerkfehler),
wird `err.message` des Angular-`HttpErrorResponse` verwendet.

---

## Komponenten im Detail

> 💡 **Konzept: `@Input()`, `@Output()` und der Datenfluss**
> Komponenten kommunizieren über zwei Richtungen: Ein **`@Input()`** ist ein Wert,
> den die *Eltern*-Komponente an das *Kind* hineingibt (Daten fließen **nach unten**).
> Ein **`@Output()`** ist ein `EventEmitter`, mit dem das Kind ein Ereignis an die
> Eltern meldet (Meldungen fließen **nach oben**), z.B. "Button wurde geklickt". So
> bleibt der Datenfluss vorhersehbar und gerichtet.

> 💡 **Konzept: "Smart" vs. "Dumb" Components**
> Eine verbreitete Aufteilung: **Dumb** (Präsentations-)Komponenten bekommen alle
> Daten per `@Input()` und melden Aktionen per `@Output()` – sie kennen das Backend
> nicht und sind dadurch leicht wiederverwendbar und testbar. **Smart**
> (Container-)Komponenten koordinieren den State und rufen Services/Backend auf.
> Hier ist `App` die zentrale Smart-Komponente; die meisten Cards sind Dumb.

### `App` – Root-Komponente

**Selector:** `app-root`
**Datei:** `apps/web/src/app/app.ts`

Die Root-Komponente ist der zentrale Koordinator der Anwendung:

- **Hält** den gesamten appweiten State (Signals)
- **Koordiniert** alle Aktionen (install, use, setDefault, uninstall)
- **Delegiert** Darstellung vollständig an Child-Komponenten
- **Verwaltet** das Log (max. 20 Einträge, neueste zuerst)

```typescript
private addLog(message: string, type: LogEntry['type']): void {
  const trimmed = message.replace(/\s+/g, ' ').trim();
  this.log.update((entries) => [
    { message: trimmed, type, timestamp: new Date() },
    ...entries.slice(0, 19),
  ]);
}
```

`ngOnInit()` lädt beim App-Start sofort die installierten Versionen.

---

### `AppHeaderComponent` – Kopfzeile

**Selector:** `app-app-header`
**Input:** `activeVersion: InstalledNodeVersion | undefined`

Reines Anzeigelement – zeigt den App-Titel und die aktuell aktive Node-Version.
Kein eigener State, keine eigenen HTTP-Aufrufe.

---

### `StatusCardComponent` – nvm-Status

**Selector:** `app-status-card`
**Eigener State:** `status = signal<NvmStatus | null>(null)`, `loading = signal(false)`

Lädt in `ngOnInit()` automatisch via `NvmApiService.getStatus()`.
Zeigt nvm-Version, NVM_DIR und Verbindungsstatus an. Hat eine eigene `load()`-Methode
für manuelles Neuladen.

**Warum eigenständig?**
Der Status ist unabhängig vom Rest der Anwendung und ändert sich nicht durch
Benutzeraktionen. Er wird einmalig beim Start geladen und kann manuell aktualisiert
werden – kein Grund, ihn in der Root-Komponente zu halten.

---

### `ActionCardComponent` – Aktions-Eingabe

**Selector:** `app-action-card`
**Inputs:**
- `isLoading: boolean` – deaktiviert Buttons während laufender Aktion
- `set prefillVersion(v: string)` – befüllt das Eingabefeld (z.B. nach Klick auf eine Version in der Liste)

**Outputs:** `install`, `use`, `setDefault`, `uninstall` – alle `EventEmitter<string>`

```typescript
@Input() set prefillVersion(v: string) {
  if (v) this.versionInput = v;
}
```

Der Setter prüft auf Nicht-Leer-String, um ein Zurücksetzen des Feldes beim
initialen `''`-Wert zu verhindern.

Die Komponente ist eine reine **Smart-Input-Komponente**: Sie verwaltet das
Eingabefeld lokal (`versionInput = '22'`) und emittiert den Wert nach oben.
Sie führt selbst keine HTTP-Aufrufe durch.

---

### `InstalledVersionsCardComponent` – Installierte Versionen

**Selector:** `app-installed-versions-card`
**Inputs:** `versions`, `raw`, `loading`, `isLoading`
**Outputs:** `useVersion: EventEmitter<string>`, `refresh: EventEmitter<void>`

Zeigt eine Tabelle aller installierten Node-Versionen mit Badges für `Aktiv` und
`Default`. Der "Verwenden"-Button ist deaktiviert wenn `isLoading` oder `v.active`.

Nutzt das Angular 17 **Control Flow Template-Syntax** (`@if`, `@for`, `@else`):

```html
@if (loading) {
  <app-loading-state message="Lade installierte Versionen ..." />
} @else if (versions.length > 0) {
  <table ...>
    @for (v of versions; track v.version) { ... }
  </table>
}
```

Zeigt optional die rohe `nvm ls`-Ausgabe in einem `<details>`-Element.

---

### `AliasesCardComponent` – Alias-Verwaltung

**Selector:** `app-aliases-card`
**Input:** `set refreshTrigger(value: number)`
**Output:** `logged: EventEmitter<LogEvent>`
**Eigener State:** `aliases`, `loading`, `editingAlias` (alle Signals)

Die komplexeste Card – sie verwaltet vollständiges CRUD für Aliases:

- **Laden:** `load()` ruft `getAliases()` auf und setzt `aliases`-Signal
- **Inline-Editing:** `startEdit(alias)` setzt `editingAlias`-Signal, Template
  zeigt Inline-Eingabefeld statt statischem Text
- **Erstellen:** Formular mit `newAliasName`/`newAliasTarget`, abgesetzt via `createAlias()`
- **Löschen:** `deleteAlias()` mit `confirm()`-Dialog

**Warum eigenständiger HTTP-Aufruf statt State von der Root?**
Alias-State interagiert mit Alias-spezifischem UI-State (welcher Alias wird gerade
editiert, neue Alias-Eingabefelder). Dieser lokale State gehört zur Komponente.
Die Root greift nur via `aliasesRefreshTrigger` ein, wenn sie weiß, dass sich
externe Aliases (z.B. `default`) geändert haben.

Fehler werden nicht per Log-Signal nach oben propagiert, sondern via
`@Output() logged`-EventEmitter – das Root-Template verbindet diesen mit
`(logged)="onLogged($event)"`.

---

### `RemoteVersionsCardComponent` – Verfügbare Versionen

**Selector:** `app-remote-versions-card`
**Inputs:** `installedVersions: InstalledNodeVersion[]`, `isLoading: boolean`
**Outputs:** `install: EventEmitter<string>`, `logged: EventEmitter<LogEvent>`

**Wichtig:** Lädt **nicht** automatisch beim Initialisieren – kein `ngOnInit()`.
Nur bei explizitem Benutzerklick wird `load()` aufgerufen.

**Warum lazy?** `nvm ls-remote` macht eine Netzwerkanfrage an nodejs.org und kann
mehrere Sekunden dauern. Beim App-Start würde das die wahrgenommene Performance
verschlechtern und unnötig Netzwerktraffic erzeugen.

**Filterung via computed Signals:**

```typescript
readonly filteredVersions = computed(() => {
  const installedSet = new Set(this.installedVersions.map((v) => v.version));
  const query = this.remoteSearch().trim().toLowerCase();
  const available = this.remoteVersions().filter((v) => !installedSet.has(v.version));
  if (query) {
    return available
      .filter((v) => v.version.includes(query) || (v.lts?.toLowerCase().includes(query) ?? false))
      .slice(0, 100);
  }
  return available.slice(0, 30);
});
```

- Zeigt nur Versionen, die noch **nicht** installiert sind (filtert `installedSet` heraus)
- Ohne Suche: max. **30** Versionen (Performance bei >500 Versionen)
- Mit Suche: max. **100** Versionen
- Suche funktioniert über Versionsnummer **und** LTS-Codename

`availableCount` (computed) zählt alle nicht-installierten Versionen für die UI-Anzeige.

---

### `LogCardComponent` – Aktivitätslog

**Selector:** `app-log-card`
**Input:** `log: LogEntry[]`

Reines Anzeigelement. Rendert `LogEntry[]` als zeitgestempelte Liste mit
farblicher Kennzeichnung nach `type` (`success`, `error`, `info`).
Nutzt `DatePipe` aus `@angular/common` für die Zeitstempel-Formatierung.

Max. 20 Einträge (begrenzt in `App.addLog()` via `.slice(0, 19)`).

---

### `InstallModalComponent` – Fortschritts-Modal

**Selector:** `app-install-modal`
**Input:** `state: InstallModalState`
**Output:** `closed: EventEmitter<void>`

`InstallModalState` ist ein diskriminiertes Union-Type:

```typescript
type InstallModalState =
  | { action: 'install' | 'use'; phase: 'running' | 'success' | 'error'; version: string; errorMessage?: string }
  | null;
```

Drei Phasen:
- `running` – Spinner, laufende Aktion
- `success` – Erfolgsmeldung, **Auto-Close nach 3 Sekunden**
- `error` – Fehlermeldung + intelligente Hilfetext-Generierung

**Auto-Close-Mechanismus via `OnChanges`:**

```typescript
ngOnChanges(changes: SimpleChanges): void {
  if (changes['state']) {
    clearTimeout(this.autoCloseTimer);
    if (this.state?.phase === 'success') {
      this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
    }
  }
}
ngOnDestroy(): void {
  clearTimeout(this.autoCloseTimer);
}
```

Der Timer wird bei jeder State-Änderung zuerst gecancelt. Das verhindert, dass
ein alter Timer feuert, wenn schnell hintereinander Aktionen ausgeführt werden.
`ngOnDestroy` räumt auf, um Memory-Leaks zu verhindern.

**Intelligente Fehlertexte (`getErrorInstructions()`):**

Die Methode analysiert die Fehlermeldung und gibt kontextbezogene Hilfe:
- `npm_config_prefix`-Konflikt → Anleitung zum `unset`
- `ETIMEDOUT`/`ENOTFOUND` → Netzwerk-Hinweis
- `already installed` → Hinweis zum Aktualisieren
- `not installed`/`not found` bei `use` → Hinweis zu "Installieren zuerst"

---

### Atom-Komponenten

> 💡 **Konzept: Atomic Design**
> **Atomic Design** ist ein Ordnungsprinzip für UI-Komponenten, angelehnt an die
> Chemie: **Atoms** sind die kleinsten Bausteine (Spinner, Button), **Molecules**
> kombinieren Atome zu kleinen Einheiten (eine Card mit Titel), **Organisms** sind
> größere, eigenständige Bereiche (eine komplette Versions-Karte mit Tabelle). Diese
> Hierarchie findest du im Ordner `components/` wieder (`atoms/`, `molecules/`,
> `organisms/`) und macht klar, wie "groß" und wiederverwendbar eine Komponente ist.

#### `SpinnerComponent`

```typescript
template: `<span class="spinner"></span>`
```

Reine CSS-Spinner-Animation, keine Inputs.

#### `LoadingStateComponent`

```typescript
template: `
  <div class="loading-state">
    <app-spinner />
    <span>{{ message }}</span>
  </div>
`
@Input({ required: true }) message!: string;
```

Kombiniert Spinner mit einem erforderlichen Lade-Text. `required: true` bei `@Input`
ist ein Angular 17-Feature, das Compile-Zeit-Fehler erzeugt, wenn der Input fehlt.

### `CardComponent` – Molecule

> 💡 **Konzept: `<ng-content>` (Content Projection)**
> `<ng-content>` ist ein Platzhalter, an den Angular Inhalt einsetzt, den die
> *Eltern*-Komponente zwischen die Tags der Komponente schreibt. So wird `CardComponent`
> zu einer leeren Hülle ("Rahmen"), die beliebigen Inhalt aufnehmen kann. Mit
> `select="[card-title]"` lassen sich mehrere Einsetzpunkte unterscheiden. Das nennt
> man **Content Projection** und ist der Schlüssel zu wiederverwendbaren Layout-Bausteinen.

```html
<!-- card.component.html -->
<div class="card">
  <div class="card__header">
    <ng-content select="[card-title]" />
    <ng-content select="[card-actions]" />
  </div>
  <div class="card__body">
    <ng-content />
  </div>
</div>
```

Generischer Card-Wrapper mit drei `ng-content`-Slots:
- `[card-title]` – Titel links im Header
- `[card-actions]` – Aktionen rechts im Header (z.B. Buttons)
- Default-Slot – Card-Body

---

## Datenfluss (Gesamtbild)

```
Benutzeraktion (z.B. Klick "Installieren")
    ↓
ActionCardComponent.onInstall()
    ↓ @Output install.emit('22')
App.onInstall('22')
    ↓ isLoading.set(true), installModal.set({phase:'running',...})
    ↓ addLog('Installiere Node 22 ...')
NvmApiService.installVersion('22')
    ↓ POST /api/versions/install
Express-Backend
    ↓ runNvm(['install', '22'])
    ↓ bash -lc "... nvm 'install' '22'"
nvm install 22
    ↓
    ↓ Response { stdout, stderr }
NvmApiService Observable.next(res)
    ↓
App.onInstall() next-Handler
    ↓ addLog('Node 22 installiert.')
    ↓ isLoading.set(false)
    ↓ installModal.set({phase:'success',...})
    ↓ loadInstalledVersions()  ← Refresh der installierten Liste
         ↓
    InstalledVersionsCardComponent zeigt neue Version
InstallModalComponent (Auto-Close nach 3s)
```

---

## Entwicklungsworkflow

```bash
cd apps/web

# Entwicklung (Port 4201, Proxy auf 3789)
npm start              # ng serve --port 4201

# Build
npm run build          # ng build

# Tests
npm test               # ng test (via vitest)
```

**Ports:**
- Angular Dev-Server: `4201` (nicht der Standard `4200`)
- Express-Backend: `3789`

Der Angular-Dev-Server proxyt automatisch alle `/api`-Anfragen an den
Express-Server – kein CORS-Problem im Entwicklungsbetrieb.

---

## Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **SPA** | Single-Page-Application; lädt eine Seite, tauscht danach nur Daten aus |
| **Angular** | Framework zum Bau von Frontend-Anwendungen |
| **Komponente** | Wiederverwendbarer UI-Baustein aus Logik, Template und Stil |
| **Standalone Component** | Komponente ohne NgModule, die ihre Abhängigkeiten selbst importiert |
| **Template** | Das HTML einer Komponente mit Angular-Syntax (`@if`, `{{ }}`) |
| **Bootstrappen** | Die Anwendung starten (oberste Komponente einhängen) |
| **Dependency Injection** | Angular stellt benötigte Objekte bereit und reicht sie ein |
| **Service** | Klasse für Logik, die mehrere Komponenten teilen (hier: HTTP) |
| **Singleton** | Objekt, von dem es genau eine Instanz in der App gibt |
| **State** | Veränderlicher Zustand, der die Anzeige bestimmt |
| **Signal** | Reaktiver Wert-Container (`signal`, `computed`) |
| **Reaktivität** | Anzeige aktualisiert sich automatisch bei State-Änderung |
| **Observable / RxJS** | Abonnierbarer Datenstrom für asynchrone Werte (HTTP) |
| **`@Input()`** | Wert von der Eltern- an die Kind-Komponente (Daten nach unten) |
| **`@Output()`** | Ereignis von der Kind- an die Eltern-Komponente (Meldung nach oben) |
| **Smart/Dumb Component** | Container mit Logik vs. reine Präsentationskomponente |
| **Atomic Design** | Komponenten-Hierarchie: Atoms → Molecules → Organisms |
| **Content Projection** | Inhalt per `<ng-content>` in eine Komponente einsetzen |
| **Proxy** | Leitet `/api`-Anfragen im Dev-Betrieb an das Backend weiter |

---

## Verständnisfragen

1. Was unterscheidet eine Standalone Component von einer Komponente im alten
   NgModule-Modell?
2. Wie liest und wie ändert man den Wert eines Signals? Nenne je ein Beispiel aus
   `app.ts`.
3. Warum liegt der meiste State in der `App`-Komponente und nicht in den einzelnen
   Cards?
4. In welche Richtung fließen Daten bei `@Input()`, in welche bei `@Output()`?
5. Warum lädt die `RemoteVersionsCardComponent` ihre Daten *nicht* automatisch beim
   Start?
6. Was bedeutet es, ein Observable zu "abonnieren", und warum passiert ohne
   `subscribe` kein HTTP-Request?
7. Welche Komponenten in diesem Projekt würdest du als "Dumb" einordnen, welche als
   "Smart"?
8. Wozu dient `<ng-content>` in der `CardComponent`?

---

## Übungsaufgaben

> **Hinweis:** Lege vor Änderungen einen Git-Branch an. Frontend mit
> `cd apps/web && npm start` starten.

1. **Datenfluss nachverfolgen:** Klicke in der UI auf "Installieren" und verfolge im
   Code den Weg: `action-card.component.ts` → `app.ts` (`onInstall`) →
   `nvm-api.service.ts` → Backend. Notiere bei jedem Schritt, welche Methode
   aufgerufen wird.
2. **Signal beobachten:** Suche in `app.ts` das Signal `isLoading`. Finde im Code
   alle Stellen, an denen es mit `.set(...)` geändert wird, und überlege, welche
   UI-Elemente dadurch (de)aktiviert werden.
3. **Komponente einordnen:** Wähle drei Komponenten und bestimme für jede: Ist sie
   Atom, Molecule oder Organism? Ist sie Smart oder Dumb? Begründe.
4. **Kleine Erweiterung (Konzept):** Skizziere, welche `@Input()`/`@Output()` du
   bräuchtest, um in der `InstalledVersionsCardComponent` einen "Deinstallieren"-Button
   zu ergänzen, der die Aktion an `App` meldet.
5. **Reaktivität verstehen:** Erkläre anhand von `activeVersion` (ein `computed`),
   warum sich die Kopfzeile automatisch aktualisiert, sobald `installedVersions`
   neu gesetzt wird.
6. **Tests lesen:** Öffne eine `*.component.spec.ts`-Datei und finde heraus, wie die
   Komponente im Test erstellt und welche Eingaben/Ausgaben geprüft werden.
