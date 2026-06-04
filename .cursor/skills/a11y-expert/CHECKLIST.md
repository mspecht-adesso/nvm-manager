# A11y Audit Checklist – nvm-manager Components

Use this checklist when reviewing or implementing templates. Mark ✅ when resolved.

---

## Global / App Shell (`app.html`)

- [ ] `<a class="skip-link" href="#main-content">` as first focusable element
- [ ] `<main id="main-content">` wraps primary content
- [ ] `<header role="banner">` and `<footer role="contentinfo">` present
- [ ] Page language set: `<html lang="de">`
- [ ] `<title>` is descriptive

---

## All Interactive Elements

- [ ] Every `<button>` has an accessible name (visible text or `aria-label`)
- [ ] Row-level buttons include version info in `aria-label` (e.g. "Version 22.11.0 verwenden")
- [ ] Icon-only buttons use `aria-label`; SVG has `aria-hidden="true" focusable="false"`
- [ ] Disabled state uses `[disabled]` attribute (not just CSS)
- [ ] Disabled buttons describe *why* if not obvious (via `title` or `aria-describedby`)

---

## Forms (`action-card.component.html`)

- [ ] `<label for="versionInput">` linked to input
- [ ] Hint text linked via `aria-describedby`
- [ ] Validation errors in `role="alert"` or `aria-live="assertive"` region
- [ ] Input autocomplete attribute set where applicable

---

## Tables (`installed-versions-card.component.html`)

- [ ] `<table aria-label="…">` or `<caption class="visually-hidden">…</caption>`
- [ ] All `<th>` have `scope="col"` (or `scope="row"`)
- [ ] Active row marked with `aria-current="true"`
- [ ] Empty-state message is in the DOM (not only visually implied)

---

## Modal / Dialog (`install-modal.component.html`)

- [ ] `role="dialog"` and `aria-modal="true"` present
- [ ] `aria-labelledby` points to the `<h2>` title
- [ ] `aria-describedby` points to the body paragraph
- [ ] `cdkTrapFocus` + `cdkTrapFocusAutoCapture` used (Angular CDK)
- [ ] Focus returned to trigger element on close
- [ ] `Escape` key closes the modal
- [ ] Backdrop click closes modal (where appropriate)
- [ ] All decorative SVGs have `aria-hidden="true" focusable="false"`

---

## Dynamic Content / Loading States

- [ ] Loading states announced via `aria-live="polite"` region or `LiveAnnouncer`
- [ ] Success/completion messages announced (`role="status"` or `aria-live="polite"`)
- [ ] Error messages announced immediately (`role="alert"` or `aria-live="assertive"`)
- [ ] `aria-busy="true"` on container while loading, removed after

---

## Badges & Status Indicators

- [ ] Coloured badges have text alternative (not colour alone)
- [ ] `aria-label` or `<span class="visually-hidden">` for screen readers where icon/badge is the only indicator

---

## Remote Versions Card (`remote-versions-card.component.html`)

- [ ] Version list/table has an accessible name
- [ ] "Installieren" buttons per row include the version in `aria-label`
- [ ] Pagination controls (if added) are keyboard-operable

---

## Aliases Card (`aliases-card.component.html`)

- [ ] Action buttons per alias row include the alias name in `aria-label`

---

## Log Card (`log-card.component.html`)

- [ ] Log output region has `role="log"` (implies `aria-live="polite"`, `aria-atomic="false"`)
- [ ] New entries are appended to the DOM (not replaced) so the live region announces them

---

## Colour & Contrast

- [ ] Text/background contrast ≥ 4.5:1 (normal text)
- [ ] Text/background contrast ≥ 3:1 (large text ≥ 18pt or 14pt bold)
- [ ] Button borders/outlines contrast ≥ 3:1 against adjacent background
- [ ] Focus indicator contrast ≥ 3:1; focus ring not removed without replacement
- [ ] Information not conveyed by colour alone

---

## Keyboard Navigation

- [ ] All functionality accessible without mouse
- [ ] Tab order follows visual order
- [ ] Focus visible at all times (no `outline: none` without replacement)
- [ ] No `tabindex` values greater than 0
- [ ] Custom keyboard shortcuts documented and not conflicting with browser/AT shortcuts
