import { test, expect } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

test("keyboard-wedge scan finds an off-page SKU and restores the focused search", async ({ page }) => {
  await loginAs(page, "staff");
  const name = `ZZTEST-BARCODE-${Date.now()}`;
  const sku = Date.now().toString();

  await page.goto("/stock");
  await page.locator('[data-testid="open-add-product"]').click();
  await page.locator('[data-testid="add-product-name"]').fill(name);
  await page.locator('[data-testid="add-product-sku"]').fill(sku);
  await page.locator('[data-testid="add-product-price"]').fill("100");
  await page.locator('[data-testid="add-product-qty"]').fill("2");
  await page.locator('[data-testid="add-product-submit"]').click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/pos");
  const search = page.locator('[data-testid="catalog-search"]');
  await search.fill("no-such-product");
  await expect(page.locator('[data-testid^="catalog-item-product-"]')).toHaveCount(0);
  await search.focus();
  await page.keyboard.type(sku);
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-testid="scan-feedback"]')).toContainText(`เพิ่ม ${name} ลงตะกร้าแล้ว`);
  await expect(page.locator('[data-testid="cart-lines"]')).toHaveAttribute("data-count", "1");
  await expect(search).toHaveValue("no-such-product");
});
