---
name: a11y-expert
description: Expert guidance for Web Accessibility (WCAG 2.1/2.2 AA) in the nvm-manager Angular app. Covers ARIA roles and attributes, keyboard navigation, focus management, screen reader patterns, live regions for dynamic content, accessible tables, modals and buttons. Use when implementing or reviewing Angular components for accessibility, adding aria-* attributes, managing focus traps, setting up aria-live regions, fixing a11y linter errors, or auditing templates against WCAG 2.1 AA criteria.
---

# A11y Expert – nvm-manager

Target standard: **WCAG 2.1 Level AA** (four principles: Perceivable, Operable, Understandable, Robust).

For a full audit checklist per component, see [CHECKLIST.md](CHECKLIST.md).

---

## 1. Landmark Regions

Every page must have exactly one `<main>` landmark. The app shell (`app.html`) wraps content in:

```html
<header role="banner">…</header>
<main id="main-content">…</main>
<footer role="contentinfo">…</footer>
```

Add a skip-link as the very first focusable element:

```html
<a class="skip-link" href="#main-content">Zum Inhalt springen</a>
```

```scss
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  &:focus { top: 1rem; }
}
```

---

## 2. Interactive Elements – Labels

Every interactive element must have an accessible name.

**Buttons in table rows** – always include `aria-label` to disambiguate:

```html
<button
  class="btn btn--xs btn--secondary"
  (click)="useVersion.emit(v.version)"
  [disabled]="isLoading() || v.active"
  [attr.aria-label]="'Version ' + v.version + ' verwenden'"
>
  Verwenden
</button>
```

**Icon-only buttons** – use `aria-label` + `aria-hidden` on the icon:

```html
<button class="btn btn--icon" aria-label="Einstellungen öffnen">
  <svg aria-hidden="true" focusable="false">…</svg>
</button>
```

**Form inputs** – always pair with `<label for="…">`:

```html
<label class="input-group__label" for="versionInput">Version</label>
<input id="versionInput" … [attr.aria-describedby]="'versionHint'" />
<span id="versionHint" class="input-group__hint">Erlaubt: node, stable, lts/*, 22, …</span>
```

---

## 3. Tables

```html
<table class="versions-table" aria-label="Installierte Node.js-Versionen">
  <caption class="visually-hidden">Installierte Node.js-Versionen</caption>
  <thead>
    <tr>
      <th scope="col">Version</th>
      <th scope="col">Status</th>
      <th scope="col">Aktionen</th>
    </tr>
  </thead>
  <tbody>
    @for (v of versions(); track v.version) {
      <tr [attr.aria-current]="v.active ? 'true' : null">
        <td>…</td>
      </tr>
    }
  </tbody>
</table>
```

Rules:
- `scope="col"` on all `<th>` elements
- `aria-current="true"` marks the active row (not `class` alone)
- `aria-label` or `<caption>` on the `<table>` element

---

## 4. Modal / Dialog

The existing `install-modal` already has `role="dialog"` and `aria-labelledby`. Add:

```html
<div class="modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="modal-title"
     aria-describedby="modal-body"
     tabindex="-1"
     #dialog>
  <h2 id="modal-title" class="modal__title">…</h2>
  <p  id="modal-body"  class="modal__body">…</p>
</div>
```

**Angular CDK FocusTrap** – use `cdkTrapFocus` to trap keyboard focus:

```html
<div class="modal" cdkTrapFocus cdkTrapFocusAutoCapture role="dialog" …>
```

```typescript
import { A11yModule } from '@angular/cdk/a11y';
// Add A11yModule to component imports[]
```

**Focus restore** – when the modal closes, return focus to the trigger:

```typescript
private readonly focusMonitor = inject(FocusMonitor);
private triggerEl: HTMLElement | null = null;

open(triggerEl: HTMLElement): void {
  this.triggerEl = triggerEl;
  // … open modal
}

close(): void {
  // … close modal
  this.triggerEl?.focus();
}
```

**SVGs in modal** – always `aria-hidden="true"` on decorative SVGs:

```html
<svg aria-hidden="true" focusable="false" …>…</svg>
```

---

## 5. Live Regions for Dynamic Content

Use `aria-live` to announce loading states and results:

```html
<!-- Loading indicator -->
<div aria-live="polite" aria-atomic="true" class="visually-hidden">
  @if (isLoading()) { Lade Daten … }
</div>

<!-- Operation result -->
<div role="status" aria-live="polite" aria-atomic="true" class="visually-hidden">
  {{ statusMessage() }}
</div>

<!-- Errors -->
<div role="alert" aria-live="assertive" aria-atomic="true">
  @if (errorMessage()) { {{ errorMessage() }} }
</div>
```

**Programmatic announcement** via Angular CDK `LiveAnnouncer`:

```typescript
private readonly announcer = inject(LiveAnnouncer);

async onInstallComplete(version: string): Promise<void> {
  await this.announcer.announce(`Node ${version} erfolgreich installiert.`, 'polite');
}
```

---

## 6. Keyboard Navigation

- All custom interactive elements must be reachable and operable via `Tab` / `Shift+Tab` / `Enter` / `Space`
- Dialogs close on `Escape`:

```typescript
@HostListener('keydown.escape')
onEscape(): void { this.close(); }
```

- Avoid `tabindex > 0`. Use `tabindex="0"` to add a non-interactive element to tab order, `-1` for programmatic focus only

---

## 7. Colour & Contrast

Minimum WCAG AA ratios (validate with browser DevTools or axe):
- Normal text: **4.5:1**
- Large text (≥18 pt / 14 pt bold): **3:1**
- UI components (buttons, inputs): **3:1** against adjacent colour

Add to `_variables.scss`:

```scss
// Accessibility helper
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
```

---

## 8. Angular CDK A11y Setup

Install if not present:

```bash
npm install @angular/cdk --save
```

Import in component:

```typescript
import { A11yModule } from '@angular/cdk/a11y';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FocusMonitor } from '@angular/cdk/a11y';
```

---

## Further Resources

- Full per-component audit checklist: [CHECKLIST.md](CHECKLIST.md)
- Angular CDK a11y docs: https://material.angular.io/cdk/a11y/overview
- WCAG 2.1 quick ref: https://www.w3.org/WAI/WCAG21/quickref/
