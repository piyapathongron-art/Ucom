import { test, expect } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

function parseNumber(text: string): number {
  const clean = text.replace(/,/g, "");
  const match = clean.match(/[-+]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : 0;
}

test("record an expense and see it in the monthly list and total", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/expenses");

  const totalElem = page.locator('[data-testid="expense-total"]');
  await totalElem.waitFor({ state: "visible" });
  const initialTotalText = await totalElem.textContent();
  const initialTotal = parseNumber(initialTotalText || "0");

  const name = "ZZTEST-EXP-" + Date.now();
  await page.locator('[data-testid="open-ledger-add"]').click();
  await page.locator('[data-testid="expense-name"]').fill(name);
  await page.locator('[data-testid="expense-amount"]').fill("321");
  await page.locator('[data-testid="expense-submit"]').click();

  const newRow = page.locator("tr", { hasText: name });
  await expect(newRow).toBeVisible();

  const newTotalText = await totalElem.textContent();
  const newTotal = parseNumber(newTotalText || "0");
  expect(newTotal).toBeCloseTo(initialTotal + 321, 2);

  const rowTestId = await newRow.getAttribute("data-testid");
  expect(rowTestId).toBeTruthy();
  const id = rowTestId?.replace("expense-row-", "");

  await page.locator(`[data-testid="expense-delete-${id}"]`).click();
  await page.locator(`[data-testid="expense-delete-confirm-${id}"]`).click();

  await expect(newRow).not.toBeVisible();
});

test("top up a wallet and see the balance increase", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/topup");
  await page.locator('[data-testid="open-wallet-fund"]').click();

  const select = page.locator('[data-testid="topup-carrier"]');
  await select.waitFor({ state: "visible" });
  const carrierId = await select.inputValue();

  const balanceCard = page.locator(`[data-testid="wallet-balance-${carrierId}"]`);
  await balanceCard.waitFor({ state: "visible" });
  const initialCardText = await balanceCard.textContent();
  const initialBalance = parseNumber(initialCardText || "0");

  await select.selectOption(carrierId);
  await page.locator('[data-testid="topup-amount"]').fill("100");
  await page.locator('[data-testid="topup-submit"]').click();

  await expect(async () => {
    const updatedCardText = await balanceCard.textContent();
    const updatedBalance = parseNumber(updatedCardText || "0");
    expect(updatedBalance).toBeCloseTo(initialBalance + 100, 2);
  }).toPass({ timeout: 5000 });
});
