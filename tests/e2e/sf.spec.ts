import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function parseMoney(text: string | null): number {
  return Number((text ?? "").replace(/,/g, "").trim());
}

async function readReportCell(page: Page, day: string, columnIndex: number): Promise<number> {
  await page.locator('main[data-loading="false"]').waitFor({ state: "visible", timeout: 15000 });
  const row = page.locator('[data-testid="report-row-' + day + '"]');
  if ((await row.count()) === 0) return 0;
  return parseMoney(await row.locator("td").nth(columnIndex).textContent());
}

async function createSfDevice(
  page: Page,
  opts?: { listPrice?: number; salePrice?: number },
): Promise<string> {
  const suffix = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
  const modelName = "ZZTEST-SF-" + suffix;
  const imei = String(Date.now()) + String(Math.floor(Math.random() * 1000));

  await page.goto("/consignments?tab=sf");
  await page.locator('[data-testid="open-sf-intake"]').click();
  await page.locator('[data-testid="sf-order-no"]').fill("TEST-SF-" + suffix);
  await page.locator('[data-testid="sf-device-imei-0"]').fill(imei.slice(0, 15));
  await page.locator('[data-testid="sf-device-model-0"]').fill(modelName);
  await page.locator('[data-testid="sf-device-price-0"]').fill(String(opts?.listPrice ?? 3000));
  if (opts?.salePrice !== undefined) {
    await page.locator('[data-testid="sf-device-sale-price-0"]').fill(String(opts.salePrice));
  }
  await page.locator('[data-testid="sf-intake-submit"]').click();
  await page.waitForTimeout(3000);
  return modelName;
}

test("financing an SF device does not require commission; report increases only after recording", async ({ browser }) => {
  const today = todayInBangkok();
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAs(owner, "admin");
  await owner.goto("/report");
  await owner.locator('[data-testid="quick-today"]').click();
  const saleBefore = await readReportCell(owner, today, 1);
  const commissionBefore = await readReportCell(owner, today, 5);

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await loginAs(staff, "staff");
  const modelName = await createSfDevice(staff);
  await staff.goto("/pos");
  await staff.locator('[data-testid="catalog-search"]').fill(modelName);
  const deviceCard = staff.locator('[data-testid^="catalog-item-device-"]');
  await expect(deviceCard).toHaveCount(1);
  await deviceCard.locator('[data-testid="finance-device"]').click();
  await staff.locator('[data-testid="finance-submit"]').click();
  await expect(deviceCard).toHaveCount(0);

  // Immediately after financing, report must NOT show a new commission entry
  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore);
  expect(await readReportCell(owner, today, 1)).toBe(saleBefore);

  // Device now appears in pending list on /sf-commissions
  await staff.goto("/sf-commissions");
  await staff.locator('[data-testid="sf-tab-pending"]').click();
  const pendingSection = staff.locator('[data-testid="sf-pending-section"]');
  const pendingCard = pendingSection.locator("text=" + modelName);
  await expect(pendingCard).toBeVisible({ timeout: 10000 });

  // Record commission 250 for today
  // Find the record button for this device and open the form
  const pendingRow = staff.locator("tr", { hasText: modelName });
  await pendingRow.locator('[data-testid^="sf-record-open-"]').click();
  const amountInput = pendingRow.locator('[data-testid^="sf-record-amount-"]');
  await amountInput.fill("250");
  await pendingRow.locator('[data-testid^="sf-record-submit-"]').click();
  await staff.waitForTimeout(2000);

  // Device must disappear from pending list after recording
  await expect(pendingCard).toHaveCount(0);

  // Owner report must now show +250 sf_commission
  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore + 250);
  expect(await readReportCell(owner, today, 1)).toBe(saleBefore);

  // ── Record a second device with amount = 0: closes pending but report does not increase ──
  const modelName2 = await createSfDevice(staff);
  await staff.goto("/pos");
  await staff.locator('[data-testid="catalog-search"]').fill(modelName2);
  const deviceCard2 = staff.locator('[data-testid^="catalog-item-device-"]');
  await expect(deviceCard2).toHaveCount(1);
  await deviceCard2.locator('[data-testid="finance-device"]').click();
  await staff.locator('[data-testid="finance-submit"]').click();
  await expect(deviceCard2).toHaveCount(0);

  await staff.goto("/sf-commissions");
  await staff.locator('[data-testid="sf-tab-pending"]').click();
  const pendingRow2 = staff.locator("tr", { hasText: modelName2 });
  await pendingRow2.locator('[data-testid^="sf-record-open-"]').click();
  const amountInput2 = pendingRow2.locator('[data-testid^="sf-record-amount-"]');
  await amountInput2.fill("0");
  await pendingRow2.locator('[data-testid^="sf-record-submit-"]').click();
  await staff.waitForTimeout(2000);

  // report commission unchanged (amount = 0 does not appear in report)
  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore + 250);

  // ── Staff cannot see correction button for confirmed receipts ──
  await staff.goto("/sf-commissions");
  await staff.locator('[data-testid="sf-tab-receipts"]').click();
  const confirmRow = staff.locator("tr", { hasText: modelName });
  await expect(confirmRow.locator('[data-testid^="sf-correct-open-"]')).toHaveCount(0);

  // ── Owner can correct a receipt ──
  await owner.goto("/sf-commissions");
  await owner.locator('[data-testid="sf-tab-receipts"]').click();
  const ownerConfirmRow = owner.locator("tr", { hasText: modelName });
  await ownerConfirmRow.locator('[data-testid^="sf-correct-open-"]').click();
  const correctAmount = ownerConfirmRow.locator('[data-testid^="sf-correct-amount-"]');
  await correctAmount.clear();
  await correctAmount.fill("300");
  await ownerConfirmRow.locator('[data-testid^="sf-correct-reason-"]').fill("ทดสอบแก้ไข");
  await ownerConfirmRow.locator('[data-testid^="sf-correct-submit-"]').click();
  await owner.waitForTimeout(2000);

  // Report now shows corrected amount
  await owner.goto("/report");
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore + 300);

  await staffContext.close();
  await ownerContext.close();
});

test("cash sale of an SF device books cost = list_price, not 0", async ({ browser }) => {
  const today = todayInBangkok();
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAs(owner, "admin");
  await owner.goto("/report");
  await owner.locator('[data-testid="quick-today"]').click();
  const profitBefore = await readReportCell(owner, today, 2); // กำไรขาย

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await loginAs(staff, "staff");

  const listPrice = 3000;
  const askingPrice = 3500;
  const soldFor = 3800; // staff edits the price in the cart at checkout
  const modelName = await createSfDevice(staff, { listPrice, salePrice: askingPrice });

  await staff.goto("/pos");
  await staff.locator('[data-testid="catalog-search"]').fill(modelName);
  const deviceCard = staff.locator('[data-testid^="catalog-item-device-"]');
  await expect(deviceCard).toHaveCount(1);

  // catalog shows the asking price (sale_price), not the SF list price
  await expect(deviceCard).toContainText(askingPrice.toLocaleString());

  await deviceCard.locator('[data-testid="sell-cash-device"]').click();
  const priceInput = staff.locator('[data-testid="cart-device-price"]');
  await expect(priceInput).toHaveValue(String(askingPrice));
  await priceInput.fill(String(soldFor));

  await staff.locator('[data-testid="pay-cash"]').click();
  await staff.locator('[data-testid="checkout-submit"]').click();
  await staff.waitForTimeout(5000);
  await expect(staff.locator('[data-testid="checkout-error"]')).not.toBeVisible();

  // Device is gone from the catalog — sold, not financed
  await expect(deviceCard).toHaveCount(0);

  // Report profit rose by (soldFor - listPrice), i.e. cost was booked as list_price,
  // not left at 0.
  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 2)).toBe(profitBefore + (soldFor - listPrice));

  await staffContext.close();
  await ownerContext.close();
});
