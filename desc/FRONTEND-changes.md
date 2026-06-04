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

`withFetch()` schaltet das HttpClient-Backend von XMLHttpRequest auf die native
Fetch-API um. Vorteile: kleineres Bundle, bessere SSR-Kompatibilität, modernes
API-Verhalten.

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

Mit Signals und Signal Inputs löst Angular Change Detection präzise aus.
`OnPush` verhindert unnötige Default-CD-Zyklen im gesamten Component-Tree.

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

Alle 12 Components wurden umgestellt: `app.ts`, `install-modal`, `app-header`,
`app-footer`, `status-card`, `action-card`, `installed-versions-card`,
`aliases-card`, `remote-versions-card`, `log-card`, `card`, `loading-state`,
`spinner`.

---

### Schritt 6 – `OnChanges` durch `effect()` ersetzen

**Datei:** `apps/web/src/app/components/install-modal/install-modal.component.ts`

Der `ngOnChanges`-Hook überwachte das `state`-Input auf Änderungen und
startete einen Auto-Close-Timer. Mit Signal Inputs ist das über `effect()`
eleganter lösbar:

```typescript
// Vorher
export class InstallModalComponent implements OnChanges, OnDestroy {
  ngOnChanges(changes: SimpleChanges): void { ... }
  ngOnDestroy(): void { clearTimeout(this.autoCloseTimer); }
}

// Nachher
export class InstallModalComponent {
  constructor() {
    effect((onCleanup) => {
      clearTimeout(autoCloseTimer);
      if (this.state()?.phase === 'success') {
        autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
      }
      onCleanup(() => clearTimeout(autoCloseTimer));
    });
  }
}
```

`OnChanges`, `SimpleChanges`, `OnDestroy` wurden aus den Imports entfernt.

---

### Schritt 7 – God Component auflösen: `NvmStateService`

**Neue Datei:** `apps/web/src/app/services/nvm-state.service.ts`

`app.ts` enthielt alle State-Signals und sämtliche Event-Handler. Das wurde in
einen dedizierten Service ausgelagert:

**Verschobene Signals:**
`log`, `isLoading`, `installedVersions`, `installedRaw`, `installedLoading`,
`installModal`, `prefillVersion`, `aliasesRefreshTrigger`, `activeVersion`

**Verschobene Methoden:**
`loadInstalledVersions`, `onInstall`, `onUseFromList`, `onUse`, `onSetDefault`,
`onUninstall`, `onNvmUpdate`, `closeInstallModal`, `onLogged`, `addLog`

`app.ts` wurde auf einen reinen Layout-Container reduziert:
```typescript
protected readonly state = inject(NvmStateService);
```

Das Template wurde entsprechend auf `state.installedVersions()`,
`(install)="state.onInstall($event)"` etc. umgestellt.

**Tests:** `app.spec.ts` mockt jetzt `NvmStateService`; neuer
`nvm-state.service.spec.ts` mit Unit-Tests für die extrahierte Logik.

---

### Schritt 8 – `confirm()` durch Inline-Modal ersetzen

**Datei:** `apps/web/src/app/components/organisms/aliases-card/aliases-card.component.ts`

Der native Browser-`confirm()`-Dialog blockiert den UI-Thread, passt nicht zum
App-Design und ist auf mobilen Geräten unzuverlässig. Ersatz durch ein
Signal-gesteuertes Inline-Confirm:

```typescript
// Neues Signal
confirmPendingAlias = signal<string | null>(null);

// Aktion setzt Signal statt direkt zu löschen
deleteAlias(name: string) {
  this.confirmPendingAlias.set(name);
}

// Template
@if (confirmPendingAlias() === alias.name) {
  <div role="alert">
    <button (click)="confirmDelete()">Ja, löschen</button>
    <button (click)="cancelDelete()">Abbrechen</button>
  </div>
}
```

---

### Schritt 9 – Zoneless Change Detection

**Datei:** `apps/web/src/app/app.config.ts`

Angular 21 bietet `provideZonelessChangeDetection()` als stabile API (nicht
mehr „experimental"). Da `zone.js` im Bundle bereits nicht vorhanden war,
wurde diese API formal aktiviert:

```typescript
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // ...
  ],
};
```

Konsequenz: Angular nutzt ausschließlich Signals für Change Detection – kein
`zone.js`, kleineres Bundle, bessere Profiling-Daten.

---

## Teil 2 – Angular 21 Feinschliff (sonnet-findings-02.md)

### Schritt 1 – ESLint + angular-eslint (Flat Config)

**Neue Datei:** `apps/web/eslint.config.mjs`

Es existierte kein Linting – trotz eines `lint-reminder.sh`-Hooks.
Nachgerüstet mit:

- `eslint`, `typescript-eslint`, `angular-eslint`
- Flat Config (ESLint 9+) mit TypeScript- und Template-Regeln
- Prefix-Regel `app`, `prefer-standalone`, `prefer-on-push-component-change-detection`
- `templateRecommended` + `templateAccessibility`

**Neue Scripts in `apps/web/package.json`:**

```json
"lint": "eslint src --max-warnings 0",
"lint:fix": "eslint src --fix"
```

Root `package.json` erhielt `lint` und `lint:web`. Nach initialer Bereinigung
(OnPush an Test-Hosts, ungenutzte Konstante) sind **0 Lint-Fehler** verblieben.

---

### Schritt 2 – Datenabruf auf `rxResource()` umstellen

**Betrifft:** `status-card`, `remote-versions-card`, `nvm-state.service`, `aliases-card`

GET-Endpunkte nutzten manuelles `subscribe()` mit handgepflegten
`loading`/`error`-Signals. Umgestellt auf `rxResource()` aus
`@angular/core/rxjs-interop`:

```typescript
// Vorher (manuell)
loading = signal(false);
versions = signal<NvmVersion[]>([]);

ngOnInit() {
  this.loading.set(true);
  this.api.getRemoteVersions().subscribe({
    next: (v) => { this.versions.set(v); this.loading.set(false); },
    error: (e) => { this.loading.set(false); ... }
  });
}

// Nachher (deklarativ)
protected readonly versionsResource = rxResource({
  loader: () => this.api.getRemoteVersions()
});
```

**Designentscheidung:** `rxResource` (experimental) statt `httpResource`
(stabil) – um die `NvmApiService`-Abstraktion und zentrale Error-Normalisierung
zu erhalten.

In `nvm-state.service` ersetzt das `rxResource` mit `.reload()` den manuellen
`loadInstalledVersions()`-Aufruf und `ngOnInit` entfällt vollständig.

---

### Schritt 3 – `action-card`: `effect()` → `linkedSignal()`

**Datei:** `apps/web/src/app/components/organisms/action-card/action-card.component.ts`

Das `prefillVersion`-Input schrieb via `effect()` in das lokale `versionInput`.
Dieses Muster – „abgeleiteter, aber überschreibbarer Zustand" – ist der
klassische Anwendungsfall für `linkedSignal()`:

```typescript
// Vorher
versionInput = signal('22');
constructor() {
  effect(() => { this.versionInput.set(this.prefillVersion() || '22'); });
}

// Nachher
protected readonly versionInput = linkedSignal({
  source: this.prefillVersion,
  computation: (v, prev) => v || prev?.value || '22'
});
```

Das Template nutzt `[ngModel]="versionInput()"` und
`(ngModelChange)="versionInput.set($event)"`.
Der Konstruktor und der `effect()` wurden vollständig entfernt.

---

### Schritt 4 – Zentrales Error-Handling

**Neue Dateien:**
- `apps/web/src/app/core/http-error.interceptor.ts`
- `apps/web/src/app/core/global-error-handler.ts`

Zwei neue Mechanismen für konsistente Fehlerbehandlung:

**HTTP-Interceptor** normalisiert `HttpErrorResponse` → `Error`:
```typescript
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const message = err.error?.error ?? err.message;
      return throwError(() => new Error(message));
    })
  );
```

**GlobalErrorHandler** als Safety-Net für unkontrollierte Fehler:
```typescript
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
  }
}
```

Registriert in `app.config.ts`:
```typescript
provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
{ provide: ErrorHandler, useClass: GlobalErrorHandler }
```

---

### Schritt 5 – `handleError` in `NvmApiService` vereinfachen

**Datei:** `apps/web/src/app/services/nvm-api.service.ts`

Die Methode `handleError` und alle `catchError(this.handleError)`-Pipes
wurden entfernt. Die Normalisierung übernimmt jetzt vollständig der
`httpErrorInterceptor` aus Schritt 4. Der Service besteht nur noch aus
schlanken HTTP-Aufrufen ohne eigene Fehlerbehandlung.

---

### Schritt 6 – Accessibility

**Betroffene Komponenten:** `install-modal`, `log-card`, `aliases-card`

| Verbesserung | Details |
|---|---|
| Fokus-Management im Modal | `viewChild`-basierter Fokus auf Schließen-Button beim Öffnen; Fokus-Wiederherstellung beim Schließen |
| Escape-Handling | Host-Listener `(document:keydown.escape)` schließt Modal – außer während `phase === 'running'` |
| Log-Region | `role="log"`, `aria-live="polite"`, `aria-relevant="additions"` |
| Inline-Confirm | `role="alert"` am Bestätigungs-Prompt |
| Modal-Semantik | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, `tabindex="-1"` |

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
