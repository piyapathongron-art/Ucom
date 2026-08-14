import { test, expect, type Page } from "@playwright/test";
import { loginAs, uniqueCustomer, uniqueDevice, findJobIdByCustomer } from "./repairs-helpers";

// The page buckets by Asia/Bangkok days, so the test has to agree with it or the row it
// looks for is a day off for seven hours out of every twenty-four.
function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// Cells render through toLocaleString(), so "-1,500" has to come back as -1500.
function parseMoney(text: string | null): number {
  return Number((text ?? "").replace(/,/g, "").trim());
}

// A day with no money movement has no row at all, which reads as zero — the report is
// built from a view that only emits days that happened.
async function readCell(page: Page, bucket: string, columnIndex: number): Promise<number> {
  await page.locator('main[data-loading="false"]').waitFor({ state: "visible", timeout: 15000 });
  const row = page.locator(`[data-testid="report-row-${bucket}"]`);
  if ((await row.count()) === 0) return 0;
  return parseMoney(await row.locator("td").nth(columnIndex).textContent());
}

// The colour rule is "red exactly when negative", which holds whatever else the day
// carries — asserting it as an equivalence keeps this test independent of the other
// specs that also write repair jobs into today.
async function expectRedWhenNegative(page: Page, locator: string, value: number) {
  const cls = (await page.locator(locator).getAttribute("class")) ?? "";
  expect(cls.includes("text-red-600")).toBe(value < 0);
}

// column order on the report table: bucket, sale_revenue, sale_profit, repair_revenue,
// repair_profit, sf_commission, expense, net_profit
const COL_REPAIR_REVENUE = 3;
const COL_REPAIR_PROFIT = 4;
const COL_NET_PROFIT = 7;

test.describe("Report", () => {
  test("an abandoned job lands as a negative repair profit, in red", async ({ browser }) => {
    const today = todayInBangkok();

    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    await loginAs(owner, "admin");
    await owner.goto("/report");
    await owner.locator('[data-testid="quick-today"]').click();
    const profitBefore = await readCell(owner, today, COL_REPAIR_PROFIT);
    const revenueBefore = await readCell(owner, today, COL_REPAIR_REVENUE);

    const staffCtx = await browser.newContext();
    const staff = await staffCtx.newPage();
    await loginAs(staff, "staff");
    await staff.goto("/repairs");

    const customer = uniqueCustomer();
    await staff.locator('[data-testid="open-intake-form"]').click();
    await staff.locator('[data-testid="intake-customer-name"]').fill(customer);
    await staff.locator('[data-testid="intake-device-desc"]').fill(uniqueDevice());
    await staff.locator('[data-testid="intake-quoted-price"]').fill("500");
    await staff.locator('[data-testid="intake-submit"]').click();
    const id = await findJobIdByCustomer(staff, customer);

    await staff.locator(`[data-testid="repair-part-cost-input-${id}"]`).fill("500");
    await staff.locator(`[data-testid="repair-part-cost-save-${id}"]`).click();
    await expect(staff.locator(`[data-testid="repair-part-paid-${id}"]`)).toBeVisible({ timeout: 15000 });

    await staff.locator(`[data-testid="repair-abandon-${id}"]`).click();
    await staff.locator(`[data-testid="repair-abandon-confirm-${id}"]`).click();
    await staff.locator('[data-testid="filter-abandoned"]').click();
    await expect(staff.locator(`[data-testid="repair-status-${id}"]`)).toHaveCount(1, { timeout: 15000 });

    await owner.reload();
    await owner.locator('[data-testid="quick-today"]').click();

    // the part was already paid for, so abandoning takes 500 out of today's repair
    // profit and adds nothing to revenue (ADR 0011)
    const profitAfter = await readCell(owner, today, COL_REPAIR_PROFIT);
    expect(profitAfter).toBe(profitBefore - 500);
    expect(await readCell(owner, today, COL_REPAIR_REVENUE)).toBe(revenueBefore);

    const rowCells = `[data-testid="report-row-${today}"] td`;
    await expectRedWhenNegative(owner, `${rowCells} >> nth=${COL_REPAIR_PROFIT}`, profitAfter);

    // the loss has to reach the bottom line too, not stop at its own column
    const net = await readCell(owner, today, COL_NET_PROFIT);
    await expectRedWhenNegative(owner, `${rowCells} >> nth=${COL_NET_PROFIT}`, net);

    // the range is a single day, so the card must agree with the row exactly
    const card = '[data-testid="card-repair_profit"] p >> nth=1';
    expect(parseMoney(await owner.locator(card).textContent())).toBe(profitAfter);
    await expectRedWhenNegative(owner, card, profitAfter);

    await staffCtx.close();
    await ownerCtx.close();
  });

  test("quick actions set the range and the grouping together", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/report");
    const today = todayInBangkok();

    await page.locator('[data-testid="quick-today"]').click();
    await expect(page.locator('[data-testid="report-from"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="report-to"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="group-day"]')).toHaveClass(/bg-white/);

    await page.locator('[data-testid="quick-month"]').click();
    await expect(page.locator('[data-testid="report-from"]')).toHaveValue(today.slice(0, 7) + "-01");
    await expect(page.locator('[data-testid="group-day"]')).toHaveClass(/bg-white/);

    await page.locator('[data-testid="quick-year"]').click();
    await expect(page.locator('[data-testid="report-from"]')).toHaveValue(today.slice(0, 4) + "-01-01");
    await expect(page.locator('[data-testid="report-to"]')).toHaveValue(today);
    await expect(page.locator('[data-testid="group-month"]')).toHaveClass(/bg-white/);
    // grouping by month means the bucket label is YYYY-MM, not a full date
    await expect(page.locator(`[data-testid="report-row-${today.slice(0, 7)}"]`)).toHaveCount(1, { timeout: 15000 });
  });

  test("changing the grouping regroups without refetching", async ({ page }) => {
    await loginAs(page, "admin");
    let fetches = 0;
    page.on("request", (req) => {
      if (req.url().includes("v_daily_report")) fetches += 1;
    });

    await page.goto("/report");
    await page.locator('[data-testid="quick-year"]').click();
    await expect(page.locator('[data-testid="group-month"]')).toHaveClass(/bg-white/);
    await page.waitForTimeout(1000);
    const afterLoad = fetches;
    expect(afterLoad).toBeGreaterThan(0);

    await page.locator('[data-testid="group-year"]').click();
    await page.locator('[data-testid="group-day"]').click();
    await page.waitForTimeout(1000);
    expect(fetches).toBe(afterLoad);
  });

  test("drilling year → month → day → bill keeps the numbers of the row above", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/report");
    await page.locator('[data-testid="quick-year"]').click();
    await page.locator('[data-testid="group-year"]').click();

    const year = todayInBangkok().slice(0, 4);
    await page.locator(`[data-testid="report-row-${year}"]`).click();

    // months only exist as rows once the year is open — no refetch, the same summary
    // re-cut one level down
    const firstMonth = page.locator(`[data-testid^="report-row-${year}-"]`).first();
    await expect(firstMonth).toBeVisible({ timeout: 15000 });
    const monthBucket = (await firstMonth.getAttribute("data-testid"))!.replace("report-row-", "");
    await firstMonth.click();

    const firstDay = page.locator(`[data-testid^="report-row-${monthBucket}-"]`).first();
    const dayBucket = (await firstDay.getAttribute("data-testid"))!.replace("report-row-", "");
    const dayNet = parseMoney(await firstDay.locator("td").nth(COL_NET_PROFIT).textContent());
    await firstDay.click();

    // the day's entries come from v_report_entries, which is what v_daily_report sums —
    // if these two ever disagree the drill-down is lying about where the money went
    await expect(page.locator(`[data-testid="report-detail-${dayBucket}"]`)).toBeVisible({ timeout: 15000 });
    const profits = page.locator(`[data-testid="day-entries-${dayBucket}"] [data-testid="entry-profit"]`);
    await expect(profits.first()).toBeVisible({ timeout: 15000 });
    const texts = await profits.allTextContents();
    const summed = texts.reduce((acc, t) => acc + parseMoney(t.replace("กำไร", "")), 0);
    expect(summed).toBeCloseTo(dayNet, 2);

    // the newest day can easily be a repair-only or expense-only day, and skipping the
    // bill assertion on those days would let the line-item feature rot behind a green
    // test — walk down the days until one actually has a bill to open.
    const dayRows = page.locator(`[data-testid^="report-row-${monthBucket}-"]`);
    let openBill = page.locator('[data-testid^="open-sale-"]').first();
    for (let i = 1; (await openBill.count()) === 0 && i < (await dayRows.count()); i += 1) {
      await dayRows.nth(i).click();
      openBill = page.locator('[data-testid^="open-sale-"]').first();
    }
    await expect(openBill).toBeVisible({ timeout: 15000 });

    const saleId = (await openBill.getAttribute("data-testid"))!.replace("open-sale-", "");
    await openBill.click();
    await expect(page.locator(`[data-testid="sale-lines-${saleId}"] tr`).first()).toBeVisible({ timeout: 15000 });
  });

  test("a range with no activity says so instead of showing an empty table", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/report");
    await page.locator('[data-testid="report-from"]').fill("2000-01-01");
    await page.locator('[data-testid="report-to"]').fill("2000-01-31");
    await expect(page.locator('[data-testid="report-empty"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table")).toHaveCount(0);
  });
});
