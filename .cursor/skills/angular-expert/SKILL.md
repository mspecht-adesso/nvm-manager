---
name: angular-expert
description: Expert-level Angular 17+ guidance for nvm-manager. Covers standalone components, Signals, HttpClient, reactive patterns, SCSS architecture, routing, and template control flow. Use when implementing Angular features, creating components, services, writing templates, handling HTTP, managing state with signals, or debugging Angular-specific issues in apps/web/.
---

# Angular Expert – nvm-manager

## Architecture Principles

- **Standalone-only**: No NgModule. All components, pipes and directives with `standalone: true`.
- **Signal-first state**: `signal()`, `computed()`, `effect()` for local state. No Subject/BehaviorSubject for simple state.
- **Inject function**: Prefer `inject()` over constructor DI.
- **Control flow**: `@if`, `@for`, `@switch` (not `*ngIf`, `*ngFor`).

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

## HttpClient Patterns

```typescript
private readonly http = inject(HttpClient);
private readonly baseUrl = 'http://127.0.0.1:3789/api';

installVersion(version: string): Observable<NvmCommandResult> {
  return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/install`, { version }).pipe(
    tap(() => this.loadInstalledVersions()),
    catchError(this.handleError.bind(this))
  );
}

private handleError(err: HttpErrorResponse): Observable<never> {
  const msg = err.error?.error ?? err.message;
  this.error.set(msg);
  return EMPTY;
}
```

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
- `nvm-api.service.ts` – HTTP communication with the backend
- No state in services in the MVP; state belongs to the component via Signals

## Error UX

```typescript
// In the component
protected onError(message: string): void {
  this.error.set(message);
  // Optional: auto-clear after 5s
  setTimeout(() => this.error.set(null), 5000);
}
```

## Further Resources

- For SCSS conventions: see rule `angular-standalone.mdc`
- For types: `apps/web/src/app/models/nvm.models.ts`
