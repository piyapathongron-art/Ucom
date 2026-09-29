import { test, expect } from '@playwright/test';

async function loginStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#username').fill('staff');
  await page.locator('#password').fill('123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes('/login'));
}

function randomImei(offset: number): string {
  return (Date.now() + offset).toString().padEnd(15, '0').slice(0, 15);
}

async function expectStockName(page: import('@playwright/test').Page, name: string, kind: 'product' | 'device' = 'product') {
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator(`[data-testid="stock-kind-${kind}"]`).click();
  const search = page.getByPlaceholder('ค้นหาสินค้า / เครื่อง / SKU / IMEI');
  await search.fill(name);
  await expect(search).toHaveValue(name);
  await expect.poll(() => page.locator('[data-testid^="stock-name-"]').evaluateAll(
    (els, target) => els.map((el) => el.textContent ?? '').filter((value) => value === target),
    name,
  )).toEqual([name]);
}

test.describe('Stock — staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginStaff(page);
    await page.goto('/stock');
  });

  test('cost column is available for staff', async ({ page }) => {
    await expect(page.locator('[data-testid="cost-column-header"]')).toBeVisible();
  });

  test('add a product', async ({ page }) => {
    // unique suffix — running this suite repeatedly against prod must not collide
    // with a product left over from a previous run
    const name = 'ZZTEST-product-' + Date.now();
    await page.locator('[data-testid="open-add-product"]').click();
    await page.locator('[data-testid="add-product-name"]').fill(name);
    await page.locator('[data-testid="add-product-price"]').fill('123');
    await page.locator('[data-testid="add-product-qty"]').fill('5');
    await page.locator('[data-testid="add-product-submit"]').click();
    await expectStockName(page, name);
  });

  test('add a device', async ({ page }) => {
    const imei = randomImei(1);
    const name = 'ZZTEST-device-' + Date.now();
    await page.locator('[data-testid="stock-kind-device"]').click();
    await page.locator('[data-testid="open-add-device"]').click();
    await page.locator('[data-testid="add-device-imei"]').fill(imei);
    await page.locator('[data-testid="add-device-model"]').fill(name);
    await page.locator('[data-testid="add-device-price"]').fill('5000');
    await page.locator('[data-testid="add-device-submit"]').click();
    await expectStockName(page, name, 'device');
  });

  test('receive an SF order (bulk device intake)', async ({ page }) => {
    const orderNo = 'TEST-SF-' + Date.now();
    const imei = randomImei(2);
    const name = 'ZZTEST-SF-' + Date.now();
    await page.goto('/consignments?tab=sf');
    await page.locator('[data-testid="open-sf-intake"]').click();
    await page.locator('[data-testid="sf-order-no"]').fill(orderNo);
    await page.locator('[data-testid="sf-device-imei-0"]').fill(imei);
    await page.locator('[data-testid="sf-device-model-0"]').fill(name);
    await page.locator('[data-testid="sf-device-price-0"]').fill('3000');
    await page.locator('[data-testid="sf-intake-submit"]').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.goto('/stock');
    await expectStockName(page, name, 'device');
  });
});
