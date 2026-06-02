---
name: angular-expert
description: Expert-level Angular 17+ guidance for nvm-manager. Covers standalone components, Signals, HttpClient, reactive patterns, SCSS architecture, routing, and template control flow. Use when implementing Angular features, creating components, services, writing templates, handling HTTP, managing state with signals, or debugging Angular-specific issues in apps/web/.
---

# Angular Expert – nvm-manager

## Architektur-Prinzipien

- **Standalone-only**: Kein NgModule. Alle Komponenten, Pipes und Direktiven mit `standalone: true`.
- **Signal-first State**: `signal()`, `computed()`, `effect()` für lokalen Zustand. Kein Subject/BehaviorSubject für einfachen State.
- **Inject-Funktion**: `inject()` statt Konstruktor-DI bevorzugen.
- **Control Flow**: `@if`, `@for`, `@switch` (nicht `*ngIf`, `*ngFor`).

## Signals-Muster

```typescript
// Lokaler Zustand
readonly versions = signal<InstalledNodeVersion[]>([]);
readonly isLoading = signal(false);
readonly error = signal<string | null>(null);

// Derived state
readonly activeVersion = computed(() =>
  this.versions().find(v => v.active)
);

// Side effects (z.B. Auto-Reload nach Änderung)
effect(() => {
  if (this.versions().length > 0) {
    console.log('Versionen geladen:', this.versions().length);
  }
});
```

## HttpClient-Patterns

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

## Template-Muster (nvm-manager spezifisch)

```html
<!-- Loading-State mit Deaktivierung -->
<button [disabled]="isLoading()" (click)="install()">
  @if (isLoading()) { Installiere ... } @else { Installieren }
</button>

<!-- Versions-Tabelle -->
@if (hasVersions()) {
  <table>
    @for (v of versions(); track v.version) {
      <tr [class.active]="v.active">
        <td>{{ v.version }}</td>
        <td>{{ v.active ? 'Aktiv' : '' }}</td>
        <td>{{ v.default ? 'Default' : '' }}</td>
      </tr>
    }
  </table>
}
```

## SCSS-Architektur

```
src/
├── styles.scss         # Global imports, CSS-Reset
├── _variables.scss     # Farben, Spacing, Breakpoints
└── app/
    └── components/
        └── version-card/
            └── version-card.component.scss  # BEM-Scope
```

Variablen-Beispiel:
```scss
// _variables.scss
$color-primary: #4caf50;
$color-danger: #f44336;
$color-text: #212121;
$spacing-md: 1rem;
$border-radius: 6px;
```

## Routing (zukunftssicher)

```typescript
// app.routes.ts – lazy-loading bereit für spätere Features
export const routes: Routes = [
  { path: '', component: DashboardComponent },
  {
    path: 'projects',
    loadComponent: () => import('./projects/projects.component').then(m => m.ProjectsComponent)
  }
];
```

## Service-Architektur

Services in `apps/web/src/app/services/`:
- `nvm-api.service.ts` – HTTP-Kommunikation zum Backend
- Kein State in Services im MVP; State gehört zur Komponente via Signals

## Fehler-UX

```typescript
// In der Komponente
protected onError(message: string): void {
  this.error.set(message);
  // Optional: Auto-clear nach 5s
  setTimeout(() => this.error.set(null), 5000);
}
```

## Weitere Ressourcen

- Für SCSS-Konventionen: siehe Rule `angular-standalone.mdc`
- Für Typen: `apps/web/src/app/models/nvm.models.ts`
