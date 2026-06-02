import { test, expect } from '@playwright/test';

/**
 * Install-Flow E2E-Tests
 *
 * Diese Tests prüfen die Interaktion mit der Aktions-Card:
 * Eingabe einer Version, Auslösen von Installationen/Verwendungen usw.
 *
 * Die Tests vermeiden echte nvm-Operationen wo möglich – sie prüfen nur
 * das UI-Verhalten (Modal öffnet sich, Log wird geschrieben, Buttons reagieren).
 */

test.describe('Install-Modal', () => {
  test('öffnet das Install-Modal nach Klick auf Installieren', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');

    await page.locator('app-action-card').getByRole('button', { name: /installieren/i }).click();

    // Das Modal soll sichtbar werden
    await expect(page.locator('app-install-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('öffnet das Use-Modal nach Klick auf Verwenden', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');

    await page.locator('app-action-card').getByRole('button', { name: /verwenden/i }).click();

    await expect(page.locator('app-install-modal')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Log-Einträge', () => {
  test('schreibt einen Log-Eintrag nach Klick auf Installieren', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');
    await page.locator('app-action-card').getByRole('button', { name: /installieren/i }).click();

    // Im Log soll ein Eintrag erscheinen (Erfolg oder Fehler)
    const logCard = page.locator('app-log-card');
    await expect(logCard.locator('.log-entry').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Eingabe-Validierung (UI)', () => {
  test('Versions-Input akzeptiert Zahlen', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22');
    expect(await input.inputValue()).toBe('22');
  });

  test('Versions-Input akzeptiert Semver', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('app-action-card input').first();
    await input.fill('22.11.0');
    expect(await input.inputValue()).toBe('22.11.0');
  });
});
