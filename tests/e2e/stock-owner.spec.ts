import { test, expect } from '@playwright/test';

async function loginOwner(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes('/login'));
}

test.describe('Stock — owner', () => {
  test.beforeEach(async ({ page }) => {
    await loginOwner(page);
    await page.goto('/stock');
  });

  test('cost column exists for owner', async ({ page }) => {
    await expect(page.locator('[data-testid="cost-column-header"]')).toBeVisible();
  });

  test('owner can edit cost on a row', async ({ page }) => {
    const costInput = page.locator('[data-testid^="stock-cost-"]').first();
    const testId = await costInput.getAttribute('data-testid');
    const rowId = testId!.replace('stock-cost-', '');

    const current = await costInput.inputValue();
    const next = (Number(current) || 0) + 1;

    await costInput.fill(String(next));
    await page.locator(`[data-testid="stock-save-cost-${rowId}"]`).click();
    await page.waitForTimeout(2000);

    await page.reload();
    await expect(page.locator(`[data-testid="stock-cost-${rowId}"]`)).toHaveValue(String(next));
  });
});
