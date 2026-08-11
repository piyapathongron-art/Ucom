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

async function createSfDevice(page: Page): Promise<string> {
  const suffix = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
  const modelName = "ZZTEST-SF-" + suffix;
  const imei = String(Date.now()) + String(Math.floor(Math.random() * 1000));

  await page.goto("/stock");
  await page.locator('[data-testid="open-sf-intake"]').click();
  await page.locator('[data-testid="sf-order-no"]').fill("TEST-SF-" + suffix);
  await page.locator('[data-testid="sf-device-imei-0"]').fill(imei.slice(0, 15));
  await page.locator('[data-testid="sf-device-model-0"]').fill(modelName);
  await page.locator('[data-testid="sf-device-price-0"]').fill("3000");
  await page.locator('[data-testid="sf-intake-submit"]').click();
  await page.waitForTimeout(3000);
  return modelName;
}

test("financing an SF device adds commission without sale revenue", async ({ browser }) => {
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
  await staff.locator('[data-testid="finance-commission"]').fill("250");
  await staff.locator('[data-testid="finance-submit"]').click();
  await expect(deviceCard).toHaveCount(0);

  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore + 250);
  expect(await readReportCell(owner, today, 1)).toBe(saleBefore);
  await staffContext.close();
  await ownerContext.close();
});
