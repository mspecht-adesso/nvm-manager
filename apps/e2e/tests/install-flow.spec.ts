import { test, expect } from '@playwright/test';
import { mockNvmApi } from './support/mock-api';

/**
 * Install-Flow E2E Tests
 *
 * These tests verify the interaction with the action card:
 * entering a version, triggering installs/uses, etc.
 *
 * The `/api/**` layer is mocked (see ./support/mock-api), so no real nvm
 * operations run – the flows are deterministic and non-destructive.
 */

test.describe('Install-Modal', () => {
  // Der `app-install-modal`-Host hat selbst keine Ausdehnung (das Modal ist
  // `position: fixed`); daher wird auf den eigentlichen Dialog geprüft.
  const dialog = (page: import('@playwright/test').Page) =>
    page.locator('app-install-modal [role="dialog"]');

  test('öffnet das Install-Modal nach Klick auf Installieren', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');

    await page.locator('app-action-card').getByRole('button', { name: 'Installieren', exact: true }).click();

    // Das Modal soll sichtbar werden
    await expect(dialog(page)).toBeVisible({ timeout: 5_000 });
  });

  test('öffnet das Use-Modal beim Verwenden aus der Installierten-Liste', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    // Nur der „Verwenden"-Button in der Installierten-Liste öffnet ein Modal
    // (onUseFromList); der „Verwenden"-Button der Aktions-Card schreibt nur ins Log.
    const row = page.locator('app-installed-versions-card tr', { hasText: 'v20.5.0' });
    await row.getByRole('button', { name: /Verwenden/i }).click();

    await expect(dialog(page)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Log-Einträge', () => {
  test('schreibt einen Log-Eintrag nach Klick auf Installieren', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');
    await page.locator('app-action-card').getByRole('button', { name: 'Installieren', exact: true }).click();

    // Im Log soll ein Eintrag erscheinen (Erfolg oder Fehler)
    const logCard = page.locator('app-log-card');
    await expect(logCard.locator('.log-entry').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Eingabe-Validierung (UI)', () => {
  test('Versions-Input akzeptiert Zahlen', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');
    expect(await input.inputValue()).toBe('22');
  });

  test('Versions-Input akzeptiert Semver', async ({ page }) => {
    await mockNvmApi(page);
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22.11.0');
    expect(await input.inputValue()).toBe('22.11.0');
  });
});
