import { test, expect, type Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3002" });

async function loginAsStaff(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill("staff");
  await page.locator("#password").fill("123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

async function createTestProduct(page: Page): Promise<string> {
  const name = `ZZTEST-OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await page.goto("/stock");
  await page.locator('[data-testid="open-add-product"]').click();
  await page.locator('[data-testid="add-product-name"]').fill(name);
  await page.locator('[data-testid="add-product-price"]').fill("100");
  await page.locator('[data-testid="add-product-qty"]').fill("3");
  await page.locator('[data-testid="add-product-submit"]').click();
  await expect(page.getByRole("dialog")).toBeHidden();
  return name;
}

test("offline checkout preserves the cart without creating a bill", async ({
  page,
  context,
}) => {
  await loginAsStaff(page);
  const name = await createTestProduct(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
  await page.locator('[data-testid="catalog-search"]').fill(name);
  await expect(page.locator('[data-testid^="catalog-item-product-"]')).toHaveCount(1);

  // no queue banner while everything is healthy
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0);

  await page.locator('[data-testid^="catalog-item-product-"]').click();
  await context.setOffline(true);
  await page.getByTestId("checkout-submit").click();
  await expect(page.getByTestId("checkout-error")).toContainText("ปิดการออกบิล offline");
  await expect(page.getByTestId("cart-lines")).toHaveAttribute("data-count", "1");
  await expect(page.getByTestId("queue-banner")).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("ucom-cash-sale-v1:")).length)).toBe(0);
  await context.setOffline(false);
});

test("a pre-existing rejected bill survives reload and offline mode", async ({ page, context }) => {
  await loginAsStaff(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
  const original = JSON.stringify([{ clientUuid: "legacy-rejected-bill", payload: { items: [] }, queuedAt: "2026-10-08T00:00:00Z", lastError: "ต้องตรวจสอบบิลเดิม" }]);
  await page.evaluate(value => localStorage.setItem("ucom-pos-queue-v1", value), original);
  await page.reload();
  await expect(page.getByTestId("queue-banner")).toBeVisible();
  await context.setOffline(true);
  expect(await page.evaluate(() => localStorage.getItem("ucom-pos-queue-v1"))).toBe(original);
  await expect(page.getByTestId("queue-count")).toHaveText("บิลค้าง 1 ใบ");
  await context.setOffline(false);
});

test("discarding a rejected offline sale clears the queue and banner", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();

  // Inject a mock rejected offline sale into localStorage
  const rejectedUuid = "test-rejected-uuid";
  await page.evaluate((uuid) => {
    localStorage.setItem(
      "ucom-pos-queue-v1",
      JSON.stringify([
        {
          clientUuid: uuid,
          payload: { items: [] },
          queuedAt: new Date().toISOString(),
          lastError: "สินค้าไม่พอขาย หรือไม่พบสินค้า",
        },
      ]),
    );
  }, rejectedUuid);

  await page.reload();

  // QueueBanner should appear with 1 rejected bill
  await expect(page.locator('[data-testid="queue-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText("บิลค้าง 1 ใบ");
  await expect(page.locator('[data-testid="queue-rejected"]')).toBeVisible();

  // Click discard button
  const discardBtn = page.locator(`[data-testid="queue-remove-${rejectedUuid}"]`);
  await expect(discardBtn).toBeVisible();
  await discardBtn.click();
  await page.locator('[data-testid="queue-remove-confirm"]').click();

  // Banner should disappear completely
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0);
});

test("close-day page displays queue warning with link to pos", async ({ page }) => {
  await loginAsStaff(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();

  // Inject 1 queued sale into localStorage
  await page.evaluate(() => {
    localStorage.setItem(
      "ucom-pos-queue-v1",
      JSON.stringify([
        {
          clientUuid: "close-day-test-uuid",
          payload: { items: [] },
          queuedAt: new Date().toISOString(),
          lastError: "สินค้าไม่พอขาย",
        },
      ]),
    );
  });

  await page.goto("/close-day");
  const queueWarning = page.locator('[data-testid="close-day-queue-warning"]');
  await expect(queueWarning).toBeVisible();
  await expect(queueWarning).toContainText("ยังมีบิลค้างในคิว 1 ใบ");
  await expect(queueWarning.locator('a[href="/pos"]')).toBeVisible();

  // Cleanup localStorage
  await page.evaluate(() => {
    localStorage.removeItem("ucom-pos-queue-v1");
  });
});
