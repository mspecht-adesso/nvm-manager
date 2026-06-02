---
name: testing-expert
description: Expert guidance for testing the nvm-manager project. Covers Vitest unit tests for Express API, Supertest integration tests for HTTP routes, Angular component testing with @testing-library/angular, Playwright E2E tests, mocking nvm shell commands, test coverage configuration, and CI-ready test setup. Use when writing tests, setting up test infrastructure, fixing failing tests, mocking child_process, or configuring coverage.
---

# Testing Expert – nvm-manager

## Test-Strategie

| Ebene | Tool | Verzeichnis | Was testen |
|-------|------|-------------|------------|
| Unit (API) | Vitest | `apps/api/src/**/*.spec.ts` | Parser, Validierung, Services |
| Integration (API) | Vitest + Supertest | `apps/api/src/routes/*.spec.ts` | HTTP-Routen, Status-Codes |
| Unit (Angular) | Vitest + @testing-library/angular | `apps/web/src/**/*.spec.ts` | Komponenten, Services |
| E2E | Playwright | `apps/e2e/` | User-Flows im Browser |

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
  it('parst aktive Default-Version', () => {
    const stdout = '->     v22.11.0 (default)\n       v20.5.0\n       system';
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ version: '22.11.0', active: true, default: true });
    expect(result[1]).toMatchObject({ version: '20.5.0', active: false, default: false });
  });

  it('gibt [] bei leerem stdout zurück', () => {
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
    'akzeptiert "%s"', (v) => expect(isValidVersionInput(v)).toBe(true)
  );

  it.each(['../etc', '; rm -rf', '', 42, null, 'lts/iron'])(
    'lehnt "%s" ab', (v) => expect(isValidVersionInput(v)).toBe(false)
  );
});
```

## API – Route-Integration (Supertest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// App als Funktion exportieren (nicht app.listen() direkt in server.ts)
import { createApp } from '../../server.js';
import * as svc from '../nvm/nvm.service.js';

vi.mock('../nvm/nvm.service.js');

describe('POST /api/versions/install', () => {
  const app = createApp();

  beforeEach(() => vi.clearAllMocks());

  it('gibt 400 bei ungültiger Version', async () => {
    const res = await request(app).post('/api/versions/install').send({ version: 'evil; rm -rf /' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('gibt 200 bei gültiger Version', async () => {
    vi.mocked(svc.install).mockResolvedValue({ stdout: 'Now using node v22', stderr: '' });
    const res = await request(app).post('/api/versions/install').send({ version: '22' });
    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain('v22');
  });

  it('gibt 500 wenn nvm fehlschlägt', async () => {
    vi.mocked(svc.install).mockRejectedValue(new Error('nvm: version not found'));
    const res = await request(app).post('/api/versions/install').send({ version: '999' });
    expect(res.status).toBe(500);
  });
});
```

**Wichtig:** `server.ts` muss `createApp()` und `startServer()` trennen damit Supertest ohne Port-Konflikt testen kann:
```typescript
export function createApp(): Express { /* alle middleware + routes */ return app; }
if (process.env.NODE_ENV !== 'test') { createApp().listen(3789, '127.0.0.1'); }
```

## Angular – Setup

```bash
npm install --save-dev vitest @vitest/browser @testing-library/angular jsdom --prefix apps/web
```

## Angular – Component-Test

```typescript
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NvmApiService } from '../services/nvm-api.service';
import { AppComponent } from './app';

describe('AppComponent', () => {
  it('zeigt nvm-Status an', async () => {
    const mockSvc = { getStatus: vi.fn().mockReturnValue(of({ ok: true, nvmVersion: '0.39.7' })) };
    await render(AppComponent, { providers: [{ provide: NvmApiService, useValue: mockSvc }] });
    expect(await screen.findByText(/0\.39\.7/)).toBeInTheDocument();
  });
});
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

Beispiel-Test:
```typescript
test('zeigt Status-Card mit nvm-Version', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('nvm Manager')).toBeVisible();
  await expect(page.locator('.status-card')).toContainText(/\d+\.\d+\.\d+/);
});
```

## Root-Scripts ergänzen

```json
"test": "npm run test --prefix apps/api",
"test:coverage": "npm run test:coverage --prefix apps/api",
"test:e2e": "npx playwright test --config=apps/e2e/playwright.config.ts"
```
