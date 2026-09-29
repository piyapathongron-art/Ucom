import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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

async function ringUpProduct(page: Page, name: string) {
  await page.locator('[data-testid="catalog-search"]').fill(name);
  const item = page.locator('[data-testid^="catalog-item-product-"]');
  await expect(item).toHaveCount(1);
  await item.click();
  await page.locator('[data-testid="pay-cash"]').click();
  await page.locator('[data-testid="checkout-submit"]').click();
}

async function expectPersistedSale(clientUuid: string) {
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase test credentials");
  const admin = createClient(url, key);
  await expect.poll(async () => {
    const { data, error } = await admin.from("sales").select("id").eq("client_uuid", clientUuid);
    if (error) throw error;
    return data?.length;
  }).toBe(1);
}

test("a sale rung up offline reaches the database once the network returns", async ({
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

  await context.setOffline(true);

  await ringUpProduct(page, name);
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText(
    "บิลค้าง 1 ใบ",
  );
  const clientUuid = await page.evaluate(() => JSON.parse(localStorage.getItem("ucom-pos-queue-v1") ?? "[]")[0]?.clientUuid as string);
  expect(clientUuid).toBeTruthy();

  // nothing was rejected, so the banner must not be in its red state
  await expect(page.locator('[data-testid="queue-rejected"]')).toHaveCount(0);

  // the browser's own "online" event starts the drain, so there is nothing to press —
  // the sync button exists for the case where that event never fires
  await context.setOffline(false);

  // the banner disappears only when every queued bill has been accepted
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0, {
    timeout: 15000,
  });
  await expectPersistedSale(clientUuid);
});

test("the queue survives a reload while offline", async ({ page, context }) => {
  await loginAsStaff(page);
  const name = await createTestProduct(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
  await page.locator('[data-testid="catalog-search"]').fill(name);
  await expect(page.locator('[data-testid^="catalog-item-product-"]')).toHaveCount(1);

  await context.setOffline(true);
  await ringUpProduct(page, name);
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText(
    "บิลค้าง 1 ใบ",
  );
  const clientUuid = await page.evaluate(() => JSON.parse(localStorage.getItem("ucom-pos-queue-v1") ?? "[]")[0]?.clientUuid as string);
  expect(clientUuid).toBeTruthy();

  await context.setOffline(false);
  await page.reload();

  // a fresh load drains the queue on its own — no button press needed
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0, {
    timeout: 15000,
  });
  await expectPersistedSale(clientUuid);
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
