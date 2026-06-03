import type { Page, Route } from '@playwright/test';

/**
 * Deterministic, non-destructive API mocking for the nvm-manager GUI.
 *
 * All `/api/**` calls are intercepted in the browser before they reach the
 * real backend, so the click-flow tests never run actual nvm commands
 * (no real installs/uninstalls) and are fully reproducible.
 *
 * Per-test overrides: register a more specific `page.route(...)` AFTER calling
 * `mockNvmApi` – Playwright gives precedence to the most recently added route.
 */

export type ApiFixtures = {
  status?: unknown;
  installed?: unknown;
  remote?: unknown;
  aliases?: unknown;
  /** Default response for every mutation (POST/DELETE). */
  command?: unknown;
};

export const defaultFixtures = {
  status: {
    ok: true,
    nvmVersion: '0.39.0',
    nvmLatestVersion: '0.40.4', // > nvmVersion → "Aktualisieren" appears
    nvmDir: '/home/dev/.nvm',
  },
  installed: {
    stdout: '',
    stderr: '',
    versions: [
      { version: '22.11.0', active: true, default: true, system: false, stable: false, unstable: false, iojs: false },
      { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
    ],
  },
  remote: {
    stdout: '',
    stderr: '',
    versions: [
      { version: '22.11.0', lts: 'Jod' },
      { version: '21.7.3', lts: null },
      { version: '20.5.0', lts: 'Iron' },
    ],
  },
  aliases: {
    stdout: '',
    stderr: '',
    aliases: [
      { name: 'default', target: 'lts/*', resolved: 'v22.11.0', editable: true, deletable: false },
      { name: 'my-project', target: '20', resolved: 'v20.5.0', editable: true, deletable: true },
    ],
  },
  command: { stdout: 'OK', stderr: '' },
};

export async function mockNvmApi(page: Page, fixtures: ApiFixtures = {}): Promise<void> {
  const f = { ...defaultFixtures, ...fixtures };

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    const json = (body: unknown, status = 200): Promise<void> =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'GET') {
      if (path.endsWith('/api/status')) return json(f.status);
      if (path.endsWith('/api/versions/installed')) return json(f.installed);
      if (path.endsWith('/api/versions/remote')) return json(f.remote);
      if (path.endsWith('/api/versions/aliases')) return json(f.aliases);
    }

    // All mutations (install/use/default/uninstall/alias create+delete/update).
    return json(f.command);
  });
}

/** Convenience: make a single endpoint fail with the given API error body. */
export async function failEndpoint(
  page: Page,
  globPattern: string,
  message: string,
  status = 500,
): Promise<void> {
  await page.route(globPattern, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message, stdout: '', stderr: message }),
    }),
  );
}
