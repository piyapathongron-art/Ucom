import { test, expect } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

function parseNumber(text: string): number {
  const clean = text.replace(/,/g, "");
  const match = clean.match(/[-+]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : 0;
}

test("add a shop expense and see the cash-to-send total update, then delete it", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/close-day");

  const toSendElem = page.locator('[data-testid="close-day-to-send"]');
  await toSendElem.waitFor({ state: "visible" });
  const initialToSend = parseNumber((await toSendElem.textContent()) || "0");

  const name = "ZZTEST-CLOSE-" + Date.now();
  await page.locator('[data-testid="close-day-expense-name"]').fill(name);
  await page.locator('[data-testid="close-day-expense-amount"]').fill("150");
  await page.locator('[data-testid="close-day-expense-paid-from"]').selectOption("cash");
  await page.locator('[data-testid="close-day-expense-submit"]').click();

  const newRow = page.locator("tr", { hasText: name });
  await expect(newRow).toBeVisible();

  await expect(async () => {
    const updated = parseNumber((await toSendElem.textContent()) || "0");
    expect(updated).toBeCloseTo(initialToSend - 150, 2);
  }).toPass({ timeout: 5000 });

  const rowTestId = await newRow.getAttribute("data-testid");
  const id = rowTestId?.replace("close-day-expense-row-", "");
  await page.locator(`[data-testid="close-day-expense-delete-${id}"]`).click();
  await page.locator(`[data-testid="close-day-expense-delete-confirm-${id}"]`).click();

  await expect(newRow).not.toBeVisible();

  await expect(async () => {
    const restored = parseNumber((await toSendElem.textContent()) || "0");
    expect(restored).toBeCloseTo(initialToSend, 2);
  }).toPass({ timeout: 5000 });
});
