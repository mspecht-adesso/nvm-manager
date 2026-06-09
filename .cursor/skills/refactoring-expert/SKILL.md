---
name: refactoring-expert
description: Expert guidance for refactoring the nvm-manager codebase safely. Covers identifying code smells in Angular components and Express handlers, deciding when to extract components or services, renaming and moving files without breaking imports, and preserving test coverage during restructuring. Use when a component is growing too large, when logic is duplicated, when a service should be split, when imports need reorganising, or when asking "should I extract this?".
---

# Refactoring Expert – nvm-manager

## 1. When to Extract a Component

Extract when **two or more** of these are true:

| Signal | Example |
|--------|---------|
| Template > ~60 lines | `installed-versions-card` grows beyond table + actions |
| Logic duplicated in another component | Same loading/error pattern in 3 organisms |
| Unit can be reused elsewhere | A "version badge" used in 3 places |
| Template has multiple distinct sections | Header + filter + table + pagination |

**Extraction checklist:**
1. Create the new component (standalone is the default in v22 — omit `standalone: true`)
2. Move `input()` signals + `output()` events to the new component
3. Parent passes data down, listens for events up – no direct service injection in deeply nested atoms/molecules
4. Move the spec file, update describe block name
5. Remove unused imports from the parent

---

## 2. When to Extract a Service

Extract when a component holds **non-UI logic** that:
- Is needed by more than one component, **or**
- Makes HTTP calls, **or**
- Manages shared state (use `NvmStateService` pattern)

**Do NOT extract** if the logic is purely presentational (formatting, visibility flags).

**Pattern for shared state service:**

```typescript
// nvm-state.service.ts — read state via httpResource (Angular 22)
@Injectable({ providedIn: 'root' })
export class NvmStateService {
  private readonly installed = httpResource<InstalledVersionsResponse>(
    () => '/api/versions/installed',
  );
  readonly versions      = computed(() => this.installed.value()?.versions ?? []);
  readonly activeVersion = computed(() => this.versions().find((v) => v.active));
  readonly isLoading     = this.installed.isLoading;

  refresh(): void { this.installed.reload(); }
}
```

---

## 3. Code Smells – nvm-manager Specific

### Angular

| Smell | Bad | Better |
|-------|-----|--------|
| State in template | `*ngIf="versions.length > 0"` | `hasVersions = computed(...)` |
| Direct service call in template | `{{ service.getLabel(v) }}` | `computed()` or `pipe` |
| Missing `track` | `@for (v of versions())` | `@for (v of versions(); track v.version)` |
| Missing `OnPush` | Default change detection | `ChangeDetectionStrategy.OnPush` |
| `any` in HTTP call | `http.get<any>(...)` | `http.get<InstalledVersionsResponse>(...)` |
| Component > 200 lines | Monolithic component | Extract sub-components |

### Express

| Smell | Bad | Better |
|-------|-----|--------|
| Inline validation | `if (!req.body.version.match(...))` | `isValidVersionInput()` guard |
| Missing `next(err)` | `catch(e) { res.status(500)... }` | `catch(e) { next(e) }` |
| `console.log` in handler | Debug logs left in | Remove or use `morgan` |
| Logic in route file | 80-line route handler | Extract to `nvm.service.ts` |
| Hardcoded port/URL | `listen(3789)` | `process.env.PORT ?? 3789` |

---

## 4. Safe Rename / Move Workflow

Angular file moves break import paths. Follow this order:

1. **Rename the file** with your IDE's rename (Cursor: F2 or right-click → Rename) to auto-update imports
2. **Verify** `grep -r "old-name" apps/web/src/` returns 0 hits
3. **Update the barrel** if one exists (usually none in this project – standalone components import directly)
4. **Run lint**: `npm run lint --prefix apps/web`
5. **Run tests**: `npm test --prefix apps/web`

For Express files (`apps/api/`):
- Module resolution is `NodeNext` – `.js` extensions required in imports even for `.ts` sources
- After moving: `grep -r "old-name" apps/api/src/`

---

## 5. Refactoring Without Breaking Tests

Before refactoring:
```bash
npm test   # establish green baseline
```

During refactoring:
- Keep the **public API** (function signatures, Input/Output names) identical
- Move only **private** logic; rename publicly only after tests pass
- Run tests after each logical step, not just at the end

After refactoring:
```bash
npm test   # confirm still green
npm run lint  # confirm no new lint errors
```

---

## 6. Type Alignment Between Frontend and Backend

The frontend (`apps/web/src/app/models/nvm.models.ts`) and backend (`apps/api/src/nvm/nvm.types.ts`) maintain **separate type definitions** by design (no shared package). When refactoring API responses:

1. Update the backend type in `nvm.types.ts`
2. Update the corresponding frontend type in `nvm.models.ts`
3. Update the parser in `nvm.parser.ts` if the shape changes
4. Run both test suites: `npm test`

Never copy types between packages – each defines exactly what it needs.
