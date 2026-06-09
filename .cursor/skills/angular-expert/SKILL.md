---
name: angular-expert
description: Expert-level Angular 22 guidance for nvm-manager. Covers standalone components, Signals, httpResource, Signal Forms, zoneless change detection, HttpClient mutations, SCSS architecture, routing, and template control flow. Use when implementing Angular features, creating components, services, writing templates, fetching data, building forms, managing state with signals, or debugging Angular-specific issues in apps/web/.
---

# Angular Expert – nvm-manager (Angular 22)

The frontend targets **Angular 22** and runs **zoneless**
(`provideZonelessChangeDetection()`, no `zone.js`). `httpResource`, `resource`,
`rxResource` and **Signal Forms** are all **stable** in v22 — no experimental flags.

## Architecture Principles

- **Standalone-only**: No NgModule. Standalone is the **default** in v22 — **omit the
  redundant `standalone: true`** flag.
- **OnPush everywhere**: `OnPush` is the v22 default; still declare it explicitly per component.
- **Signal-first state**: `signal()`, `computed()`, `effect()`, `linkedSignal()` for state.
  Signal-based APIs over decorators: `input()`/`output()`/`model()`/`viewChild()`.
  No Subject/BehaviorSubject for simple state.
- **Declarative data**: `httpResource()` for GET reads; `HttpClient` only for mutations.
- **Inject function**: Prefer `inject()` over constructor DI.
- **Control flow**: `@if`, `@for`, `@switch`, `@let` (not `*ngIf`, `*ngFor`).

## Signals Patterns

```typescript
// Local state
readonly versions = signal<InstalledNodeVersion[]>([]);
readonly isLoading = signal(false);
readonly error = signal<string | null>(null);

// Derived state
readonly activeVersion = computed(() =>
  this.versions().find(v => v.active)
);

// Side effects (e.g. auto-reload after change)
effect(() => {
  if (this.versions().length > 0) {
    console.log('Versions loaded:', this.versions().length);
  }
});
```

## Data fetching: `httpResource` (reads) + `HttpClient` (mutations)

**GET endpoints → `httpResource`.** Declarative, signal-backed, no manual subscribe.
The URL factory is reactive: return `undefined` to make it lazy.

```typescript
import { httpResource } from '@angular/common/http';

// Eager read
private readonly installed = httpResource<InstalledVersionsResponse>(
  () => '/api/versions/installed',
);
readonly versions = computed(() =>
  this.installed.hasValue() ? (this.installed.value()?.versions ?? []) : [],
);
readonly isLoading = this.installed.isLoading;

// Lazy read — only fires once shouldLoad() is true
private readonly remote = httpResource<RemoteVersionsResponse>(
  () => (this.shouldLoad() ? '/api/versions/remote' : undefined),
);

// Re-fetch on demand
refresh(): void { this.installed.reload(); }
```

Surface a resource's failure (don't swallow it) — e.g. forward it to the activity log:

```typescript
effect(() => {
  const err = this.installed.error();
  if (err) this.logged.emit({ message: (err as Error).message, type: 'error' });
});
```

**POST/DELETE mutations → thin `HttpClient` service** (`nvm-api.service.ts`). Errors are
normalised globally by `httpErrorInterceptor`, so no per-call `catchError`:

```typescript
private readonly http = inject(HttpClient);
private readonly baseUrl = '/api';

installVersion(version: string): Observable<NvmCommandResult> {
  return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/install`, { version });
}
```

> `provideHttpClient(withInterceptors([httpErrorInterceptor]))` — the fetch backend is
> the v22 default, so **no `withFetch()`**.

## Signal Forms (`@angular/forms/signals`)

For validated inputs, prefer Signal Forms over `FormsModule`/`ngModel`:

```typescript
import { form, FormField, required, pattern, disabled } from '@angular/forms/signals';

// @Component({ imports: [FormField] })
readonly versionInput = signal('22');
readonly versionForm = form(this.versionInput, (f) => {
  required(f, { message: 'Bitte eine Version angeben.' });
  pattern(f, /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/, { message: 'Ungültiges Format.' });
  disabled(f, { when: () => this.isLoading() });
});
```

```html
<input id="version" [formField]="versionForm" />
@let field = versionForm();
@if (field.touched() && field.invalid()) {
  <span id="versionError" role="alert">
    @for (e of field.errors(); track e.kind) { {{ e.message }} }
  </span>
}
<button (click)="onInstall()" [disabled]="isLoading() || field.invalid()">Installieren</button>
```

Mirror backend validators client-side for instant feedback; the API still validates
independently (defence in depth).

## Template Patterns (nvm-manager specific)

```html
<!-- Loading state with disabled button -->
<button [disabled]="isLoading()" (click)="install()">
  @if (isLoading()) { Installing... } @else { Install }
</button>

<!-- Versions table -->
@if (hasVersions()) {
  <table>
    @for (v of versions(); track v.version) {
      <tr [class.active]="v.active">
        <td>{{ v.version }}</td>
        <td>{{ v.active ? 'Active' : '' }}</td>
        <td>{{ v.default ? 'Default' : '' }}</td>
      </tr>
    }
  </table>
}
```

## SCSS Architecture

```
src/
├── styles.scss         # Global imports, CSS reset
├── _variables.scss     # Colors, spacing, breakpoints
└── app/
    └── components/
        └── version-card/
            └── version-card.component.scss  # BEM scope
```

Variables example:
```scss
// _variables.scss
$color-primary: #4caf50;
$color-danger: #f44336;
$color-text: #212121;
$spacing-md: 1rem;
$border-radius: 6px;
```

## Routing (future-proof)

```typescript
// app.routes.ts – lazy-loading ready for future features
export const routes: Routes = [
  { path: '', component: DashboardComponent },
  {
    path: 'projects',
    loadComponent: () => import('./projects/projects.component').then(m => m.ProjectsComponent)
  }
];
```

## Service Architecture

Services in `apps/web/src/app/services/`:
- `nvm-api.service.ts` – thin `HttpClient` wrapper for **mutation** endpoints only
  (install/use/uninstall/alias edits). Read endpoints are consumed via `httpResource`.
- `nvm-state.service.ts` – app-wide signal state (active version, install modal, log)
  plus the installed-versions `httpResource`. Signals + `computed()` replace NgRx.

## Error UX

```typescript
// In the component
protected onError(message: string): void {
  this.error.set(message);
  // Optional: auto-clear after 5s
  setTimeout(() => this.error.set(null), 5000);
}
```

## Dependency Hygiene

- **No unused devDependencies**: if a tool is not referenced in any config or script (e.g. a formatter whose config lives at the root), remove it from `apps/web/package.json`.
- **No `"latest"` versions**: pin with caret ranges (`"^x.y.z"`). The Angular packages use `"^22.x.x"` — keep `@angular/*`, `@angular/cli`, `@angular/build` and `angular-eslint` aligned on the same major.
- **No duplicate model types**: types in `apps/web/src/app/models/nvm.models.ts` are the single source of truth for the frontend. Do not copy them to or from the backend.

## Further Resources

- For SCSS conventions: see rule `angular-standalone.mdc`
- For types: `apps/web/src/app/models/nvm.models.ts`
