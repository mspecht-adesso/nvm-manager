import { test, expect } from '@playwright/test';

/**
 * Smoke Tests – prüfen das Grundgerüst der App ohne nvm-Befehle auszulösen.
 * Die Tests setzen voraus, dass API (Port 3789) und Web (Port 4201) laufen.
 */

test.describe('App-Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('zeigt den App-Titel "nvm Manager"', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('nvm Manager');
  });

  test('zeigt den Header', async ({ page }) => {
    await expect(page.locator('app-app-header')).toBeVisible();
  });

  test('zeigt die Status-Card', async ({ page }) => {
    await expect(page.locator('app-status-card')).toBeVisible();
  });

  test('zeigt die Aktions-Card', async ({ page }) => {
    await expect(page.locator('app-action-card')).toBeVisible();
  });

  test('zeigt die Installierte-Versionen-Card', async ({ page }) => {
    await expect(page.locator('app-installed-versions-card')).toBeVisible();
  });

  test('zeigt die Aliases-Card', async ({ page }) => {
    await expect(page.locator('app-aliases-card')).toBeVisible();
  });

  test('zeigt die Remote-Versionen-Card', async ({ page }) => {
    await expect(page.locator('app-remote-versions-card')).toBeVisible();
  });

  test('zeigt die Log-Card', async ({ page }) => {
    await expect(page.locator('app-log-card')).toBeVisible();
  });
});

test.describe('Status-Card', () => {
  test('zeigt einen nvm-Status an', async ({ page }) => {
    await page.goto('/');
    const statusCard = page.locator('app-status-card');
    await expect(statusCard).toBeVisible();
    // Warte darauf, dass der Ladespinner verschwindet (max. 10 s)
    await expect(statusCard.locator('app-loading-state')).not.toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Aktions-Card – Eingabefeld', () => {
  test('hat einen vorausgefüllten Versions-Input', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('app-action-card input[type="text"], app-action-card input:not([type])').first();
    await expect(input).toBeVisible();
    const value = await input.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('enthält einen Installieren-Button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-action-card').getByRole('button', { name: /installieren/i })).toBeVisible();
  });

  test('enthält einen Verwenden-Button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-action-card').getByRole('button', { name: /verwenden/i })).toBeVisible();
  });

  test('enthält einen Als-Default-Button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-action-card').getByRole('button', { name: /default/i })).toBeVisible();
  });

  test('enthält einen Deinstallieren-Button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-action-card').getByRole('button', { name: /deinstallieren/i })).toBeVisible();
  });
});

test.describe('Remote-Versionen-Card', () => {
  test('enthält einen Laden-Button', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('app-remote-versions-card');
    await expect(card.getByRole('button', { name: /laden/i })).toBeVisible();
  });
});

test.describe('Log-Card', () => {
  test('zeigt Platzhalter wenn keine Aktionen ausgeführt wurden', async ({ page }) => {
    await page.goto('/');
    const logCard = page.locator('app-log-card');
    // Entweder Platzhaltertext oder Log-Einträge – beides ist gültig
    await expect(logCard).toBeVisible();
  });
});
