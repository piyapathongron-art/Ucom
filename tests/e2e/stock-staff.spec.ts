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

test.describe('Stock — staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginStaff(page);
    await page.goto('/stock');
  });

  test('no cost column for staff', async ({ page }) => {
    await expect(page.locator('[data-testid="cost-column-header"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="stock-cost-"]')).toHaveCount(0);
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
    await page.waitForTimeout(3000);

    const nameInputs = page.locator('[data-testid^="stock-name-"]');
    const values = await nameInputs.evaluateAll((els) =>
      (els as HTMLInputElement[]).map((el) => el.value),
    );
    expect(values.filter((v) => v === name)).toHaveLength(1);
  });

  test('add a device', async ({ page }) => {
    const imei = randomImei(1);
    const name = 'ZZTEST-device-' + Date.now();
    await page.locator('[data-testid="open-add-device"]').click();
    await page.locator('[data-testid="add-device-imei"]').fill(imei);
    await page.locator('[data-testid="add-device-model"]').fill(name);
    await page.locator('[data-testid="add-device-price"]').fill('5000');
    await page.locator('[data-testid="add-device-submit"]').click();
    await page.waitForTimeout(3000);

    const nameInputs = page.locator('[data-testid^="stock-name-"]');
    const values = await nameInputs.evaluateAll((els) =>
      (els as HTMLInputElement[]).map((el) => el.value),
    );
    expect(values.filter((v) => v === name)).toHaveLength(1);
  });

  test('receive an SF order (bulk device intake)', async ({ page }) => {
    const orderNo = 'TEST-SF-' + Date.now();
    const imei = randomImei(2);
    const name = 'ZZTEST-SF-' + Date.now();
    await page.locator('[data-testid="open-sf-intake"]').click();
    await page.locator('[data-testid="sf-order-no"]').fill(orderNo);
    await page.locator('[data-testid="sf-device-imei-0"]').fill(imei);
    await page.locator('[data-testid="sf-device-model-0"]').fill(name);
    await page.locator('[data-testid="sf-device-price-0"]').fill('3000');
    await page.locator('[data-testid="sf-intake-submit"]').click();
    await page.waitForTimeout(3000);

    const nameInputs = page.locator('[data-testid^="stock-name-"]');
    const values = await nameInputs.evaluateAll((els) =>
      (els as HTMLInputElement[]).map((el) => el.value),
    );
    expect(values.filter((v) => v === name)).toHaveLength(1);
  });
});
