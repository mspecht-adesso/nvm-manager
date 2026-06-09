---
name: testing-expert
description: Expert guidance for testing the nvm-manager project. Covers Vitest unit tests for Express API, Supertest integration tests for HTTP routes, Angular component testing with @testing-library/angular, Playwright E2E tests, mocking nvm shell commands, test coverage configuration, and CI-ready test setup. Use when writing tests, setting up test infrastructure, fixing failing tests, mocking child_process, or configuring coverage.
---

# Testing Expert – nvm-manager

## Test Strategy

| Level | Tool | Directory | What to test |
|-------|------|-----------|--------------|
| Unit (API) | Vitest | `apps/api/src/**/*.spec.ts` | Parsers, validators, services |
| Integration (API) | Vitest + Supertest | `apps/api/src/routes/*.spec.ts` | HTTP routes, status codes |
| Unit (Angular) | Vitest + @testing-library/angular | `apps/web/src/**/*.spec.ts` | Components, services |
| E2E | Playwright | `apps/e2e/` | User flows in the browser |

## API – Setup

```bash
npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest --prefix apps/api
```

`apps/api/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/server.ts'],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
  },
});
```

`apps/api/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

## API – nvm.parser.spec.ts (Unit)

```typescript
import { describe, it, expect } from 'vitest';
import { parseInstalledVersions } from './nvm.parser.js';

describe('parseInstalledVersions', () => {
  it('parses the active default version', () => {
    const stdout = '->     v22.11.0 (default)\n       v20.5.0\n       system';
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ version: '22.11.0', active: true, default: true });
    expect(result[1]).toMatchObject({ version: '20.5.0', active: false, default: false });
  });

  it('returns [] for empty stdout', () => {
    expect(parseInstalledVersions('')).toEqual([]);
  });
});
```

## API – isValidVersionInput (Unit)

```typescript
import { describe, it, expect } from 'vitest';
import { isValidVersionInput } from './nvm.validator.js';

describe('isValidVersionInput', () => {
  it.each(['22', '22.11', '22.11.0', 'node', 'stable', 'lts/*'])(
    'accepts "%s"', (v) => expect(isValidVersionInput(v)).toBe(true)
  );

  it.each(['../etc', '; rm -rf', '', 42, null, 'lts/iron'])(
    'rejects "%s"', (v) => expect(isValidVersionInput(v)).toBe(false)
  );
});
```

## API – Route Integration (Supertest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Export app as factory (do not call app.listen() directly in server.ts)
import { createApp } from '../../server.js';
import * as svc from '../nvm/nvm.service.js';

vi.mock('../nvm/nvm.service.js');

describe('POST /api/versions/install', () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for an invalid version', async () => {
    const res = await request(app).post('/api/versions/install').send({ version: 'evil; rm -rf /' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 200 for a valid version', async () => {
    vi.mocked(svc.install).mockResolvedValue({ stdout: 'Now using node v22', stderr: '' });
    const res = await request(app).post('/api/versions/install').send({ version: '22' });
    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain('v22');
  });

  it('returns 500 when nvm fails', async () => {
    vi.mocked(svc.install).mockRejectedValue(new Error('nvm: version not found'));
    const res = await request(app).post('/api/versions/install').send({ version: '999' });
    expect(res.status).toBe(500);
  });
});
```

**Important:** `server.ts` must separate `createApp()` and `startServer()` so Supertest can test without port conflicts:
```typescript
export function createApp(): Express { /* all middleware + routes */ return app; }
if (process.env.NODE_ENV !== 'test') { createApp().listen(3789, '127.0.0.1'); }
```

## Angular – Setup

```bash
npm install --save-dev vitest @vitest/browser @testing-library/angular jsdom --prefix apps/web
```

## Angular – Component Test (mocked mutation service)

`NvmApiService` now only wraps **mutations**, so mock those methods directly:

```typescript
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { NvmApiService } from '../services/nvm-api.service';
import { ActionCardComponent } from './action-card.component';

describe('ActionCardComponent', () => {
  it('calls installVersion on click', async () => {
    const mockSvc = { installVersion: vi.fn().mockReturnValue(of({ stdout: 'ok', stderr: '' })) };
    await render(ActionCardComponent, {
      providers: [{ provide: NvmApiService, useValue: mockSvc }],
    });
    await userEvent.click(screen.getByRole('button', { name: /installieren/i }));
    expect(mockSvc.installVersion).toHaveBeenCalledWith('22');
  });
});
```

## Angular – Testing `httpResource` (zoneless)

Read endpoints use `httpResource`, which issues a real `HttpClient` request — test
with `HttpTestingController`, not a service mock. A pending request keeps the app
unstable (so `whenStable()` hangs): trigger the request, **flush**, then re-run
change detection. Errors flow through `httpErrorInterceptor` onto `error()`.

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { httpErrorInterceptor } from '../../../interceptors/http-error.interceptor';
import { StatusCardComponent } from './status-card.component';

describe('StatusCardComponent', () => {
  it('renders the nvm version after the resource resolves', async () => {
    await TestBed.configureTestingModule({
      imports: [StatusCardComponent],
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(StatusCardComponent);
    const httpMock = TestBed.inject(HttpTestingController);

    fixture.detectChanges();                                  // resource issues GET
    httpMock.expectOne('/api/status').flush({ ok: true, nvmVersion: '0.39.7' });
    fixture.detectChanges();                                  // propagate value

    expect(fixture.nativeElement.textContent).toContain('0.39.7');
    httpMock.verify();
  });
});
```

For a **service** (no fixture), drive effects with `ApplicationRef.tick()` instead of
`detectChanges()`. Drain reload requests in `afterEach`:

```typescript
afterEach(() => {
  httpMock.match(() => true).forEach((r) => { if (!r.cancelled) r.flush(EMPTY_RESPONSE); });
  httpMock.verify();
});
```

## Angular – Testing Signal Forms

Signals recompute on read, so set the model and assert validity synchronously:

```typescript
comp.versionInput.set('22');
expect(comp.versionForm().valid()).toBe(true);

comp.versionInput.set('rm -rf /');
expect(comp.versionForm().invalid()).toBe(true);
expect(comp.versionForm().errors().some((e) => e.kind === 'pattern')).toBe(true);
```

## Playwright E2E

```bash
npm init playwright@latest apps/e2e
```

`apps/e2e/playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:4200' },
  webServer: [
    { command: 'npm run dev:api', url: 'http://127.0.0.1:3789/api/status', reuseExistingServer: true },
    { command: 'npm run dev:web', url: 'http://localhost:4200', reuseExistingServer: true },
  ],
});
```

Example test:
```typescript
test('displays status card with nvm version', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('nvm Manager')).toBeVisible();
  await expect(page.locator('.status-card')).toContainText(/\d+\.\d+\.\d+/);
});
```

## Add Root Scripts

```json
"test": "npm run test --prefix apps/api",
"test:coverage": "npm run test:coverage --prefix apps/api",
"test:e2e": "npx playwright test --config=apps/e2e/playwright.config.ts"
```
