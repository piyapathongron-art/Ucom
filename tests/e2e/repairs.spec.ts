import { test, expect, type Page } from "@playwright/test";
import {
  loginAs,
  TH,
  uniqueCustomer,
  uniqueDevice,
  findJobIdByCustomer,
} from "./repairs-helpers";

async function createJob(page: Page, customer = uniqueCustomer(), device = uniqueDevice(), quotedPrice = "500") {
  await page.locator('[data-testid="open-intake-form"]').click();
  await page.locator('[data-testid="intake-customer-name"]').fill(customer);
  await page.locator('[data-testid="intake-device-desc"]').fill(device);
  await page.locator('[data-testid="intake-quoted-price"]').fill(quotedPrice);
  await page.locator('[data-testid="intake-submit"]').click();
  return findJobIdByCustomer(page, customer);
}

test.describe("Repairs", () => {
  test("intake creates a job in pending", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page);
    const statusCell = page.locator(`[data-testid="repair-status-${id}"]`);
    await expect(statusCell).toHaveText(TH.statusPending, { timeout: 15000 });
  });

  test("status walks forward one step at a time", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page);
    await page.locator(`[data-testid="repair-status-forward-${id}"]`).click();
    await expect(page.locator(`[data-testid="repair-status-${id}"]`)).toHaveText(TH.statusInProgress, { timeout: 15000 });
    await page.locator(`[data-testid="repair-status-forward-${id}"]`).click();
    await expect(page.locator(`[data-testid="repair-status-${id}"]`)).toHaveText(TH.statusReady, { timeout: 15000 });
    await expect(page.locator(`[data-testid="repair-status-forward-${id}"]`)).toHaveCount(0);
  });

  test("status walks back one step", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page);
    await page.locator(`[data-testid="repair-status-forward-${id}"]`).click();
    await page.locator(`[data-testid="repair-status-back-${id}"]`).click();
    await expect(page.locator(`[data-testid="repair-status-${id}"]`)).toHaveText(TH.statusPending, { timeout: 15000 });
    await expect(page.locator(`[data-testid="repair-status-back-${id}"]`)).toHaveCount(0);
  });

  test("part cost is write-only", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page);
    await page.locator(`[data-testid="repair-part-cost-input-${id}"]`).fill("180");
    await page.locator(`[data-testid="repair-part-cost-save-${id}"]`).click();
    await expect(page.locator(`[data-testid="repair-part-paid-${id}"]`)).toBeVisible({ timeout: 15000 });
    const row = page.locator(`[data-testid="repair-row-${id}"]`);
    const text = await row.textContent();
    expect(text).not.toContain("180");
    await expect(page.locator(`[data-testid="repair-part-paid-${id}"]`)).toContainText(TH.partCostEntered, { timeout: 15000 });
    await page.locator(`[data-testid="repair-part-cost-edit-${id}"]`).click();
    const input = page.locator(`[data-testid="repair-part-cost-input-${id}"]`);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("");
  });

  test("abandon needs two clicks", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page);
    await page.locator(`[data-testid="repair-abandon-${id}"]`).click();
    // the desktop row and the mobile card each mount a (closed) confirm dialog; only the open one has role "dialog"
    const confirm = page.getByRole("dialog").getByTestId(`repair-abandon-confirm-${id}`);
    await expect(confirm).toBeVisible({ timeout: 15000 });
    await confirm.click();
    await page.locator('[data-testid="filter-abandoned"]').click();
    await expect(page.locator(`[data-testid="repair-status-${id}"]`)).toHaveText(TH.statusAbandoned, { timeout: 15000 });
    await expect(page.locator(`[data-testid="repair-status-forward-${id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="repair-abandon-${id}"]`)).toHaveCount(0);
  });

  test("closing a job issues a bill and collects it", async ({ page }) => {
    await loginAs(page, "staff");
    await page.goto("/repairs");
    const id = await createJob(page, uniqueCustomer(), uniqueDevice(), "450");
    await page.locator(`[data-testid="repair-status-forward-${id}"]`).click();
    await page.locator(`[data-testid="repair-status-forward-${id}"]`).click();
    await page.locator(`[data-testid="repair-close-${id}"]`).click();
    await expect(page.locator('[data-testid="close-dialog"]')).toBeVisible({ timeout: 15000 });
    const unitPrice = page.locator('[data-testid="close-unit-price"]');
    await expect(unitPrice).toHaveValue("450");
    await page.locator('[data-testid="close-submit"]').click();
    await page.locator('[data-testid="filter-collected"]').click();
    await expect(page.locator(`[data-testid="repair-status-${id}"]`)).toHaveText(TH.statusCollected, { timeout: 15000 });
  });

  test("owner sees the same screen", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/repairs");
    await expect(page.locator("h1")).toHaveText(TH.pageHeading, { timeout: 15000 });
  });
});
