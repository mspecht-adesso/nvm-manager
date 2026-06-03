# Angular Best-Practice Findings – Abarbeitungsplan

> Basierend auf dem Review vom 03.06.2026 · Angular 21.2 · `apps/web/`

---

## Legende

- `[ ]` – offen
- `[x]` – erledigt
- Aufwand: **XS** < **S** < **M** < **L** < **XL**
- Impact: **Low** · **Medium** · **High**

---

## Schritt 1 – `index.html` fixen

**Aufwand:** XS · **Impact:** Medium

Datei: `apps/web/src/index.html`

- [x] `<title>Web</title>` → `<title>nvm Manager</title>`
- [x] `lang="en"` → `lang="de"` (App-Texte sind auf Deutsch)

---

## Schritt 2 – `provideHttpClient(withFetch())`

**Aufwand:** XS · **Impact:** Low

Datei: `apps/web/src/app/app.config.ts`

- [x] Import `withFetch` aus `@angular/common/http` hinzufügen
- [x] `provideHttpClient()` → `provideHttpClient(withFetch())`

Hintergrund: Angular 17.3+ unterstützt die native Fetch API als HttpClient-Backend.
Kleineres Bundle, besseres SSR-Handling, kein XHR mehr.

---

## Schritt 3 – SCSS-Variablen zentralisieren (DRY)

**Aufwand:** S · **Impact:** Medium

Aktuelles Problem: `$spacing-md`, `$spacing-lg`, `$border-radius` etc. werden in mehreren
Component-SCSS-Dateien neu deklariert (`app.scss`, `card.component.scss`).

### 3.1 Shared Partial anlegen

- [x] Datei `apps/web/src/styles/_variables.scss` anlegen
- [x] Alle SCSS-Variablen aus `styles.scss` (Zeilen 1–9) dorthin auslagern

```scss
// _variables.scss
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;
$border-radius: 8px;
$border-radius-sm: 4px;
```

### 3.2 `angular.json` anpassen

- [x] `stylePreprocessorOptions` in der `build`-Konfiguration ergänzen:

```json
"stylePreprocessorOptions": {
  "includePaths": ["src/styles"]
}
```

### 3.3 Component-Dateien bereinigen

- [x] Duplizierte Variable-Deklarationen aus `apps/web/src/app/app.scss` entfernen → `@use '../styles/variables' as *`
- [x] Duplizierte Variable-Deklarationen aus `apps/web/src/app/components/molecules/card/card.component.scss` entfernen → `@use '../../../../styles/variables' as *`
- [x] Alle weiteren Component-SCSS-Dateien auf lokale Redeklarat­ionen prüfen und bereinigen

---

## Schritt 4 – Signal Inputs / Outputs migrieren

**Aufwand:** M · **Impact:** High

Angular 17.1 führte `input()`, `input.required()` und `output()` als Funktionen ein.
Sie ersetzen `@Input()` / `@Output()` und integrieren sich direkt ins Signals-Modell.

### Vorher → Nachher

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

### Betroffene Dateien (eine nach der anderen abarbeiten)

- [x] `loading-state.component.ts` — `@Input({ required: true }) message` → `input.required<string>()`
- [x] `action-card.component.ts` — `@Input() isLoading`, `@Input() set prefillVersion`, alle `@Output()`
- [x] `installed-versions-card.component.ts` — `@Input() versions`, `@Input() raw`, `@Input() loading`, `@Input() isLoading`, alle `@Output()`
- [x] `aliases-card.component.ts` — `@Input() set refreshTrigger`, `@Input() installedVersions`, beide `@Output()`
- [x] `remote-versions-card.component.ts` — `@Input() installedVersions`, `@Input() isLoading`, beide `@Output()`
- [x] `log-card.component.ts` — `@Input() log`
- [x] `app-header.component.ts` — `@Input() activeVersion`
- [x] `install-modal.component.ts` — `@Input() state`, `@Output() closed`
- [x] `status-card.component.ts` — `@Output() nvmUpdate`

### Hinweise

- Templates anpassen: Signal-Inputs werden als Funktion aufgerufen: `isLoading()` statt `isLoading`
  (aber in den Child-Templates war das schon so, die Parent-Templates `[isLoading]="isLoading()"` bleiben gleich)
- `Input`, `Output`, `EventEmitter` aus den Imports entfernen, stattdessen `input`, `output` importieren
- `OnChanges` / `SimpleChanges` können nach Schritt 6 (effect) ebenfalls entfernt werden

---

## Schritt 5 – `ChangeDetectionStrategy.OnPush` auf alle Komponenten

**Aufwand:** M · **Impact:** High

Voraussetzung: Schritt 4 abgeschlossen (Signal Inputs).

Mit Signals und Signal Inputs löst Angular Change Detection präzise aus.
OnPush verhindert unnötige Default-CD-Zyklen in der gesamten Component-Tree.

### Betroffene Dateien

- [x] `app.ts` — `changeDetection: ChangeDetectionStrategy.OnPush` im `@Component`-Dekorator
- [x] `install-modal.component.ts`
- [x] `app-header.component.ts`
- [x] `app-footer.component.ts`
- [x] `status-card.component.ts`
- [x] `action-card.component.ts`
- [x] `installed-versions-card.component.ts`
- [x] `aliases-card.component.ts`
- [x] `remote-versions-card.component.ts`
- [x] `log-card.component.ts`
- [x] `card.component.ts`
- [x] `loading-state.component.ts`
- [x] `spinner.component.ts`

### Import

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

---

## Schritt 6 – `OnChanges` durch `effect()` ersetzen

**Aufwand:** S · **Impact:** Medium

Voraussetzung: Schritt 4 (Signal Inputs in `InstallModalComponent`).

Datei: `apps/web/src/app/components/install-modal/install-modal.component.ts`

### Vorher

```typescript
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
    clearTimeout(this.autoCloseTimer);
  }
}
```

### Nachher

```typescript
export class InstallModalComponent {
  readonly state = input<InstallModalState>(null);
  readonly closed = output<void>();

  constructor() {
    let autoCloseTimer: ReturnType<typeof setTimeout> | undefined;

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

- [x] `implements OnChanges, OnDestroy` entfernen
- [x] `ngOnChanges`, `ngOnDestroy`, `autoCloseTimer` entfernen
- [x] `effect()` im Konstruktor implementieren
- [x] `OnChanges`, `SimpleChanges`, `OnDestroy` aus Imports entfernen

---

## Schritt 7 – God Component auflösen: `NvmStateService`

**Aufwand:** L · **Impact:** High

Datei `apps/web/src/app/app.ts` enthält aktuell alle State-Signals und Event-Handler.
Ziel: State und Aktionen in einen `NvmStateService` auslagern. `app.ts` wird zum reinen Layout-Container.

### 7.1 `NvmStateService` anlegen

- [x] Datei `apps/web/src/app/services/nvm-state.service.ts` anlegen
- [x] Alle Signals aus `app.ts` in den Service verschieben:
  - `log`, `isLoading`, `installedVersions`, `installedRaw`, `installedLoading`,
    `installModal`, `prefillVersion`, `aliasesRefreshTrigger`, `activeVersion`
- [x] Alle Methoden aus `app.ts` in den Service verschieben:
  - `loadInstalledVersions`, `onInstall`, `onUseFromList`, `onUse`, `onSetDefault`,
    `onUninstall`, `onNvmUpdate`, `closeInstallModal`, `onLogged`, `addLog`
- [x] `NvmApiService` per `inject()` in den neuen Service einbinden

### 7.2 `app.ts` vereinfachen

- [x] Alle ausgelagerten Signals und Methoden durch `inject(NvmStateService)` ersetzen
- [x] Template auf `state.installedVersions()`, `state.onInstall($event)` etc. umschreiben
- [x] Nicht mehr benötigte Imports entfernen

### 7.3 Tests anpassen

- [x] `app.spec.ts` — Mock `NvmStateService` statt `NvmApiService`
- [x] `nvm-state.service.spec.ts` anlegen mit Unit-Tests für die ausgelagerte Logik

---

## Schritt 8 – `confirm()` durch Custom-Modal ersetzen

**Aufwand:** M · **Impact:** Medium

Datei: `apps/web/src/app/components/organisms/aliases-card/aliases-card.component.ts`

Aktuell (Zeile 174):
```typescript
if (!confirm(`Alias '${name}' wirklich löschen?`)) return;
```

### Ansatz: Signal-gesteuertes Inline-Confirm

- [x] Signal `confirmPendingAlias = signal<string | null>(null)` in `AliasesCardComponent` anlegen
- [x] `deleteAlias()` setzt zuerst nur `confirmPendingAlias.set(name)`, löscht noch nicht
- [x] Template: `@if (confirmPendingAlias() === alias.name)` zeigt Inline-Confirm mit „Ja, löschen" und „Abbrechen"
- [x] `confirmDelete()` ruft die eigentliche Delete-Logik auf und setzt `confirmPendingAlias.set(null)`
- [x] `cancelDelete()` setzt `confirmPendingAlias.set(null)`
- [x] `confirm()` komplett entfernt

---

## Schritt 9 – Zoneless Change Detection (optional / später)

**Aufwand:** XL · **Impact:** Low (kurzfristig)

Voraussetzung: Schritte 4 und 5 vollständig abgeschlossen.

Datei: `apps/web/src/app/app.config.ts`

```typescript
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(), // ersetzt Zone.js
    // ...
  ],
};
```

- [x] `zone.js` wird nicht verwendet — weder in `package.json` noch in `polyfills` noch als Import → Bundle war bereits zoneless
- [x] `provideZonelessChangeDetection()` in `app.config.ts` aktiviert — Angular 21 hat die stabile API bereits (kein "Experimental" mehr nötig)

> Stand: Zoneless ist seit Schritt 9 offiziell aktiv mit der stabilen API.

---

## Zusätzliche Kleinigkeiten (parallel zu jedem Schritt erledigbar)

- [x] `apps/web/src/app/components/organisms/app-footer/app-footer.component.spec.ts` anlegen (Mindest-Render-Test)
- [x] `installed-versions-card/` — dedizierte SCSS-Datei für Tabellen-Styles anlegen
- [x] Selektoren `app-app-header` / `app-app-footer` bereinigen (Option B: Selektor explizit überschrieben → `app-header` / `app-footer`)
- [x] `spinner.component.ts` — `.spinner`-Styles aus `styles.scss` in eigene `spinner.component.scss` verschoben und `styleUrl` ergänzt

---

## Fortschrittsübersicht

| Schritt | Beschreibung | Aufwand | Status |
|---------|-------------|---------|--------|
| 1 | index.html fixen | XS | erledigt |
| 2 | withFetch() | XS | erledigt |
| 3 | SCSS _variables.scss | S | erledigt |
| 4 | Signal Inputs/Outputs | M | erledigt |
| 5 | OnPush auf alle Components | M | erledigt |
| 6 | OnChanges → effect() | S | erledigt (mit Schritt 4) |
| 7 | NvmStateService | L | erledigt |
| 8 | confirm() → Custom-Modal | M | erledigt |
| 9 | Zoneless | XL | erledigt (stable API) |
