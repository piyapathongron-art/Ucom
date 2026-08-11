import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:3002' });

async function loginStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#username').fill('staff');
  await page.locator('#password').fill('123456');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes('/login'));
}

// Creates a product with stock so checkout tests never drain a shared item.
async function createTestProduct(page: import('@playwright/test').Page): Promise<string> {
  const name = `ZZTEST-POS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.goto('/stock');
  await page.locator('[data-testid="open-add-product"]').click();
  await page.locator('[data-testid="add-product-name"]').fill(name);
  await page.locator('[data-testid="add-product-price"]').fill('100');
  await page.locator('[data-testid="add-product-qty"]').fill('5');
  await page.locator('[data-testid="add-product-submit"]').click();
  await page.waitForTimeout(3000);
  return name;
}

test.describe('POS — staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginStaff(page);
    await page.goto('/pos');
  });

  test('search filters the catalog', async ({ page }) => {
    // Type an unlikely string — catalog should become empty
    await page.locator('[data-testid="catalog-search"]').fill('zzznomatch99');
    const visibleItems = page.locator('[data-testid^="catalog-item-"]');
    await expect(visibleItems).toHaveCount(0);
  });

  test('adding a catalog item adds a cart line', async ({ page }) => {
    const before = await page.locator('[data-testid="cart-lines"]').getAttribute('data-count');
    const startCount = Number(before) || 0;

    // Click the first product (not device)
    await page.locator('[data-testid^="catalog-item-product-"]').first().click();

    const after = await page.locator('[data-testid="cart-lines"]').getAttribute('data-count');
    const endCount = Number(after) || 0;
    await expect(endCount).toBe(startCount + 1);
  });

  test('top-up flow', async ({ page }) => {
    // Click True carrier
    await page.locator('[data-testid="topup-carrier-True"]').click();

    // Fill amount
    await page.locator('[data-testid="topup-amount"]').fill('50');
    await page.locator('[data-testid="topup-add"]').click();

    // Assert topup line exists
    await expect(page.locator('[data-testid="cart-line-topup"]')).toBeVisible();
  });

  test('checkout with cash', async ({ page }) => {
    const productName = await createTestProduct(page);
    await page.goto('/pos');
    await page.locator('[data-testid="catalog-search"]').fill(productName);
    await expect(page.locator('[data-testid^="catalog-item-product-"]')).toHaveCount(1);
    await page.locator('[data-testid^="catalog-item-product-"]').first().click();
    await page.locator('[data-testid="pay-cash"]').click();
    await page.locator('[data-testid="checkout-submit"]').click();
    await page.waitForTimeout(5000);

    // No error banner
    await expect(page.locator('[data-testid="checkout-error"]')).not.toBeVisible();

    // Cart empties
    const count = await page.locator('[data-testid="cart-lines"]').getAttribute('data-count');
    await expect(count).toBe('0');
  });

  test('checkout with transfer shows the account field', async ({ page }) => {
    const productName = await createTestProduct(page);
    await page.goto('/pos');
    await page.locator('[data-testid="catalog-search"]').fill(productName);
    await expect(page.locator('[data-testid^="catalog-item-product-"]')).toHaveCount(1);
    await page.locator('[data-testid^="catalog-item-product-"]').first().click();

    // Switch to transfer payment
    await page.locator('[data-testid="pay-transfer"]').click();

    // Receiving account field becomes visible
    await expect(page.locator('[data-testid="receiving-account"]')).toBeVisible();

    // Fill with Thai text — copy literally
    await page.locator('[data-testid="receiving-account"]').fill('ทดสอบ');

    // Submit
    await page.locator('[data-testid="checkout-submit"]').click();
    await page.waitForTimeout(5000);

    // No error, cart empties
    await expect(page.locator('[data-testid="checkout-error"]')).not.toBeVisible();
    const count = await page.locator('[data-testid="cart-lines"]').getAttribute('data-count');
    await expect(count).toBe('0');
  });
});
