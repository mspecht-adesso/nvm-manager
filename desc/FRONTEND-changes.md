# Frontend – Angular Modernisierung (sonnet-findings-01 & -02)

> Dokumentiert alle Änderungen, die im Rahmen der Angular Best-Practice Reviews
> vom 03.06.2026 umgesetzt wurden. Basis: `sonnet-findings-01.md` und
> `sonnet-findings-02.md`.

---

## Überblick

Die beiden Review-Runden haben das Angular-Frontend von einem funktionalen, aber
konventionellen Stand auf ein vollständig modernes Angular-21-Setup gehoben.
Alle neun Schritte aus Teil 1 und alle sechs Schritte aus Teil 2 wurden
abgeschlossen – insgesamt **15 Änderungspakete** mit 0 offenen Punkten.

| Kategorie | Änderung | Aufwand |
|-----------|----------|---------|
| HTML-Grundlagen | `index.html` fixen | XS |
| HTTP-Client | `withFetch()` aktivieren | XS |
| SCSS | Variablen zentralisieren | S |
| Reaktivität | Signal Inputs/Outputs | M |
| Performance | `OnPush` auf allen Components | M |
| Reaktivität | `OnChanges` → `effect()` | S |
| Architektur | `NvmStateService` extrahieren | L |
| UI | `confirm()` → Inline-Modal | M |
| Performance | Zoneless Change Detection | XL |
| Tooling | ESLint + angular-eslint | M |
| Datenabruf | `rxResource()` Migration | L |
| Reaktivität | `linkedSignal()` für action-card | S |
| Fehlerbehandlung | HTTP-Interceptor + ErrorHandler | M |
| Service | `handleError` vereinfachen | XS |
| Barrierefreiheit | Accessibility-Verbesserungen | M |

---

## Teil 1 – Angular Best-Practice (sonnet-findings-01.md)

### Schritt 1 – `index.html` fixen

**Datei:** `apps/web/src/index.html`

| Vorher | Nachher |
|--------|---------|
| `<title>Web</title>` | `<title>nvm Manager</title>` |
| `lang="en"` | `lang="de"` |

Der generierte Scaffold-Titel blieb unverändert und die Sprachdeklaration passte
nicht zu den deutschen UI-Texten. Beides wirkt sich auf Screenreader,
Browser-Verlauf und SEO aus.

---

### Schritt 2 – `provideHttpClient(withFetch())`

**Datei:** `apps/web/src/app/app.config.ts`

```typescript
// Vorher
provideHttpClient()

// Nachher
provideHttpClient(withFetch())
```

> 💡 **Konzept: XMLHttpRequest (XHR) vs. native Fetch API**
>
> **XMLHttpRequest** ist die ursprüngliche Browser-API für HTTP-Anfragen –
> eingeführt um 2000 für die damals revolutionären AJAX-Techniken. Sie funktioniert
> über Event-Callbacks und einen komplexen Zustandsautomaten (`.readyState` 0–4).
> Angular nutzt XHR intern im `HttpClient`, solange man `withFetch()` nicht aktiviert.
>
> **Die native Fetch API** wurde 2015 als moderner Ersatz standardisiert und ist
> heute in jedem Browser und in Node.js (ab v18) nativ verfügbar. Ihr Design ist
> grundlegend anders:
>
> ```typescript
> // Fetch API direkt (ohne Angular)
> const response = await fetch('/api/status');       // gibt ein Promise zurück
> const data = await response.json();                // Body-Parsing ebenfalls async
> ```
>
> Im Vergleich zu XHR arbeitet Fetch:
> - **Promise-basiert** statt callback-gesteuert – direkte `async/await`-Unterstützung
> - **Streams-fähig** – Antwort-Body kann als `ReadableStream` konsumiert werden
> - **Abortierbar** per `AbortController` – saubere Ressourcenfreigabe ohne Hacks
> - **Standardkonform** – identisches Verhalten in Browser und Node.js (Server-Side Rendering)

#### Warum `withFetch()` aktivieren?

Angular 17.3 führte `withFetch()` als optionalen Schalter ein, weil er Breaking
Changes für bestehende Apps vermeiden wollte. Seit Angular 19+ ist es die empfohlene
Einstellung für neue Projekte. Die Vorteile konkret:

| | XHR (Standard) | Fetch (mit `withFetch()`) |
|-|----------------|--------------------------|
| **Bundle-Größe** | Bringt eigene `XhrBackend`-Klasse mit | Kein eigenes Backend, nutzt natives `fetch()` |
| **SSR / Node.js** | Benötigt externe XHR-Polyfills auf dem Server | Kein Polyfill nötig – Node.js 18+ hat `fetch` nativ |
| **AbortController** | Angular verwaltet intern einen XHR-Abbruch-Mechanismus | Native `AbortController`-Integration, Browser-Standard |
| **Entwickler-Tools** | XHR erscheint im Network-Tab als `xhr` | Erscheint als `fetch` – besser filterbar, klareres DevTools-Profil |
| **Performance** | Minimaler Mehraufwand durch Wrapper | Direkter Browser-Aufruf |

#### Was ändert sich für den Angular-Code?

**Nichts.** Die `HttpClient`-API bleibt identisch – `this.http.get()`,
`this.http.post()` etc. funktionieren weiterhin genauso. `withFetch()` ist
ausschließlich eine **Implementierungsdetail-Änderung** im Innern von Angular.
Der Wechsel ist deshalb so gut wie risikofrei und der Aufwand ist minimal (XS).

```typescript
// app.config.ts – vollständiger Kontext
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),   // ← einzige Änderung
    provideRouter(routes),
  ],
};
```

---

### Schritt 3 – SCSS-Variablen zentralisieren (DRY)

**Neue Datei:** `apps/web/src/styles/_variables.scss`

Die Spacing- und Border-Radius-Variablen waren in mehreren SCSS-Dateien
redundant deklariert (`app.scss`, `card.component.scss`). Sie wurden in ein
zentrales Partial ausgelagert:

```scss
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
$border-radius: 8px;
$border-radius-sm: 4px;
```

In `angular.json` wurde `stylePreprocessorOptions.includePaths: ["src/styles"]`
ergänzt, sodass alle Components das Partial einfach über
`@use 'variables' as *` importieren können.

---

### Schritt 4 – Signal Inputs / Outputs migrieren

Angular 17.1 führte `input()`, `input.required()` und `output()` als
Funktions-API ein. Sie lösen die Decorator-API (`@Input()` / `@Output()`) ab
und integrieren sich direkt ins Signals-Modell.

```typescript
// Vorher
@Input({ required: true }) message!: string;
@Input() isLoading = false;
@Output() install = new EventEmitter<string>();

// Nachher
readonly message = input.required<string>();
readonly isLoading = input(false);
readonly install = output<string>();
```

**Umgestellt wurden:**

- `loading-state.component.ts`
- `action-card.component.ts`
- `installed-versions-card.component.ts`
- `aliases-card.component.ts`
- `remote-versions-card.component.ts`
- `log-card.component.ts`
- `app-header.component.ts`
- `install-modal.component.ts`
- `status-card.component.ts`

Aus den Importen wurden `Input`, `Output` und `EventEmitter` entfernt;
stattdessen kommen `input` und `output` zum Einsatz.

---

### Schritt 5 – `ChangeDetectionStrategy.OnPush` auf allen Components

**Voraussetzung:** Signal Inputs (Schritt 4)

> 💡 **Konzept: Angular Change Detection**
>
> Angular muss wissen, wann es das DOM aktualisieren soll – also wann sich Daten
> geändert haben und das Template neu gerendert werden muss. Dafür ist die
> **Change Detection (CD)** zuständig. Sie wird nach jedem asynchronen Ereignis
> ausgelöst: einem Benutzer-Klick, einer HTTP-Antwort, einem abgelaufenen Timer
> oder einem aufgelösten Promise.
>
> **Standardverhalten (`Default`-Strategie):** Angular prüft nach jedem solchen
> Ereignis **alle** Components in der gesamten App – von oben nach unten durch
> den gesamten Component-Tree. Das ist sicher, aber aufwändig.

> 💡 **Konzept: Der Component-Tree**
>
> Eine Angular-App ist als Baum von Components aufgebaut. `AppComponent` ist die
> Wurzel; sie enthält `AppHeaderComponent`, `StatusCardComponent`,
> `InstalledVersionsCardComponent` usw. als Kinder. Jede dieser Komponenten kann
> wiederum Kinder haben (z.B. enthält `InstalledVersionsCardComponent` intern
> `CardComponent` und `LoadingStateComponent`):
>
> ```
> AppComponent
> ├── AppHeaderComponent
> ├── StatusCardComponent
> │   └── CardComponent
> │       └── LoadingStateComponent
> ├── ActionCardComponent
> ├── InstalledVersionsCardComponent
> │   └── CardComponent
> ├── AliasesCardComponent
> ├── RemoteVersionsCardComponent
> └── LogCardComponent
> ```
>
> Bei der **Default**-Strategie traversiert Angular diesen Baum bei jedem
> Ereignis vollständig – auch wenn z.B. nur der Header neu gerendert werden
> müsste.

> 💡 **Konzept: Signals und Signal Inputs**
>
> **Signals** sind reaktive Primitive, die Angular seit Version 16 kennt.
> Ein Signal ist ein Wrapper um einen Wert, der Angular präzise benachrichtigt,
> sobald sich dieser Wert ändert:
>
> ```typescript
> const count = signal(0);        // Signal anlegen
> count.set(1);                   // Wert setzen → Angular erfährt es sofort
> console.log(count());           // Wert lesen (als Funktion aufrufen)
>
> const double = computed(() => count() * 2);  // Abgeleiteter Wert
> ```
>
> Im Gegensatz zu gewöhnlichen Properties „weiß" Angular bei Signals, welches
> Template welche Signals liest – es gibt eine direkte, explizite Abhängigkeit.
>
> **Signal Inputs** (aus Schritt 4) sind Signals, die von außen per
> Property-Binding befüllt werden:
>
> ```typescript
> readonly versions = input<NvmVersion[]>([]);
> // Angular weiß jetzt: Wenn `versions` sich ändert,
> // muss NUR dieses Template neu gerendert werden.
> ```

#### `Default` vs. `OnPush` – der Unterschied

Mit der **Default**-Strategie prüft Angular eine Component bei jedem
CD-Zyklus, egal ob sich ihre Daten geändert haben. Das sind die
„unnötigen Default-CD-Zyklen": Ein Klick auf einen Button in
`ActionCardComponent` löst einen CD-Zyklus aus, der auch
`RemoteVersionsCardComponent` und alle anderen Components prüft – obwohl
dort überhaupt nichts passiert ist.

Mit **`OnPush`** überspringt Angular eine Component und ihren gesamten
Teilbaum, solange keine der folgenden Bedingungen erfüllt ist:

| Auslöser | Erklärung |
|----------|-----------|
| `@Input()`-Referenz ändert sich | Angular vergleicht per `===` (shallow), nicht per Deep-Equal |
| Ein Signal im Template ändert sich | Angular kennt die Abhängigkeit exakt → präzises Re-Render |
| Ein Event im eigenen Template | z.B. `(click)` innerhalb der Component |
| `async`-Pipe emittiert einen neuen Wert | Observable-basierte Patterns |
| Manuelles `markForCheck()` / `detectChanges()` | Programmatischer Auslöser |

#### Warum ist Schritt 4 (Signal Inputs) Voraussetzung?

Mit klassischen `@Input()`-Properties würde `OnPush` nur bei
**Referenzänderungen** auslösen. Das ist spröde: Wer ein Array mutiert statt
es zu ersetzen, sieht keine Aktualisierung. Signal Inputs lösen das elegant:
Da sie Signals sind, registriert Angular die Abhängigkeit automatisch und
triggert das Re-Render **präzise beim tatsächlichen Wertewechsel** – unabhängig
davon, ob die Referenz dieselbe bleibt oder nicht.

#### Visuelle Vorstellung: Default vs. OnPush

```
Ereignis: Klick auf "Installieren" in ActionCardComponent

DEFAULT – Angular prüft alles:
AppComponent ✓ prüfen
├── AppHeaderComponent ✓ prüfen   ← obwohl nichts geändert
├── StatusCardComponent ✓ prüfen  ← obwohl nichts geändert
├── ActionCardComponent ✓ prüfen  ← hier war das Ereignis
├── InstalledVersionsCardComponent ✓ prüfen
├── AliasesCardComponent ✓ prüfen ← obwohl nichts geändert
└── ...

ONPUSH + SIGNALS – Angular prüft nur was sich änderte:
AppComponent – Signal `isLoading` geändert → ✓ prüfen
├── AppHeaderComponent – keine abhängigen Signals → ⏭ überspringen
├── StatusCardComponent – keine abhängigen Signals → ⏭ überspringen
├── ActionCardComponent – eigenes Ereignis → ✓ prüfen
├── InstalledVersionsCardComponent – Signal `isLoading` gelesen → ✓ prüfen
├── AliasesCardComponent – keine abhängigen Signals → ⏭ überspringen
└── ...
```

#### Import und Anwendung

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

**Umgestellt wurden alle 12 Components:**
`app.ts`, `install-modal`, `app-header`, `app-footer`, `status-card`,
`action-card`, `installed-versions-card`, `aliases-card`,
`remote-versions-card`, `log-card`, `card`, `loading-state`, `spinner`.

Da in Schritt 4 alle `@Input()`-Properties bereits auf Signal Inputs
(`input()`) migriert wurden, war dieser Schritt risikolos: Angular hat
alle Template-Abhängigkeiten explizit bekannt und triggert Change Detection
nur dort, wo sie tatsächlich notwendig ist.

---

### Schritt 6 – `OnChanges` durch `effect()` ersetzen

**Datei:** `apps/web/src/app/components/install-modal/install-modal.component.ts`

> 💡 **Konzept: `ngOnChanges` und seine Schwächen im Signals-Zeitalter**
>
> `ngOnChanges` ist ein **Lifecycle-Hook**: Angular ruft ihn auf, sobald sich
> ein `@Input()`-Property einer Component ändert. Um reagieren zu können, muss
> die Component das Interface `OnChanges` implementieren und eine Methode
> `ngOnChanges(changes: SimpleChanges)` definieren. `SimpleChanges` ist ein
> Objekt, das für jedes geänderte Input den alten und den neuen Wert enthält –
> per String-Key (`changes['state']`), was keine Typsicherheit bietet.
>
> Das Problem tritt auf, sobald der Hook **Ressourcen** anlegt (hier: einen
> `setTimeout`-Timer). Dann muss dieselbe Component auch `OnDestroy`
> implementieren, um die Ressource beim Zerstören der Component aufzuräumen.
> Das Ergebnis: Zwei Interfaces, zwei Hooks, zwei Code-Stellen, die zusammen
> ein einziges logisches Konzept abbilden – und die Bereinigungslogik ist
> räumlich weit von der Anlage-Logik entfernt.
>
> ```typescript
> // Vorher: Logik an zwei Stellen verteilt
> export class InstallModalComponent implements OnChanges, OnDestroy {
>   @Input() state: InstallModalState = null;
>   private autoCloseTimer?: ReturnType<typeof setTimeout>;
>
>   ngOnChanges(changes: SimpleChanges): void {   // ← Anlage hier …
>     if (changes['state']?.currentValue?.phase === 'success') {
>       this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
>     }
>   }
>
>   ngOnDestroy(): void {                          // … Aufräumen woanders
>     clearTimeout(this.autoCloseTimer);
>   }
> }
> ```

> 💡 **Konzept: `effect()` – reaktive Seiteneffekte mit Signals**
>
> `effect()` ist die Signal-native Alternative zu Lifecycle-Hooks für
> reaktive Seiteneffekte. Ein `effect()` läuft:
> - **einmalig beim Erstellen** der Component
> - **automatisch erneut**, sobald sich ein Signal ändert, das im Effekt
>   gelesen wird – Angular erkennt die Abhängigkeit selbst
>
> Der entscheidende Unterschied zu `ngOnChanges`: Die **Cleanup-Funktion**
> wird direkt im selben Effekt per `onCleanup()` registriert. Logik und
> Bereinigung sind räumlich zusammen – kein separater Hook nötig.
>
> Angular führt `onCleanup` automatisch aus, bevor der Effekt erneut
> ausgelöst wird (also bei jedem Signal-Wechsel) und wenn die Component
> zerstört wird. `ngOnDestroy` wird damit überflüssig.

#### Vorher → Nachher im Detail

```typescript
// ── VORHER ────────────────────────────────────────────────────────────────
// Problem 1: Zwei Interfaces, die nur gemeinsam Sinn ergeben
// Problem 2: String-Key 'state' ohne Typsicherheit
// Problem 3: clearTimeout an zwei verschiedenen Stellen
export class InstallModalComponent implements OnChanges, OnDestroy {
  @Input() state: InstallModalState = null;
  private autoCloseTimer?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['state']) {
      clearTimeout(this.autoCloseTimer);
      if (this.state?.phase === 'success') {
        this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
      }
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.autoCloseTimer);  // ← duplizierte Bereinigung
  }
}

// ── NACHHER ───────────────────────────────────────────────────────────────
// Vorteil 1: Keine Lifecycle-Interfaces mehr
// Vorteil 2: Typsicherheit – state() ist direkt der Wert, kein changes-Objekt
// Vorteil 3: Anlage und Bereinigung stehen zusammen im selben Effekt
export class InstallModalComponent {
  readonly state = input<InstallModalState>(null);
  readonly closed = output<void>();

  constructor() {
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

    effect((onCleanup) => {
      clearTimeout(autoCloseTimer);                        // Vorheriger Timer stoppen
      if (this.state()?.phase === 'success') {
        autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
      }
      onCleanup(() => clearTimeout(autoCloseTimer));       // ← Bereinigung direkt hier
    });
  }
}
```

`OnChanges`, `SimpleChanges` und `OnDestroy` wurden vollständig aus den
Imports entfernt. Die Component implementiert keine Interfaces mehr.

---

### Schritt 7 – God Component auflösen: `NvmStateService`

**Neue Datei:** `apps/web/src/app/services/nvm-state.service.ts`

> 💡 **Konzept: Das „God Component"-Anti-Pattern**
>
> Eine **God Component** (auch: „Fat Component") ist eine Component, die
> deutlich zu viel Verantwortung trägt. Sie kennt alle Daten der App, führt
> alle Operationen aus und koordiniert alle Kind-Components. Das verstößt
> gegen das **Single Responsibility Principle (SRP)**: Jede Klasse sollte
> genau eine Verantwortung haben und genau einen Grund haben, geändert zu
> werden.
>
> `app.ts` hatte vor diesem Schritt drei verschiedene Aufgaben gleichzeitig:
> 1. **Layout** – das HTML-Gerüst der Seite zusammenstellen
> 2. **State** – alle Signals der App halten (`isLoading`, `installedVersions`, …)
> 3. **Aktionen** – alle Benutzerinteraktionen verarbeiten (`onInstall`, `onUse`, …)
>
> Die Konsequenzen eines solchen Anti-Patterns:
> - Die Datei wächst mit jeder neuen Funktion unkontrolliert (~295 Zeilen)
> - Änderungen an einem Bereich (z.B. neue Aktion) erfordern das Öffnen der
>   gesamten Datei – Risiko, versehentlich Layout-Code zu verändern
> - **Testbarkeit leidet stark**: Um eine einzelne Methode wie `onInstall()`
>   zu testen, muss die gesamte Angular-Component mit DOM, Template und allen
>   Abhängigkeiten hochgefahren werden

> 💡 **Konzept: Services und Dependency Injection in Angular**
>
> Ein **Service** in Angular ist eine einfache TypeScript-Klasse mit
> `@Injectable()`-Decorator. Sie hat keinen eigenen Template und kein DOM –
> sie verwaltet ausschließlich Daten und Logik. Angular's
> **Dependency Injection (DI)** stellt sicher, dass eine Service-Instanz
> automatisch überall verfügbar ist, wo sie benötigt wird.
>
> ```typescript
> @Injectable({ providedIn: 'root' })  // ← eine Instanz für die gesamte App
> export class NvmStateService {
>   // Zustand und Logik hier
> }
> ```
>
> In einer Component wird der Service per `inject()` eingebunden – Angular
> liefert dieselbe Instanz, egal von wie vielen Components darauf zugegriffen
> wird:
>
> ```typescript
> // In app.ts – Angular injiziert die Singleton-Instanz automatisch
> protected readonly state = inject(NvmStateService);
> ```

#### Vorher → Nachher: Verantwortungsverteilung

```
VORHER – app.ts (~295 Zeilen, drei Verantwortungen):
┌─────────────────────────────────────────────────────┐
│ app.ts                                              │
│  Layout:    Template mit 8 Card-Components          │
│  State:     9 Signals (isLoading, installedVersions,│
│             log, installModal, prefillVersion, …)   │
│  Aktionen:  10 Methoden (onInstall, onUse, onUnin-  │
│             stall, onSetDefault, onNvmUpdate, …)    │
└─────────────────────────────────────────────────────┘

NACHHER – klare Trennung (~140 Zeilen gesamt):
┌─────────────────────────┐   ┌─────────────────────────────┐
│ app.ts (~50 Zeilen)     │   │ nvm-state.service.ts        │
│  Layout only:           │   │  State + Aktionen:          │
│  Template + inject()    │──▶│  9 Signals                  │
│                         │   │  10 Methoden                │
│  state.installedVers…() │   │  NvmApiService via inject() │
│  state.onInstall(…)     │   │                             │
└─────────────────────────┘   └─────────────────────────────┘
```

**Verschobene Signals:**
`log`, `isLoading`, `installedVersions`, `installedRaw`, `installedLoading`,
`installModal`, `prefillVersion`, `aliasesRefreshTrigger`, `activeVersion`

**Verschobene Methoden:**
`loadInstalledVersions`, `onInstall`, `onUseFromList`, `onUse`, `onSetDefault`,
`onUninstall`, `onNvmUpdate`, `closeInstallModal`, `onLogged`, `addLog`

#### Testbarkeit – der entscheidende Gewinn

Vor der Extraktion musste `app.spec.ts` die gesamte Angular-Component mit
allen Abhängigkeiten aufbauen, nur um `onInstall()` zu testen. Danach:

```typescript
// nvm-state.service.spec.ts – reiner Unit-Test, kein DOM nötig
it('onInstall setzt isLoading auf true', () => {
  const service = new NvmStateService(mockApi);
  service.onInstall('22.3.0');
  expect(service.isLoading()).toBe(true);
});

// app.spec.ts – testet nur noch das Layout
it('zeigt den Header', () => {
  const mockState = jasmine.createSpyObj('NvmStateService', ['onInstall']);
  // Component-Test kann jetzt extrem schlank sein
});
```

---

### Schritt 8 – `confirm()` durch Inline-Modal ersetzen

**Datei:** `apps/web/src/app/components/organisms/aliases-card/aliases-card.component.ts`

> 💡 **Konzept: `window.confirm()` und warum es in modernen Apps problematisch ist**
>
> `window.confirm()` (kurz: `confirm()`) ist eine Browser-API aus den frühen
> Tagen des Webs. Sie zeigt einen nativen Betriebssystem-Dialog und liefert
> synchron `true` (OK) oder `false` (Abbrechen) zurück:
>
> ```typescript
> if (confirm('Wirklich löschen?')) {
>   this.deleteAlias(name);
> }
> ```
>
> Das klingt praktisch, hat aber mehrere ernste Nachteile:
>
> **1. Blockiert den UI-Thread (synchron)**
> `confirm()` hält die gesamte JavaScript-Ausführung an, bis der Nutzer
> klickt. Die App „friert" ein – kein Spinner, kein Netzwerk-Request, keine
> Animations-Updates während der Dialog offen ist.
>
> **2. Nicht gestaltbar**
> Das Aussehen des Dialogs bestimmt ausschließlich das Betriebssystem. Eine
> Angular-App mit eigenem Design-System kann den Dialog nicht anpassen –
> Schriftart, Farben, Layout sind fest vorgegeben und passen meist nicht ins
> App-Design.
>
> **3. Kein einheitliches Verhalten**
> Auf mobilen Geräten (iOS, Android) sieht der Dialog anders aus. In
> eingebetteten Kontexten (iframes, Progressive Web Apps, Electron) kann
> `confirm()` komplett unterdrückt werden oder stumm `false` zurückliefern.
> Manche Browser (Chrome) deaktivieren wiederholte `confirm()`-Aufrufe
> automatisch.
>
> **4. Nicht testbar**
> Unit-Tests können `confirm()` nicht ohne Mocking aufrufen. Jeder Test,
> der `deleteAlias()` aufruft, muss `window.confirm` manuell überschreiben –
> das ist fragil und aufwändig.

#### Die Signal-gesteuerte Alternative

Statt den Lösch-Auftrag sofort auszuführen, speichert ein Signal den
„ausstehenden" Alias-Namen. Das Template reagiert auf diesen Zustand und
zeigt kontextuell – direkt neben dem betroffenen Eintrag – eine Bestätigung:

```typescript
// State: welcher Alias wartet gerade auf Bestätigung?
confirmPendingAlias = signal<string | null>(null);

// Schritt 1: Lösch-Absicht registrieren (kein confirm(), kein Löschen)
deleteAlias(name: string) {
  this.confirmPendingAlias.set(name);
}

// Schritt 2a: Nutzer bestätigt → tatsächlich löschen
confirmDelete() {
  const name = this.confirmPendingAlias();
  if (name) {
    this.api.deleteAlias(name).subscribe(...);
  }
  this.confirmPendingAlias.set(null);
}

// Schritt 2b: Nutzer bricht ab → Signal zurücksetzen
cancelDelete() {
  this.confirmPendingAlias.set(null);
}
```

```html
<!-- Template: Inline-Confirm erscheint genau bei dem betroffenen Alias -->
@for (alias of aliases(); track alias.name) {
  <tr>
    <td>{{ alias.name }}</td>
    <td>
      <button (click)="deleteAlias(alias.name)">Löschen</button>
    </td>
    <td>
      @if (confirmPendingAlias() === alias.name) {
        <div role="alert">
          Alias '{{ alias.name }}' wirklich löschen?
          <button (click)="confirmDelete()">Ja, löschen</button>
          <button (click)="cancelDelete()">Abbrechen</button>
        </div>
      }
    </td>
  </tr>
}
```

| Aspekt | `confirm()` | Inline-Confirm |
|--------|------------|----------------|
| UI-Thread | blockiert synchron | nicht blockiert |
| Gestaltung | Betriebssystem bestimmt | vollständig kontrollierbar |
| Kontextualität | losgelöster Dialog | direkt beim betroffenen Element |
| Testbarkeit | Mocking von `window.confirm` nötig | Signal-Wert prüfen reicht |
| Accessibility | Browser-nativ, kein `aria` | `role="alert"` – Screenreader erfährt es |

---

### Schritt 9 – Zoneless Change Detection

**Datei:** `apps/web/src/app/app.config.ts`

> 💡 **Konzept: Was ist Zone.js – und warum wurde es überhaupt eingeführt?**
>
> Angular muss wissen, wann asynchrone Operationen abgeschlossen sind, um
> danach Change Detection auszulösen. Das Problem: JavaScript selbst bietet
> keinen eingebauten Mechanismus, um auf „irgendeinen abgeschlossenen
> async-Vorgang" zu reagieren.
>
> **Zone.js** löst das durch **Monkey-Patching**: Es überschreibt beim
> App-Start nahezu alle asynchronen Browser-APIs mit eigenen Wrapper-
> Versionen:
>
> ```
> setTimeout   → Zone.js-Version von setTimeout
> fetch        → Zone.js-Version von fetch
> Promise      → Zone.js-Version von Promise
> addEventListener → Zone.js-Version von addEventListener
> XHR          → Zone.js-Version von XHR
> …
> ```
>
> Wenn eine dieser Operationen abgeschlossen ist, weiß Zone.js davon und
> benachrichtigt Angular: „Jetzt wäre ein guter Moment für Change Detection."
> Angular prüft dann den gesamten Component-Tree (siehe Schritt 1.5).
>
> Das funktioniert – aber zu einem Preis:
> - **Bundle-Größe:** Zone.js ist ~35 KB gzipped extra
> - **Monkey-Patching:** Das Überschreiben von Browser-APIs ist konzeptionell
>   fragil und erschwert das Debugging erheblich
> - **Unvorhersagbarkeit:** Change Detection kann zu unerwarteten Zeitpunkten
>   ausgelöst werden, da Zone.js jeden async-Vorgang abfängt
> - **DevTools-Verwirrung:** Stack-Traces im Browser-Debugger enthalten
>   Zone.js-Wrapper-Frames, die das Lesen erschweren

> 💡 **Konzept: Zoneless – Signals ersetzen Zone.js**
>
> Mit Signal-basiertem State-Management (Schritte 4–7) weiß Angular präzise,
> welche Signals von welchen Templates gelesen werden. Ändert sich ein Signal,
> löst Angular nur die betroffenen Components aus – ganz ohne Zone.js.
>
> Das ist die eigentliche Stärke des Signal-Modells: Signals ersetzen nicht
> nur `@Input()`/`@Output()`, sondern machen den gesamten Zone.js-
> Patch-Mechanismus überflüssig.
>
> ```
> MIT Zone.js:
> async-Event → Zone.js fängt ab → Angular: „Check alle Components"
>
> OHNE Zone.js (Zoneless):
> Signal.set() → Angular: „Check nur Components, die dieses Signal lesen"
> ```

#### Warum der Aufwand als XL bewertet wird – und trotzdem leicht war

Die XL-Bewertung gilt für eine **Migration einer bestehenden App** mit
`zone.js`. Das erfordert das Prüfen aller Components auf implizite
Zone.js-Abhängigkeiten (z.B. direktes `setTimeout` ohne Signal-Gegenstück),
das Entfernen von Polyfills und die Anpassung von Tests.

In diesem Projekt war der Schritt **trivial**, weil:
1. `zone.js` war nie in `package.json` oder den Polyfills eingetragen
2. Alle 12 Components nutzten bereits Signal Inputs (Schritt 4) und OnPush (Schritt 5)
3. Kein Code enthielt implizite Zone.js-Abhängigkeiten

Die Aktivierung war damit eine reine Konfigurationszeile:

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),  // Angular 21: stabile API, kein "Experimental" mehr
    provideHttpClient(withFetch()),
    provideRouter(routes),
  ],
};
```

#### Was sich konkret verändert

| | Mit Zone.js | Zoneless |
|-|-------------|---------|
| **Bundle** | +35 KB (gzipped) | entfällt vollständig |
| **Change Detection** | Nach jedem async-Event: ganzer Tree | Nur bei Signal-Änderung: betroffene Components |
| **Monkey-Patching** | `setTimeout`, `fetch`, `Promise` etc. überschrieben | keine Browser-API-Überschreibungen |
| **Stack-Traces** | Zone.js-Frames in Debugger-Ausgaben | saubere, direkte Stack-Traces |
| **Profiling** | Zone-Overhead in Performance-Profilen | direktes Timing der App-Logik |
| **SSR / Node.js** | Zone.js erfordert Server-seitigen Patch | kein Patch nötig |

---

## Teil 2 – Angular 21 Feinschliff (sonnet-findings-02.md)

### Schritt 1 – ESLint + angular-eslint (Flat Config)

**Neue Datei:** `apps/web/eslint.config.mjs`

> 💡 **Konzept: Was ist Linting – und warum reicht TypeScript allein nicht?**
>
> Der TypeScript-Compiler (`tsc`) prüft ausschließlich **Typen**. Er meldet
> Fehler wie „diese Variable ist vom Typ `string`, aber du übergibst eine
> `number`". Was er nicht erkennt: schlechte Code-Struktur, gefährliche
> Muster, fehlende Barrierefreiheit oder Verstöße gegen Konventionen.
>
> Ein **Linter** analysiert den Code nach konfigurierbaren **Regeln**, die
> über reine Typkorrektheit hinausgehen. Beispiele:
>
> | Regel | Was wird erkannt |
> |-------|-----------------|
> | `prefer-on-push-component-change-detection` | Components ohne `OnPush` |
> | `prefer-standalone` | Components, die noch NgModule verwenden |
> | `@angular-eslint/component-selector` | Falsches Selektor-Präfix (`app-`) |
> | `no-unused-vars` | Deklarierte, aber nie genutzte Variablen |
> | `templateAccessibility` | Fehlende `alt`-Attribute, falsche ARIA-Rollen |

> 💡 **Konzept: ESLint Flat Config (ESLint 9+)**
>
> Bis ESLint 8 gab es die sogenannte „Legacy Config" (`eslintrc.json`). ESLint 9
> führte die **Flat Config** (`eslint.config.mjs`) ein: Eine einzige
> JavaScript-Datei, die alle Regeln als Array von Konfigurationsobjekten
> exportiert. Sie ist expliziter, besser typisierbar und einfacher zu debuggen:
>
> ```javascript
> // eslint.config.mjs
> export default [
>   { files: ['**/*.ts'], rules: { ... } },       // TypeScript-Dateien
>   { files: ['**/*.html'], rules: { ... } },      // Angular-Templates
> ];
> ```

#### Was wurde konkret konfiguriert?

```javascript
// apps/web/eslint.config.mjs (vereinfacht)
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default [
  // TypeScript-Regeln
  ...tseslint.configs.recommended,
  {
    rules: {
      '@angular-eslint/component-selector': ['error', {
        type: 'element', prefix: 'app', style: 'kebab-case'
      }],
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    }
  },
  // Angular-Template-Regeln
  ...angular.configs.templateRecommended,
  ...angular.configs.templateAccessibility,
];
```

Die Regel `prefer-on-push-component-change-detection` stellt sicher, dass
zukünftig keine neue Component ohne `OnPush` erstellt werden kann –
der Linter erzwingt, was in Schritt 1.5 manuell migriert wurde.

**Neue Scripts in `apps/web/package.json`:**

```json
"lint": "eslint src --max-warnings 0",
"lint:fix": "eslint src --fix"
```

`--max-warnings 0` bedeutet: Auch Warnungen werden als Fehler behandelt –
der CI-Build schlägt fehl, sobald auch nur eine Regel verletzt wird. Nach
initialer Bereinigung (fehlende `OnPush` an Test-Host-Components, ungenutzte
Konstante) sind **0 Lint-Fehler** verblieben.

---

### Schritt 2 – Datenabruf auf `rxResource()` umstellen

**Betrifft:** `status-card`, `remote-versions-card`, `nvm-state.service`, `aliases-card`

> 💡 **Konzept: Das Problem mit manuellem `subscribe()`**
>
> HTTP-GET-Aufrufe haben immer drei Zustände: **Laden**, **Erfolg** und
> **Fehler**. Bei manuellem `subscribe()` muss dieser Zustandsautomat jedes
> Mal von Hand implementiert werden – mit eigenen Signals, eigener
> Fehlerbehandlung und oft vergessenen Randfällen:
>
> ```typescript
> // Das gleiche Boilerplate in jeder Komponente, die Daten lädt:
> loading = signal(false);
> error = signal<string | null>(null);
> data = signal<NvmVersion[]>([]);
>
> ngOnInit() {
>   this.loading.set(true);
>   this.api.getData().subscribe({
>     next: (v) => {
>       this.data.set(v);
>       this.loading.set(false);
>       this.error.set(null);
>     },
>     error: (e) => {
>       this.loading.set(false);
>       this.error.set(e.message);  // ← oft vergessen
>     }
>   });
> }
> ```
>
> Probleme dieses Musters:
> - **Redundanz:** Jede ladende Component schreibt denselben Boilerplate
> - **Vergessene Randfälle:** `error`-Signal nach erneutem Laden nicht zurückgesetzt
> - **Kein automatisches Reload:** Nach einer Mutation muss `ngOnInit` manuell
>   erneut aufgerufen werden – oder eine dedizierte `reload()`-Methode wird gebaut
> - **`ngOnInit` als Pflicht:** Jede Component, die Daten lädt, braucht das Interface

> 💡 **Konzept: `rxResource()` – deklarativer Lade-Zustandsautomat**
>
> `rxResource()` aus `@angular/core/rxjs-interop` kapselt den kompletten
> Lade-Zustandsautomaten in einer einzigen Signal-basierten Abstraktion.
> Es liefert einen Zustand aus genau einem von vier Slots:
>
> | Zustand | Signal-Methode | Bedeutung |
> |---------|---------------|-----------|
> | `idle` | `resource.status()` | Noch nicht geladen |
> | `loading` | `resource.isLoading()` | Lade-Request läuft |
> | `resolved` | `resource.value()` | Daten erfolgreich geladen |
> | `error` | `resource.error()` | Fehler aufgetreten |
>
> Außerdem: `resource.hasValue()` – sicher prüfen ob Daten vorhanden sind,
> bevor `.value()` aufgerufen wird (wirft im Fehlerzustand).
>
> **Reload nach einer Mutation** ist einzeilig: `resource.reload()` löst
> den Loader erneut aus, ohne die Component anfassen zu müssen.

#### Vorher → Nachher

```typescript
// ── VORHER – manueller Boilerplate in jeder Component ─────────────────────
loading = signal(false);
error = signal<string | null>(null);
versions = signal<NvmVersion[]>([]);

ngOnInit() {
  this.loading.set(true);
  this.api.getRemoteVersions().subscribe({
    next: (v) => { this.versions.set(v); this.loading.set(false); },
    error: (e) => { this.error.set(e.message); this.loading.set(false); }
  });
}

// Reload nach Mutation: loadInstalledVersions() nochmals aufrufen

// ── NACHHER – deklarativ mit rxResource() ─────────────────────────────────
protected readonly versionsResource = rxResource({
  loader: () => this.api.getRemoteVersions()
});

// Template nutzt direkt die Resource-Signals:
// @if (versionsResource.isLoading()) { <app-loading-state /> }
// @if (versionsResource.error()) { <p>Fehler: {{ versionsResource.error() }}</p> }
// @for (v of versionsResource.value()?.versions; track v.version) { … }

// Reload nach Mutation – eine Zeile:
// this.versionsResource.reload();
```

**Warum `rxResource()` statt dem stabilen `httpResource()`?**

Angular 21 bietet auch `httpResource()` – eine stabile API, die direkt
URL-Parameter erwartet. Sie wurde hier bewusst nicht verwendet, weil:
- `NvmApiService` als typisierte Service-Schicht erhalten bleiben soll
- Der zentrale `httpErrorInterceptor` (Schritt 2.4) greift nur bei
  `HttpClient`-Aufrufen innerhalb des Services, nicht bei `httpResource()`-intern
- `rxResource()` akzeptiert beliebige Observable-Loader, also auch Service-Methoden

**Betroffen und migriert:**
- `status-card`: `getStatus()` → `statusResource`
- `remote-versions-card`: `getRemoteVersions()` → `versionsResource` (lazy via `params`)
- `nvm-state.service`: `getInstalledVersions()` → `installedResource`; `ngOnInit` entfällt
- `aliases-card`: `getAliases()` → `aliasesResource` mit reaktivem `refreshTrigger` als `params`

---

### Schritt 3 – `action-card`: `effect()` → `linkedSignal()`

**Datei:** `apps/web/src/app/components/organisms/action-card/action-card.component.ts`

> 💡 **Konzept: „Abgeleiteter, aber überschreibbarer Zustand"**
>
> In der `ActionCardComponent` gibt es ein Versions-Eingabefeld (`versionInput`).
> Dieses Feld soll sich **automatisch befüllen**, wenn von außen eine Version
> per `prefillVersion`-Input übergeben wird (z.B. beim Klick auf „Verwenden"
> in der Versionsliste). Gleichzeitig soll der Nutzer den Wert **manuell
> überschreiben** können – ohne dass beim nächsten Render der manuelle Wert
> wieder durch den Input-Wert ersetzt wird.
>
> Das ist ein klassisches Spannungsfeld:
> - Abgeleitet von `prefillVersion` → sollte automatisch aktualisieren
> - Manuell editierbar → darf nicht bei jedem Render überschrieben werden
>
> Mit einem einfachen `signal()` + `effect()` entsteht folgendes Problem:

> 💡 **Konzept: Warum `effect()` hier ein Anti-Pattern ist**
>
> Angular warnt ausdrücklich davor, in einem `effect()` in ein Signal zu
> **schreiben**, das auch von außen beschreibbar ist. Das Grundproblem:
>
> ```typescript
> // Anti-Pattern: effect() schreibt in versionInput
> versionInput = signal('22');
>
> constructor() {
>   effect(() => {
>     // Problem 1: Läuft auch dann, wenn der Nutzer gerade tippt
>     // Problem 2: Überschreibt manuelle Eingabe beim nächsten prefillVersion-Wechsel
>     // Problem 3: Zirkuläres Risiko – versionInput könnte prefillVersion beeinflussen
>     this.versionInput.set(this.prefillVersion() || '22');
>   });
> }
> ```
>
> `effect()` ist für **Seiteneffekte** gedacht (z.B. DOM-Manipulation,
> Logging, Timer starten) – nicht für das Ableiten von State. Genau
> dafür gibt es `computed()` (nicht überschreibbar) und `linkedSignal()`
> (überschreibbar).

> 💡 **Konzept: `linkedSignal()` – das Signal mit Gedächtnis**
>
> `linkedSignal()` wurde in Angular 19 eingeführt und ist genau für das
> beschriebene Muster gebaut. Es definiert:
> - eine **Quelle** (`source`): ein Signal, auf dessen Änderungen reagiert wird
> - eine **Berechnungsfunktion** (`computation`): was der neue Wert sein soll
>   – mit Zugriff auf den **vorherigen Wert** (`prev`)
>
> Entscheidend: Das resultierende Signal ist trotzdem **schreibbar** per
> `.set()`. Ein manueller Wert bleibt erhalten, bis sich die `source` ändert.

#### Vorher → Nachher

```typescript
// ── VORHER – effect() als State-Ableitung (Anti-Pattern) ──────────────────
versionInput = signal('22');
constructor() {
  effect(() => {
    this.versionInput.set(this.prefillVersion() || '22');
    // ↑ Überschreibt auch manuelle Eingabe bei jedem prefillVersion-Wechsel
  });
}

// ── NACHHER – linkedSignal() als deklarative, überschreibbare Ableitung ───
protected readonly versionInput = linkedSignal({
  source: this.prefillVersion,
  // prev?.value = vorheriger Wert des Signals (manuelle Eingabe bleibt!)
  computation: (v, prev) => v || prev?.value || '22'
});

// Template: bidirektionale Bindung bleibt einfach
// [ngModel]="versionInput()"
// (ngModelChange)="versionInput.set($event)"
```

**Verhalten nach der Migration:**
1. Nutzer öffnet App → `versionInput` = `'22'` (Fallback)
2. Nutzer klickt „Verwenden" bei v22.3.0 → `prefillVersion` ändert sich →
   `versionInput` = `'22.3.0'` (automatisch übernommen)
3. Nutzer tippt manuell `'20'` → `versionInput` = `'20'` (überschrieben)
4. Nutzer klickt wieder auf v18.0.0 → `versionInput` = `'18.0.0'` (neue Source → überschreibt wieder)

Konstruktor und `effect()` vollständig entfernt. Die Component hat keine
Lifecycle-Logik mehr.

---

### Schritt 4 – Zentrales Error-Handling

**Neue Dateien:**
- `apps/web/src/app/core/http-error.interceptor.ts`
- `apps/web/src/app/core/global-error-handler.ts`

> 💡 **Konzept: HTTP-Interceptoren – Middleware für den HttpClient**
>
> Ein **HTTP-Interceptor** ist eine Funktion, die jeden HTTP-Request und
> jede HTTP-Response abfangen kann, bevor sie die eigentliche Anwendungslogik
> erreicht. Das Konzept ist identisch mit Middleware in Express:
>
> ```
> HttpClient.get('/api/status')
>     ↓ Request
> [ Interceptor 1: Auth-Header hinzufügen ]
> [ Interceptor 2: Logging ]
> [ Interceptor 3: Error-Normalisierung ]  ← unser httpErrorInterceptor
>     ↓
> Backend-Server
>     ↑ Response
> [ Interceptor 3: Error-Normalisierung ]  ← fängt Fehler ab
> [ Interceptor 2: Logging ]
> [ Interceptor 1: Auth-Header ]
>     ↑
> Component / Resource
> ```
>
> Interceptoren sind **funktional** (seit Angular 15): Eine einfache Funktion
> statt einer Klasse – leichter testbar, kein `implements` nötig.

> 💡 **Konzept: Warum zentrales Error-Handling?**
>
> Vor diesem Schritt hatte jede `NvmApiService`-Methode eine eigene
> `catchError(this.handleError)`-Pipe. Das bedeutete:
> - Fehlerbehandlung war **verteilt** über alle Service-Methoden
> - Jede Änderung am Fehlerformat musste an **10+ Stellen** nachgezogen werden
> - `this.handleError` als Methodenreferenz war technisch fragil (kein `this`)
>
> Mit dem Interceptor passiert die Normalisierung **genau einmal** für
> alle HTTP-Aufrufe der gesamten App.

#### Die zwei Schutzschichten

```typescript
// ── Schicht 1: httpErrorInterceptor ──────────────────────────────────────
// Fängt alle HTTP-Fehlerantworten (4xx, 5xx) ab und normalisiert das Format.
// HttpErrorResponse (Angular) → Error (Standard-JavaScript)
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Backend sendet { "error": "Fehlermeldung" }
      // Fallback auf den HTTP-Transport-Fehler (z.B. Network-Error)
      const message = err.error?.error ?? err.message;
      return throwError(() => new Error(message));
    })
  );

// ── Schicht 2: GlobalErrorHandler ────────────────────────────────────────
// Safety-Net für alle anderen Fehler: nicht abgefangene Exceptions,
// Fehler in Lifecycle-Hooks, Fehler im Template-Rendering.
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // In Produktion: Fehler an Monitoring-Service senden (z.B. Sentry)
    console.error('[GlobalErrorHandler]', error);
  }
}
```

```typescript
// Registrierung in app.config.ts
provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
{ provide: ErrorHandler, useClass: GlobalErrorHandler }
```

| | Ohne zentrales Handling | Mit Interceptor + Handler |
|-|------------------------|--------------------------|
| Fehlerformat | `HttpErrorResponse` oder `Error` je nach Methode | immer `Error` |
| Änderungsaufwand | 10+ Stellen im Service | 1 Stelle im Interceptor |
| Nicht behandelte Fehler | stiller Absturz | GlobalErrorHandler loggt |
| Testbarkeit | Jede Methode einzeln testen | Interceptor einmal testen |

---

### Schritt 5 – `handleError` in `NvmApiService` vereinfachen

**Datei:** `apps/web/src/app/services/nvm-api.service.ts`

Dieser Schritt ist die direkte Konsequenz aus Schritt 2.4: Weil der
Interceptor die Fehler-Normalisierung übernimmt, ist `handleError` im
Service redundant. Das fragile `catchError(this.handleError)` als
Methodenreferenz entfällt ersatzlos:

```typescript
// ── VORHER – jede Methode trug Fehlerbehandlung ───────────────────────────
getInstalledVersions(): Observable<InstalledVersionsResponse> {
  return this.http.get<InstalledVersionsResponse>('/api/versions/installed')
    .pipe(catchError(this.handleError));  // ← fragil: this-Binding
}

private handleError(error: HttpErrorResponse): Observable<never> {
  const message = error.error?.error ?? error.message;
  return throwError(() => new Error(message));
}

// ── NACHHER – reiner HTTP-Aufruf, Fehler übernimmt Interceptor ───────────
getInstalledVersions(): Observable<InstalledVersionsResponse> {
  return this.http.get<InstalledVersionsResponse>('/api/versions/installed');
}
```

> 💡 **Konzept: Das `this`-Binding-Problem**
>
> In JavaScript hängt der Wert von `this` davon ab, **wie** eine Funktion
> aufgerufen wird. Wenn `this.handleError` als Funktionsreferenz übergeben
> wird (ohne Aufruf-Klammern), verliert sie ihren `this`-Kontext:
>
> ```typescript
> .pipe(catchError(this.handleError))
> // ↑ RxJS ruft handleError als freie Funktion auf – this = undefined
> //   funktionierte hier nur zufällig, weil this in handleError nicht genutzt wurde
> ```
>
> Die korrekte Schreibweise wäre `.pipe(catchError((e) => this.handleError(e)))`.
> Mit dem Interceptor entfällt die Frage vollständig.

Der Service reduziert sich auf seine eigentliche Aufgabe: **typisierte
HTTP-Aufrufe** als Abstraktionsschicht über die API-URLs.

---

### Schritt 6 – Accessibility

**Betroffene Komponenten:** `install-modal`, `log-card`, `aliases-card`

> 💡 **Konzept: Was ist Accessibility (Barrierefreiheit)?**
>
> Accessibility (kurz: a11y) bedeutet, dass eine Anwendung auch für Menschen
> mit Einschränkungen nutzbar ist – z.B. für Personen, die einen
> **Screenreader** (Vorleseprogramm) nutzen, die Maus nicht bedienen können
> oder auf Tastaturnavigation angewiesen sind.
>
> Die technische Grundlage sind **ARIA-Attribute** (*Accessible Rich Internet
> Applications*), die dem Browser mitteilen, welche semantische Rolle ein
> Element hat und wie sich sein Zustand verändert:
>
> ```html
> <!-- Ohne ARIA: Browser weiß nicht, was das ist -->
> <div class="modal">...</div>
>
> <!-- Mit ARIA: Browser und Screenreader verstehen die Semantik -->
> <div role="dialog" aria-modal="true" aria-labelledby="modal-title">...</div>
> ```

> 💡 **Konzept: Fokus-Management bei Modals**
>
> Wenn ein Modal-Dialog geöffnet wird, muss der **Tastaturfokus** in den
> Dialog verschoben werden. Sonst kann ein Tastaturnutzer mit der
> Tab-Taste weiterhin Elemente hinter dem Modal fokussieren – die UI ist
> sichtbar gesperrt, aber für Tastaturnutzer durchlässig.
>
> Beim **Schließen** muss der Fokus auf das Element zurückgesetzt werden,
> das vor dem Öffnen fokussiert war (typischerweise der Button, der das
> Modal geöffnet hat). Andernfalls „verliert" der Nutzer seinen
> Navigations-Kontext.

> 💡 **Konzept: ARIA Live Regions**
>
> Screenreader lesen Seiteninhalte sequential vor. Wenn sich ein Element
> **dynamisch ändert** (z.B. neue Log-Einträge erscheinen), erfährt der
> Screenreader davon normalerweise nicht. **ARIA Live Regions** lösen das:
>
> ```html
> <div role="log" aria-live="polite" aria-relevant="additions">
>   <!-- Neue Einträge werden automatisch vorgelesen -->
> </div>
> ```
>
> `aria-live="polite"` bedeutet: Den aktuellen Vorlesevorgang nicht
> unterbrechen, aber den neuen Inhalt beim nächsten Pause vortragen.
> `aria-relevant="additions"` schränkt ein: Nur neue Einträge, nicht
> Entfernungen.

#### Was konkret umgesetzt wurde

**`install-modal` – Fokus und Tastatur:**

```typescript
// Fokus auf Schließen-Button beim Öffnen des Modals
private readonly closeButton = viewChild<ElementRef>('closeButton');
private previousFocus: HTMLElement | null = null;

constructor() {
  effect(() => {
    if (this.state()) {
      this.previousFocus = document.activeElement as HTMLElement;
      this.closeButton()?.nativeElement.focus();
    } else if (this.previousFocus) {
      this.previousFocus.focus();  // Fokus zurücksetzen beim Schließen
    }
  });
}

// Escape schließt – aber nicht während einer laufenden Operation
@HostListener('document:keydown.escape')
onEscape() {
  if (this.state()?.phase !== 'running') {
    this.closed.emit();
  }
}
```

```html
<!-- Modal mit vollständiger ARIA-Semantik -->
<div role="dialog"
     aria-modal="true"
     aria-labelledby="modal-title"
     tabindex="-1">
  <h2 id="modal-title">Installation läuft…</h2>
  <button #closeButton>Schließen</button>
</div>
```

**`log-card` – Live Region:**

```html
<div role="log" aria-live="polite" aria-relevant="additions">
  @for (entry of log(); track entry.id) {
    <div>{{ entry.message }}</div>
  }
</div>
```

**`aliases-card` – Alert bei Inline-Confirm:**

```html
<!-- role="alert" = Screenreader liest sofort vor (assertive live region) -->
@if (confirmPendingAlias() === alias.name) {
  <div role="alert">
    Alias '{{ alias.name }}' wirklich löschen?
    <button (click)="confirmDelete()">Ja</button>
    <button (click)="cancelDelete()">Abbrechen</button>
  </div>
}
```

| Verbesserung | ARIA / Technik | Warum |
|---|---|---|
| Modal-Semantik | `role="dialog"`, `aria-modal`, `aria-labelledby` | Screenreader erkennt Dialog-Kontext |
| Fokus-Management | `viewChild` + `effect()` | Tastaturnutzer verliert Kontext nicht |
| Escape-Key | `@HostListener` | Standard-Erwartung für Dialoge (WCAG 2.1) |
| Log-Region | `role="log"`, `aria-live="polite"` | Neue Einträge werden vorgelesen |
| Inline-Confirm | `role="alert"` | Sofortige Screenreader-Ansage |

---

## Zusätzliche Kleinigkeiten

- `app-footer.component.spec.ts` angelegt (Mindest-Render-Test)
- `installed-versions-card`: dedizierte SCSS-Datei für Tabellen-Styles
- Selektoren bereinigt: `app-app-header` → `app-header`, `app-app-footer` → `app-footer`
- `spinner.component.ts`: Styles aus `styles.scss` in eigene `spinner.component.scss` verschoben

---

## Testzahlen

| Phase | Tests |
|-------|-------|
| Nach Teil 1 | ~150 grün |
| Nach Teil 2, Schritt 2 | 185 grün |
| Nach Teil 2, Schritt 6 | **200 grün** |

---

## Fortschrittsübersicht

| Nr. | Beschreibung | Teil | Aufwand | Status |
|-----|-------------|------|---------|--------|
| 1.1 | `index.html` fixen | 1 | XS | ✅ erledigt |
| 1.2 | `withFetch()` | 1 | XS | ✅ erledigt |
| 1.3 | SCSS `_variables.scss` | 1 | S | ✅ erledigt |
| 1.4 | Signal Inputs/Outputs | 1 | M | ✅ erledigt |
| 1.5 | `OnPush` auf allen Components | 1 | M | ✅ erledigt |
| 1.6 | `OnChanges` → `effect()` | 1 | S | ✅ erledigt |
| 1.7 | `NvmStateService` | 1 | L | ✅ erledigt |
| 1.8 | `confirm()` → Inline-Modal | 1 | M | ✅ erledigt |
| 1.9 | Zoneless Change Detection | 1 | XL | ✅ erledigt |
| 2.1 | ESLint + angular-eslint | 2 | M | ✅ erledigt |
| 2.2 | `rxResource()` Migration | 2 | L | ✅ erledigt |
| 2.3 | `linkedSignal()` action-card | 2 | S | ✅ erledigt |
| 2.4 | HTTP-Interceptor + ErrorHandler | 2 | M | ✅ erledigt |
| 2.5 | `handleError` entfernt | 2 | XS | ✅ erledigt |
| 2.6 | Accessibility | 2 | M | ✅ erledigt |
