import { test, expect } from '@playwright/test';
import { mockNvmApi, failEndpoint } from './support/mock-api';

/**
 * GUI click-flow tests for the common user journeys.
 *
 * Every test mocks the `/api/**` layer (see ./support/mock-api), so the flows
 * are deterministic and never trigger real nvm operations. The focus is on
 * what the user clicks and what the UI does in response (modals, logs,
 * list updates, inline confirmations, theme).
 */

const log = (page: import('@playwright/test').Page) => page.locator('app-log-card .log-entry');

// ── Status-Card ───────────────────────────────────────────────────────────────

test.describe('Status-Card', () => {
  test('zeigt API-Status und nvm-Version', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-status-card');
    await expect(card.getByText('Erreichbar')).toBeVisible();
    await expect(card.getByText('0.39.0')).toBeVisible();
  });

  test('„Aktualisieren" startet das nvm-Update und schreibt ins Log', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-status-card');
    await card.getByRole('button', { name: 'Aktualisieren' }).click();

    // Modal (nvm-update) erscheint und ein Log-Eintrag wird geschrieben.
    await expect(log(page).filter({ hasText: /nvm wurde auf .* aktualisiert/i }).first()).toBeVisible();
  });
});

// ── Aktions-Card ────────────────────────────────────────────────────────────────

test.describe('Aktions-Card', () => {
  test('Installieren-Flow schreibt Erfolgs-Log', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-action-card');
    await card.locator('input').first().fill('22');
    await card.getByRole('button', { name: /^Installieren$/i }).click();

    await expect(log(page).filter({ hasText: /Node 22 installiert/i }).first()).toBeVisible();
  });

  test('Verwenden-Flow schreibt Erfolgs-Log', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-action-card');
    await card.locator('input').first().fill('20');
    await card.getByRole('button', { name: /Verwenden/i }).click();

    await expect(log(page).filter({ hasText: /Node 20 aktiviert/i }).first()).toBeVisible();
  });

  test('„Als Default setzen" schreibt Erfolgs-Log', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-action-card');
    await card.locator('input').first().fill('22');
    await card.getByRole('button', { name: /Als Default setzen/i }).click();

    await expect(log(page).filter({ hasText: /als Default gesetzt/i }).first()).toBeVisible();
  });

  test('Fehlerfall öffnet Fehler-Modal und Escape schließt es', async ({ page }) => {
    await mockNvmApi(page);
    await failEndpoint(page, '**/api/versions/install', 'Download fehlgeschlagen');
    await page.goto('/');

    const card = page.locator('app-action-card');
    await card.locator('input').first().fill('99');
    await card.getByRole('button', { name: /^Installieren$/i }).click();

    const modal = page.locator('app-install-modal [role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: /fehlgeschlagen/i })).toBeVisible();

    // Accessibility: Escape schließt das Fehler-Modal.
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});

// ── Installierte Versionen ──────────────────────────────────────────────────────

test.describe('Installierte Versionen', () => {
  test('zeigt aktive und inaktive Version mit korrekten Badges', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-installed-versions-card');
    const activeRow = card.locator('tr', { hasText: 'v22.11.0' });
    await expect(activeRow.getByText('Aktiv')).toBeVisible();
    await expect(activeRow.getByText('Default')).toBeVisible();

    // Die aktive Version kann nicht deinstalliert werden.
    await expect(activeRow.getByRole('button', { name: /Deinstallieren/i })).toBeDisabled();
  });

  test('„Verwenden" auf einer inaktiven Version löst den Use-Flow aus', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-installed-versions-card');
    const row = card.locator('tr', { hasText: 'v20.5.0' });
    await row.getByRole('button', { name: /Verwenden/i }).click();

    await expect(log(page).filter({ hasText: /Node 20.5.0 aktiviert/i }).first()).toBeVisible();
  });

  test('„Aktualisieren" lädt die Liste neu', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-installed-versions-card');
    const reload = page.waitForResponse((r) => r.url().includes('/api/versions/installed'));
    await card.getByRole('button', { name: /Aktualisieren/i }).click();
    await reload;
  });
});

// ── Verfügbare Versionen (Remote) ───────────────────────────────────────────────

test.describe('Verfügbare Versionen', () => {
  test('„Laden" zeigt die Remote-Liste, Suche filtert, Installieren löst Flow aus', async ({ page }) => {
    // Die Remote-Card blendet bereits installierte Versionen aus – daher hier
    // ausschließlich nicht-installierte Versionen vorgeben.
    await mockNvmApi(page, {
      remote: {
        stdout: '',
        stderr: '',
        versions: [
          { version: '23.5.0', lts: null },
          { version: '21.7.3', lts: null },
          { version: '19.9.0', lts: 'Hydrogen' },
        ],
      },
    });
    await page.goto('/');

    const card = page.locator('app-remote-versions-card');
    await card.getByRole('button', { name: /Laden/i }).click();

    // Liste erscheint (alle drei sind nicht installiert).
    await expect(card.locator('tr', { hasText: 'v21.7.3' })).toBeVisible();
    await expect(card.locator('tbody tr')).toHaveCount(3);

    // Suche filtert auf eine Version.
    await card.getByPlaceholder(/Suche/i).fill('21');
    await expect(card.locator('tbody tr')).toHaveCount(1);

    // Installieren aus der Remote-Liste.
    await card.locator('tr', { hasText: 'v21.7.3' }).getByRole('button', { name: /Installieren/i }).click();
    await expect(log(page).filter({ hasText: /Node 21.7.3 installiert/i }).first()).toBeVisible();
  });
});

// ── Aliases ─────────────────────────────────────────────────────────────────────

test.describe('Aliases', () => {
  test('zeigt vorhandene Aliases', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-aliases-card');
    await expect(card.locator('tr', { hasText: 'default' })).toBeVisible();
    await expect(card.locator('tr', { hasText: 'my-project' })).toBeVisible();
  });

  test('legt einen neuen Alias an', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-aliases-card');
    await card.getByPlaceholder(/Name/i).fill('test-alias');
    await card.getByPlaceholder(/Ziel/i).fill('22');
    await card.getByRole('button', { name: /Anlegen/i }).click();

    await expect(log(page).filter({ hasText: /Alias 'test-alias' .* angelegt/i }).first()).toBeVisible();
  });

  test('Löschen erfordert eine Inline-Bestätigung', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-aliases-card');
    const row = card.locator('tr', { hasText: 'my-project' });

    await row.getByRole('button', { name: /^Löschen$/i }).click();
    await expect(row.getByText('Wirklich löschen?')).toBeVisible();

    await row.getByRole('button', { name: /Ja, löschen/i }).click();
    await expect(log(page).filter({ hasText: /Alias 'my-project' gelöscht/i }).first()).toBeVisible();
  });

  test('„Abbrechen" bricht das Löschen ab', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-aliases-card');
    const row = card.locator('tr', { hasText: 'my-project' });

    await row.getByRole('button', { name: /^Löschen$/i }).click();
    await expect(row.getByText('Wirklich löschen?')).toBeVisible();

    await row.getByRole('button', { name: /Abbrechen/i }).click();
    await expect(row.getByText('Wirklich löschen?')).not.toBeVisible();
    await expect(row.getByRole('button', { name: /^Löschen$/i })).toBeVisible();
  });

  test('Bearbeiten zeigt das Versions-Dropdown und speichert', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const card = page.locator('app-aliases-card');
    const row = card.locator('tr', { hasText: 'my-project' });

    await row.getByRole('button', { name: /Bearbeiten/i }).click();
    await expect(row.locator('select')).toBeVisible();

    await row.getByRole('button', { name: /Speichern/i }).click();
    await expect(log(page).filter({ hasText: /Alias 'my-project' .* gesetzt/i }).first()).toBeVisible();
  });
});

// ── Theme-Umschaltung ───────────────────────────────────────────────────────────

test.describe('Theme', () => {
  test('Toggle wechselt zwischen hell und dunkel', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const html = page.locator('html');
    const toggle = page.locator('app-header button');

    const before = await html.getAttribute('data-theme');
    await toggle.click();
    await expect(html).not.toHaveAttribute('data-theme', before ?? '');

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', before ?? 'light');
  });
});
