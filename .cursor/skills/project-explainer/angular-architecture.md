# Angular Architecture – nvm-manager

## Component Hierarchy (Atomic Design)

```
App (root component)
├── AppHeaderComponent          – title, nvm version, global status
├── StatusCardComponent         – nvm connection status (GET /api/status)
├── ActionCardComponent         – input for "Install" / "Use"
├── InstalledVersionsCardComponent – list of installed Node.js versions
├── AliasesCardComponent        – nvm alias management
├── RemoteVersionsCardComponent – available Node.js versions from nodejs.org
├── LogCardComponent            – live activity log
└── InstallModalComponent       – modal progress indicator for actions

Atoms (reusable building blocks):
  └── SpinnerComponent, LoadingStateComponent

Molecules:
  └── CardComponent             – generic card wrapper with ng-content slots
```

## State Management with Angular Signals

The root component `App` holds all application-wide state:

```typescript
// apps/web/src/app/app.ts
readonly log = signal<LogEntry[]>([]);
readonly isLoading = signal(false);
readonly installedVersions = signal<InstalledNodeVersion[]>([]);
readonly installedLoading = signal(false);
readonly installModal = signal<InstallModalState>(null);
readonly aliasesRefreshTrigger = signal(0);

// Derived state
readonly activeVersion = computed(() =>
  this.installedVersions().find((v) => v.active)
);
```

**Why in the root component?**
The state is needed by multiple cards simultaneously (e.g. `isLoading` blocks
ActionCard and InstalledVersionsCard at the same time). Lifting state up to the root
prevents prop-drilling across multiple levels and makes the data flow explicit.

**Why `aliasesRefreshTrigger`?**
`AliasesCardComponent` has its own `NvmApiService` call. After `useVersion()`
or `setDefault()` in the root, the alias list must be reloaded – without
re-rendering the entire app. An incremented signal triggers `ngOnChanges`
in the AliasesCard, which then reloads itself.

## Data Communication: Input/Output Contract

Cards are **pure presentation components** – they receive data via `@Input()`
and emit actions via `@Output()`:

```typescript
// InstalledVersionsCardComponent
@Input() versions: InstalledNodeVersion[] = [];
@Input() loading = false;
@Output() useVersion = new EventEmitter<string>();
@Output() refresh = new EventEmitter<void>();
```

The actual HTTP logic lives exclusively in:
- `App` (root): for actions with app-wide state impact
- `AliasesCardComponent`: self-contained, as alias state is local
- `RemoteVersionsCardComponent`: self-contained (remote data is independent)

## NvmApiService

`apps/web/src/app/services/nvm-api.service.ts`

**Injectable with `providedIn: 'root'`** → singleton, no explicit provision
in an AppModule needed (there is none – the app is standalone).

All methods return `Observable<T>` with `.pipe(catchError(...))`.
The error handler extracts `err.error?.error ?? err.message` – this way the
error message from the Express backend reaches the UI directly.

**Proxy configuration:** `proxy.conf.json` forwards `/api` → `http://127.0.0.1:3789`
during `ng serve`. In a production build no proxy is needed since API and frontend
would be served from the same origin.

## InstallModalComponent – Why OnChanges?

The modal shows progress (running → success/error) and closes automatically after 3 s
on success. The timer is managed via `ngOnChanges` on `state`:

```typescript
ngOnChanges(changes: SimpleChanges): void {
  if (changes['state']) {
    clearTimeout(this.autoCloseTimer);
    if (this.state?.phase === 'success') {
      this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
    }
  }
}
```

**Why not a Signal + effect()?**
`InstallModalState` is a discriminated union type (`null | { phase: ... }`).
`ngOnChanges` reacts directly to reference changes of the `@Input()` signal from the
root component and is semantically clearer than an `effect()` for I/O management.

## App Configuration (Standalone Bootstrap)

`apps/web/src/app/app.config.ts` configures:
- `provideHttpClient(withInterceptors([httpErrorInterceptor]))` – the fetch backend is
  the default in Angular 22, so `withFetch()` is no longer needed
- `provideZonelessChangeDetection()` – the app runs without Zone.js
- `provideRouter(routes)` – routing (currently one route, prepared for extensions)

There is no `AppModule`. Standalone components (the default since Angular 19+) need no NgModule.

## Component Highlights

### StatusCardComponent
Polls `GET /api/status` and displays nvm version + NVM_DIR.
Shows "not connected" when the Express server is not running.

### RemoteVersionsCardComponent
Loads `GET /api/versions/remote` (can be slow – nodejs.org network request).
Therefore loaded lazily (only on user interaction, not on app start).

### AliasesCardComponent
Holds local state for inline editing of aliases.
Uses `aliasesRefreshTrigger` as `@Input()` and re-fetches from the API
when it changes (via `ngOnChanges`).

### LogCardComponent
Receives `LogEntry[]` and renders them as a timestamped log.
Maximum entries: 20 (capped in `App.addLog()` via `.slice(0, 19)`).
