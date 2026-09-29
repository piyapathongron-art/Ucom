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
    // creates its own product: never edits real stock cost on the shared project
    const name = 'ZZTEST-OWNERCOST-' + Date.now();
    await page.locator('[data-testid="open-add-product"]').click();
    await page.locator('[data-testid="add-product-name"]').fill(name);
    await page.locator('[data-testid="add-product-price"]').fill('100');
    await page.locator('[data-testid="add-product-submit"]').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByPlaceholder('ค้นหาสินค้า / เครื่อง / SKU / IMEI').fill(name);
    const openRow = page.locator('[data-testid^="stock-open-"]');
    await expect(openRow).toHaveCount(1);
    const rowId = (await openRow.getAttribute('data-testid'))!.replace('stock-open-', '');
    await openRow.click();
    const costInput = page.locator(`[data-testid="stock-cost-${rowId}"]`);
    const next = (Number(await costInput.inputValue()) || 0) + 1;
    await costInput.fill(String(next));
    await page.locator(`[data-testid="stock-save-cost-${rowId}"]`).click();
    await expect(page.getByText('บันทึกต้นทุนแล้ว')).toBeVisible();

    await page.reload();
    await page.getByPlaceholder('ค้นหาสินค้า / เครื่อง / SKU / IMEI').fill(name);
    await page.locator(`[data-testid="stock-open-${rowId}"]`).click();
    await expect(page.locator(`[data-testid="stock-cost-${rowId}"]`)).toHaveValue(String(next));
  });
});
