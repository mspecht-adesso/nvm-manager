---
name: code-review-expert
description: Structured code review for nvm-manager against project standards. Covers security review of nvm shell execution and input validation, Angular standalone/Signals/a11y checks, Express handler and error-middleware checks, test coverage, and severity-graded feedback. Use when reviewing a diff, a pull request, staged changes, or when the user asks for a code review or "look over my changes".
---

# Code Review Expert – nvm-manager

Review changes against this project's standards. Inspect the diff first (`git diff`, `git diff --staged`, or the PR), then report findings graded by severity.

## Review Workflow

1. Get the diff scope: `git diff origin/main...HEAD` or `git diff --staged`
2. Categorise each changed file: API / Web / tests / docs / cursor-config
3. Apply the relevant checklist below
4. Report using the severity format

## Severity Format

- 🔴 **Critical** – must fix before merge (security, data loss, broken build)
- 🟡 **Suggestion** – should improve (maintainability, missing test)
- 🟢 **Nice to have** – optional polish

Reference exact `file:line` for each finding. If nothing is wrong, say so – do not invent issues.

## Security Review (highest priority)

This backend executes shell commands. Scrutinise every change touching `apps/api/`:

- [ ] Any version/user input reaches a shell call **only** after `isValidVersionInput()`
- [ ] Single-quote escaping applied at call time (`nvm.service.ts`)
- [ ] No new endpoint runs arbitrary commands; nvm whitelist respected (`nvm-security` rule)
- [ ] Server still binds to `127.0.0.1` only; CORS still limited to `localhost:4201/4200`
- [ ] No `req.body`/`req.query` interpolated into a command string
- [ ] No secrets logged; invalid input not echoed back verbatim

## API / Express Checklist

- [ ] Handlers typed (`RequestHandler`), wrapped in try/catch with `next(err)`
- [ ] Errors flow through central error middleware; consistent JSON shape
- [ ] `async` correct – no floating promises, awaited or `void`-cast
- [ ] No `any`; explicit return types on exported functions
- [ ] New logic (parser/validator) has Vitest unit tests; routes have Supertest tests

## Angular / Web Checklist (Angular 22)

- [ ] No redundant `standalone: true` (default in v22), no NgModule; `inject()` over constructor DI
- [ ] `ChangeDetectionStrategy.OnPush` declared explicitly; zoneless-safe (no Zone.js-dependent ticking)
- [ ] State via Signals/`computed()`; signal-based `input()`/`output()`/`model()`; `@if`/`@for` control flow
- [ ] GET reads via `httpResource()`; mutations via `HttpClient`; validated inputs via Signal Forms
- [ ] HTTP errors surfaced (not swallowed into `EMPTY`); resource `error()` handled
- [ ] A11y: accessible button names, `scope` on `<th>`, `aria-live` for dynamic content, modal focus trap (see `a11y` rule / `a11y-expert` skill)
- [ ] No duplicated model types; `nvm.models.ts` is the single source

## Cross-cutting

- [ ] CHANGELOG updated for user/developer-relevant changes
- [ ] Commit messages follow Conventional Commits (`commit-conventions` rule)
- [ ] Comments in English; no leftover `console.log`, debug code, or TODOs without context
- [ ] Definition of Done satisfied (build/lint/test green)

## Output Template

```markdown
## Review Summary
<1–2 sentences: overall assessment + merge readiness>

### 🔴 Critical
- `apps/api/src/...:42` – <issue + concrete fix>

### 🟡 Suggestions
- `apps/web/src/...:88` – <issue + suggestion>

### 🟢 Nice to have
- ...

### ✅ Looks good
- <briefly note what was done well>
```
