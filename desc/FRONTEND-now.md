# Frontend – Aktueller Stand (Lernunterlagen)

> **Stand:** Version 0.8.0 · 2026-06-05
> **Wichtig:** Das Kerndokument [FRONTEND.md](FRONTEND.md) beschreibt einen
> *früheren* Aufbau (State direkt in `app.ts`, klassische `@Input()`/`@Output()`).
> Seit der Angular-21-Modernisierung (ab 0.6.0) ist der Code **deutlich anders**.
> Dieses Dokument zeigt den **Ist-Zustand** – **wie** die App heute gebaut ist und
> **warum** die modernen Muster gewählt wurden.

## Lernziele

Nach dem Durcharbeiten kannst du:

- erklären, **warum** der State aus `app.ts` in einen Service gewandert ist
- Signal Inputs/Outputs, OnPush und „zoneless" als zusammenhängendes Modell verstehen
- `rxResource()` und `linkedSignal()` einordnen und ihren Zweck begründen
- nachvollziehen, wie Fehler heute zentral behandelt werden

## Voraussetzungen

- [FRONTEND.md](FRONTEND.md) gelesen (für die Komponenten-Landkarte und Atomic Design)
- Grundverständnis von Angular Signals

## Was sich gegenüber [FRONTEND.md](FRONTEND.md) geändert hat (Überblick)

| Thema | Früher (FRONTEND.md) | Heute (Ist-Zustand) |
|-------|----------------------|---------------------|
| State | Signals in `app.ts` | ausgelagert in `NvmStateService` |
| Inputs/Outputs | `@Input()` / `@Output()` + `EventEmitter` | `input()` / `input.required()` / `output()` |
| Change Detection | Default | `OnPush` auf allen Komponenten |
| Reaktivität | Zone.js implizit | **zoneless** (`provideZonelessChangeDetection()`) |
| HTTP-Backend | XHR (Standard) | `provideHttpClient(withFetch())` |
| GET-Daten | manuelles `subscribe()` in `ngOnInit` | `rxResource()` |
| Fehler | `handleError` im Service | `httpErrorInterceptor` + `GlobalErrorHandler` |
| Bestätigung | `window.confirm()` | Signal-gesteuertes Inline-Confirm |

> 💡 **Konzept: Warum diese Modernisierung überhaupt?**
> Das Projekt ist ein Lernprojekt für *aktuelles* Angular. Die alten Muster
> funktionieren zwar noch, aber die neuen (Signals, zoneless, `rxResource`) sind
> heute der empfohlene Weg: weniger Boilerplate, präzisere Aktualisierung, bessere
> Testbarkeit. Den Code auf diesen Stand zu heben *ist* das eigentliche Lernziel.

## `app.ts` heute – nur noch Layout

```typescript
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [/* alle Cards */],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly state = inject(NvmStateService);
}
```

**Wie:** Die Root-Komponente enthält keinerlei State oder Aktionslogik mehr – sie
injiziert nur den `NvmStateService` und reicht ihn ans Template. **Warum:** Vorher
war `app.ts` eine „God Component" mit ~295 Zeilen (Layout + State + Aktionen). Das
verstieß gegen das *Single Responsibility Principle* und war schwer testbar – um
`onInstall()` zu prüfen, musste die ganze Komponente mit DOM hochgefahren werden.

## `NvmStateService` – das Herz des State

**Datei:** `apps/web/src/app/services/nvm-state.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class NvmStateService {
  readonly log = signal<LogEntry[]>([]);
  readonly isLoading = signal(false);
  readonly installModal = signal<InstallModalState>(null);
  readonly prefillVersion = signal('');
  readonly aliasesRefreshTrigger = signal(0);

  private readonly installedResource = rxResource({
    stream: () => this.nvmApi.getInstalledVersions(),
  });
  readonly installedVersions = computed(() => /* aus Resource */);
  readonly activeVersion = computed(() => this.installedVersions().find(v => v.active));

  onInstall(v): void { /* … */ }
  onUseFromList(v): void { /* … */ }
  // onUse, onSetDefault, onUninstall, onNvmUpdate, closeInstallModal, onLogged
}
```

**Warum ein Service statt Komponente?** Ein Service ist eine reine TypeScript-Klasse
ohne DOM. Er lässt sich isoliert testen (kein TestBed), und alle Komponenten teilen
sich dieselbe Instanz (`providedIn: 'root'` = Singleton).

> 💡 **Konzept: `rxResource()` – deklarativer Lade-Zustandsautomat**
> Jeder GET-Aufruf hat drei Zustände: *laden, Erfolg, Fehler*. Statt diesen Automaten
> per Hand mit `subscribe()` zu bauen, kapselt `rxResource()` ihn: `value()`,
> `isLoading()`, `error()` sind Signals; `reload()` lädt neu. Die installierten
> Versionen werden so geladen; nach jeder Mutation genügt `loadInstalledVersions()`
> (= `reload()`).

## Konfiguration heute (`app.config.ts`)

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),                       // routes ist aktuell leer
    provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
```

**Wie Fehler heute fließen** (zwei Schichten):

1. `httpErrorInterceptor` (`core/http-error.interceptor.ts`) fängt jede
   `HttpErrorResponse` ab und normalisiert sie zu einem einheitlichen `Error`.
   **Warum:** Ein Format für die ganze App, an genau einer Stelle gepflegt.
2. `GlobalErrorHandler` (`core/global-error-handler.ts`) ist das Sicherheitsnetz für
   alles Übrige (unbehandelte Exceptions, Template-Fehler) und loggt zentral.

**Warum entfiel `handleError` im Service?** Die fragile Methodenreferenz
`catchError(this.handleError)` hatte ein `this`-Binding-Problem und ist mit dem
Interceptor schlicht überflüssig. `NvmApiService` besteht heute nur noch aus
schlanken, typisierten HTTP-Aufrufen.

## Ausgewählte Komponenten – aktueller Stand

### `action-card` – `linkedSignal()` statt `effect()`

```typescript
readonly prefillVersion = input('');
readonly versionInput = linkedSignal<string, string>({
  source: this.prefillVersion,
  computation: (prefill, previous) => prefill || previous?.value || '22',
});
```

> 💡 **Konzept: „abgeleitet, aber überschreibbar"**
> Das Eingabefeld soll sich automatisch füllen, wenn man in der Liste auf
> „Verwenden" klickt (`prefillVersion`), aber manuelle Eingaben sollen erhalten
> bleiben. `linkedSignal()` (Angular 19+) ist genau dafür gebaut: Es liest eine
> Quelle, kann aber den vorherigen Wert (`previous?.value`) berücksichtigen.
> **Warum nicht `effect()`?** In einem Effekt in ein anderes Signal zu schreiben gilt
> als Anti-Pattern – Angular warnt ausdrücklich davor.

### `remote-versions-card` – lazy via `rxResource`

```typescript
private readonly shouldLoad = signal(false);
private readonly remoteResource = rxResource({
  params: () => (this.shouldLoad() ? true : undefined),
  stream: () => this.nvmApi.getRemoteVersions(),
});
```

**Wie:** Die Resource bleibt *idle*, bis `load()` `shouldLoad` auf `true` setzt.
**Warum:** `nvm ls-remote` macht eine Netzwerkabfrage (mehrere Sekunden). Beim
App-Start würde das die wahrgenommene Geschwindigkeit verschlechtern. Die Suche
filtert mit einem `computed`: ein führendes `v` bedeutet explizite Versionssuche
per Präfix (`v19` → nur `19.x`).

### `install-modal` – Fokus & Auto-Close per `effect()`

```typescript
constructor() {
  effect((onCleanup) => {                 // Auto-Close bei Erfolg
    if (this.state()?.phase === 'success') {
      const t = setTimeout(() => this.close(), 3000);
      onCleanup(() => clearTimeout(t));
    }
  });
  effect(() => {                          // Fokus ins Modal beim Öffnen
    if (this.state()) (this.closeButton()?.nativeElement ?? dialogEl).focus();
  });
}
```

**Wie:** Zwei Effekte – einer schließt nach 3 s bei Erfolg (mit `onCleanup` gegen
veraltete Timer), einer verwaltet den Fokus. `Escape` schließt das Modal, **außer**
während `phase === 'running'`. **Warum:** Barrierefreiheit – Tastatur- und
Screenreader-Nutzer landen im Modal und kommen sauber wieder heraus; eine laufende
Operation soll nicht versehentlich abgebrochen werden.

### Modal-Aktionen heute

Der Typ `InstallModalAction` umfasst aktuell:
`'install' | 'use' | 'uninstall' | 'nvm-update' | 'default' | 'alias'`.

**Warum `'default'` und `'alias'` ergänzt?** Seit 0.8.0 wird **jede** Alias-Änderung
(nicht nur das Setzen von `default`) über das Fortschritts-Modal kommuniziert –
inklusive eigener Titel/Texte und kontextbezogener Fehlerhinweise.

## Barrierefreiheit (Stand)

- `install-modal`: `role="dialog"`, `aria-modal`, `aria-labelledby`, Fokus-Trap-Verhalten, Escape
- `log-card`: `role="log"` + `aria-live="polite"`
- `aliases-card`: `role="alert"` am Inline-Confirm (statt `window.confirm()`)
- ESLint erzwingt `templateAccessibility`-Regeln im Build

## Verständnisfragen

1. Warum wurde der State aus `app.ts` in einen Service verschoben?
2. Was leistet `rxResource()`, das manuelles `subscribe()` nicht von allein bietet?
3. Warum ist `linkedSignal()` hier besser als `effect()`?
4. Welche zwei Schichten behandeln heute Fehler, und was macht jede?
5. Warum lädt `remote-versions-card` seine Daten erst auf Klick?

## Übungsaufgaben

1. **Datenfluss verfolgen:** Klicke „Installieren" und verfolge den Weg
   `action-card` → `NvmStateService.onInstall` → `NvmApiService` → Backend.
2. **Service testen (Konzept):** Öffne `nvm-state.service.spec.ts` und finde heraus,
   wie die Logik *ohne* DOM getestet wird.
3. **Doku abgleichen:** Suche in [FRONTEND.md](FRONTEND.md) eine Stelle, die nicht
   mehr dem Code entspricht, und notiere die heutige Lösung.
