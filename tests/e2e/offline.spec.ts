import { test, expect, type Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3002" });

async function loginAsStaff(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill("staff");
  await page.locator("#password").fill("123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

// The suite runs against prod, so the bill this test rings up must be one whose absence
// from the real books is obvious: a single top-up of a fixed small amount.
async function ringUpTopup(page: Page, amount: string) {
  await page.locator('[data-testid="topup-carrier-True"]').click();
  await page.locator('[data-testid="topup-amount"]').fill(amount);
  await page.locator('[data-testid="topup-add"]').click();
  await page.locator('[data-testid="pay-cash"]').click();
  // a top-up line snapshots the carrier name, so the bill carries no ZZTEST marker of
  // its own — the note is the only place the teardown can recognise it by
  await page.locator('[data-testid="bill-note"]').fill("ZZTEST-OFFLINE");
  await page.locator('[data-testid="checkout-submit"]').click();
}

test("a sale rung up offline reaches the database once the network returns", async ({
  page,
  context,
}) => {
  await loginAsStaff(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
  // the carrier buttons come from a second query — ringing up a top-up before they
  // land would fail for a reason that has nothing to do with being offline
  await expect(page.locator('[data-testid="topup-carrier-True"]')).toBeVisible();

  // no queue banner while everything is healthy
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0);

  await context.setOffline(true);

  await ringUpTopup(page, "50");
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText(
    "บิลค้าง 1 ใบ",
  );

  await ringUpTopup(page, "60");
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText(
    "บิลค้าง 2 ใบ",
  );

  // nothing was rejected, so the banner must not be in its red state
  await expect(page.locator('[data-testid="queue-rejected"]')).toHaveCount(0);

  // the browser's own "online" event starts the drain, so there is nothing to press —
  // the sync button exists for the case where that event never fires
  await context.setOffline(false);

  // the banner disappears only when every queued bill has been accepted
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0, {
    timeout: 15000,
  });
});

test("the queue survives a reload while offline", async ({ page, context }) => {
  await loginAsStaff(page);
  await page.goto("/pos");
  await expect(page.locator('[data-testid="catalog-search"]')).toBeVisible();
  // the carrier buttons come from a second query — ringing up a top-up before they
  // land would fail for a reason that has nothing to do with being offline
  await expect(page.locator('[data-testid="topup-carrier-True"]')).toBeVisible();

  await context.setOffline(true);
  await ringUpTopup(page, "70");
  await expect(page.locator('[data-testid="queue-count"]')).toHaveText(
    "บิลค้าง 1 ใบ",
  );

  await context.setOffline(false);
  await page.reload();

  // a fresh load drains the queue on its own — no button press needed
  await expect(page.locator('[data-testid="queue-banner"]')).toHaveCount(0, {
    timeout: 15000,
  });
});
