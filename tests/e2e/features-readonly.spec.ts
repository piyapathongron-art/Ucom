import { test, expect } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test("owner and staff can read top-up and consignment pages without exposing costs", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAs(owner, "admin");
  await owner.goto("/topup");
  const walletCards = owner.locator('[data-testid^="wallet-balance-"]');
  await expect(walletCards).toHaveCount(3);
  await expect(owner.getByRole("spinbutton", { name: /ยอดตั้งต้น/ })).toHaveCount(3);
  await expect(owner.locator(".ucom-table tbody tr").first()).toContainText("นำเข้า");
  await expect(owner.getByRole("button", { name: /ยืนยันขายเติมเงิน/ })).toBeDisabled();

  await owner.getByTestId("open-wallet-fund").click();
  await expect(owner.getByTestId("topup-submit")).toBeDisabled();

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await loginAs(staff, "staff");
  await staff.goto("/topup");
  await expect(staff.locator('[data-testid^="wallet-balance-"]')).toHaveCount(3);
  await expect(staff.getByText("ค่าคอมวันนี้", { exact: false })).toHaveCount(0);
  await expect(staff.locator("thead")).not.toContainText("ค่าคอม");

  await staff.goto("/consignments");
  await expect(staff.getByTestId("consignments-tab-out")).toBeVisible();
  await expect(staff.getByTestId("consignments-tab-in")).toBeVisible();
  await expect(staff.locator('[aria-busy="true"]')).toBeHidden({ timeout: 15000 });
  await expect(staff.getByText("ยังไม่มีเครื่องฝากออก", { exact: true })).toBeVisible();
  await staff.getByTestId("consignments-tab-in").click();
  await staff.getByTestId("open-consignment-dialog").click();
  await expect(staff.getByText("รับเครื่องร้านอื่นเข้าฝาก")).toBeVisible();

  await staffContext.close();
  await ownerContext.close();
});
