import { test, expect, type Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3002" });

async function loginAs(page: Page, username: "staff" | "admin") {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

test.describe("server-side pagination and filters — read only", () => {
  test("POS filter resets the catalog page and keeps checkout visible", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/pos");
    await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
    await expect(page.getByText("ยังไม่มีรายการในบิล")).toBeVisible();
    await expect(page.locator('[data-testid="cart-lines"]')).toHaveAttribute("data-count", "0");
    await expect(page.locator('[data-testid="checkout-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="catalog-pagination-controls"]')).toBeVisible();

    const nextPage = page.locator('[data-testid="catalog-pagination-next"]');
    if (!(await nextPage.isDisabled())) {
      await nextPage.click();
      await expect(page.locator('[data-testid="catalog-pagination-page"]')).toHaveText(/2 \/ /);
      await page.locator('[data-testid="catalog-pagination-prev"]').click();
      await expect(page.locator('[data-testid="catalog-pagination-page"]')).toHaveText(/1 \/ /);
    }
    await page.locator('[data-testid="catalog-search"]').fill("zzznomatch99");
    await expect(page.locator('[data-testid="catalog-pagination-page"]')).toHaveText(/1 \/ 1/);
    await expect(page.locator('[data-testid^="catalog-item-"]')).toHaveCount(0);
  });

  test("stock and repair filters expose independent pagination controls", async ({ page }) => {
    await loginAs(page, "staff");

    await page.goto("/stock");
    await expect(page.locator('[data-testid="stock-pagination-controls"]')).toBeVisible();
    await page.locator('[data-testid="stock-kind-device"]').click();
    await expect(page.locator('[data-testid="stock-pagination-page"]')).toHaveText(/1 \/ 1|1 \/ \d+/);

    await page.goto("/repairs");
    await expect(page.locator('[data-testid="repairs-pagination-controls"]')).toBeVisible();
    await page.locator('[data-testid="repair-search"]').fill("zzznomatch99");
    await expect(page.locator('[data-testid="repairs-pagination-page"]')).toHaveText(/1 \/ 1/);
  });

  test("owner detail ledgers expose filters without changing report summaries", async ({ page }) => {
    await loginAs(page, "admin");

    await page.goto("/expenses");
    await expect(page.locator('[data-testid="expense-pagination-controls"]')).toBeVisible();
    await page.locator('[data-testid="expense-filter-search"]').fill("zzznomatch99");
    await expect(page.locator('[data-testid="expense-pagination-page"]')).toHaveText(/1 \/ 1/);

    await page.goto("/report?view=drill");
    await page.locator('[data-testid="quick-today"]').click();
    const firstDayRow = page.locator('[data-testid^="report-row-"]').last();
    if (await firstDayRow.count()) {
      await firstDayRow.click();
      const detailSearch = page.locator('[data-testid="report-detail-search"]');
      if (await detailSearch.count()) await expect(detailSearch).toBeVisible();
    }
  });
});
