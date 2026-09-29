import { test, expect, type Page } from "@playwright/test";
import { loginAs, uniqueCustomer, uniqueDevice, findJobIdByCustomer } from "./repairs-helpers";

// Layer 2 of docs/pos/plan-redesign-e2e.md — WRITES to the shared production project.
// Do not run without the approved preflight snapshot; afterwards run
//   node scripts/e2e-zztest.mts cleanup --snapshot <file>   (dry run first, then --apply)
// Every row carries a ZZTEST-/TEST-SF- marker so that cleanup can find exactly what this run made.
test.use({ baseURL: "http://localhost:3002" });

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const num = (text: string | null) => Number(((text ?? "").match(/-?[\d,]+\.\d{2}/)?.[0] ?? "NaN").replace(/,/g, ""));
const dialog = (page: Page) => page.getByRole("dialog");

test("W3 stock drawer: a failed save keeps the draft, then create + edit persist", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/stock");
  const name = `ZZTEST-DRAWER-${stamp()}`;
  await page.getByTestId("open-add-product").click();
  await page.getByTestId("add-product-name").fill(name);
  await page.getByTestId("add-product-price").fill("123");
  await page.getByTestId("add-product-qty").fill("5");

  await page.route("**/rpc/rpc_upsert_product", (route) => route.abort());
  await page.getByTestId("add-product-submit").click();
  await expect(page.getByText("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")).toBeVisible();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("add-product-name")).toHaveValue(name);
  await page.unroute("**/rpc/rpc_upsert_product");

  await page.getByTestId("add-product-submit").click();
  await expect(dialog(page)).toBeHidden();
  const search = page.getByPlaceholder("ค้นหาสินค้า / เครื่อง / SKU / IMEI");
  await search.fill(name);
  const open = page.locator('[data-testid^="stock-open-"]');
  await expect(open).toHaveCount(1);
  const id = (await open.getAttribute("data-testid"))!.replace("stock-open-", "");
  await open.click();
  await dialog(page).getByLabel("ราคาขาย").fill("456");
  await page.getByTestId(`stock-save-${id}`).click();
  await expect(dialog(page)).toBeHidden();

  await page.reload();
  await page.getByPlaceholder("ค้นหาสินค้า / เครื่อง / SKU / IMEI").fill(name);
  await page.locator(`[data-testid="stock-open-${id}"]`).click();
  await expect(dialog(page).getByLabel("ราคาขาย")).toHaveValue("456");
  // owner cost edit on the row we created (never on real stock)
  await dialog(page).getByTestId(`stock-cost-${id}`).fill("77");
  await page.getByTestId(`stock-save-cost-${id}`).click();
  await expect(page.getByText("บันทึกต้นทุนแล้ว")).toBeVisible();
});

test("W1 repairs: a failed close keeps the dialog and the retry reuses the same client_uuid", async ({ page }) => {
  await loginAs(page, "staff");
  await page.goto("/repairs");
  const customer = uniqueCustomer();
  await page.getByTestId("open-intake-form").click();
  await page.getByTestId("intake-customer-name").fill(customer);
  await page.getByTestId("intake-device-desc").fill(uniqueDevice());
  await page.getByTestId("intake-quoted-price").fill("450");
  await page.getByTestId("intake-submit").click();
  await expect(dialog(page)).toBeHidden();
  const id = await findJobIdByCustomer(page, customer);
  await page.getByTestId(`repair-status-forward-${id}`).click();
  await expect(page.getByTestId(`repair-status-${id}`)).toContainText("กำลังซ่อม");
  await page.getByTestId(`repair-status-forward-${id}`).click();

  const uuids: string[] = [];
  let calls = 0;
  await page.route("**/rpc/rpc_close_repair_job", (route) => {
    uuids.push(JSON.parse(route.request().postData() ?? "{}").p_sale_payload?.client_uuid);
    return calls++ === 0 ? route.abort() : route.continue();
  });
  await page.getByTestId(`repair-close-${id}`).click();
  await page.getByTestId("close-submit").click();
  await expect(page.getByText("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง")).toBeVisible();
  await expect(page.getByTestId("close-dialog")).toBeVisible();
  await page.getByTestId("close-submit").click();
  await expect(dialog(page)).toBeHidden();
  expect(uuids).toHaveLength(2);
  expect(uuids[0]).toBeTruthy();
  expect(uuids[1]).toBe(uuids[0]);
  await page.getByTestId("filter-collected").click();
  await expect(page.getByTestId(`repair-status-${id}`)).toHaveText("รับแล้ว");
});

test("W4 SF+: intake dialog → highlighted in บิลค้าง → duplicate checks → edit → delete", async ({ page }) => {
  await loginAs(page, "staff");
  await page.goto("/consignments?tab=sf");
  const s = stamp();
  const orderNo = `TEST-SF-${s}`;
  const model = `ZZTEST-SFDLG-${s}`;
  const imei = String(Date.now()).padEnd(15, "7").slice(0, 15);
  const fill = async (order: string, code: string) => {
    await page.getByTestId("open-sf-intake").click();
    await page.getByTestId("sf-order-no").fill(order);
    await page.getByTestId("sf-device-imei-0").fill(code);
    await page.getByTestId("sf-device-model-0").fill(model);
    await page.getByTestId("sf-device-price-0").fill("3000");
  };

  await fill(orderNo, imei);
  await page.getByTestId("sf-intake-submit").click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId("sf-tab-due")).toHaveAttribute("aria-selected", "true");
  const row = page.locator("tr", { hasText: orderNo });
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/bg-brand-ink/);

  // same IMEI again and same order number again → Thai messages, no second RPC
  let rpcCalls = 0;
  page.on("request", (r) => { if (r.url().includes("rpc_receive_sf_order")) rpcCalls++; });
  await fill(orderNo, imei);
  await page.getByTestId("sf-intake-submit").click();
  await expect(dialog(page).getByText("IMEI นี้มีอยู่ในระบบแล้ว")).toBeVisible();
  await expect(dialog(page).getByText("เลขที่บิลนี้มีอยู่ในระบบแล้ว")).toBeVisible();
  expect(rpcCalls).toBe(0);
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "แก้ไข" }).click();
  await expect(page.getByTestId("sf-device-model-0")).toHaveValue(model);
  await page.getByTestId("sf-device-model-0").fill(`${model}-EDIT`);
  await page.getByTestId("sf-due-edit-submit").click();
  await expect(dialog(page)).toBeHidden();

  await row.getByRole("button", { name: "ลบ", exact: true }).click();
  await row.getByRole("button", { name: "ยืนยันลบ" }).click();
  await expect(row).toHaveCount(0);
});

test("W7 ledger: expense (dated) + off-bill income move totals and net exactly; deletes restore them", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/expenses");
  const total = () => page.getByTestId("expense-total");
  const net = () => page.getByTestId("ledger-net");
  await expect(total()).toBeVisible();
  const exp0 = num(await total().textContent());
  const net0 = num(await net().textContent());
  const s = stamp();

  await page.getByTestId("open-ledger-add").click();
  await page.getByTestId("expense-name").fill(`ZZTEST-LEDGER-EXP-${s}`);
  await page.getByTestId("expense-amount").fill("123.45");
  await page.getByTestId("expense-submit").click();
  const expRow = page.locator("tr", { hasText: `ZZTEST-LEDGER-EXP-${s}` });
  await expect(expRow).toBeVisible();
  await expect.poll(async () => num(await total().textContent())).toBeCloseTo(exp0 + 123.45, 2);
  expect(num(await net().textContent())).toBeCloseTo(net0 - 123.45, 2);

  await page.getByTestId("ledger-tab-income").click();
  const inc0 = num(await total().textContent());
  await page.getByTestId("open-ledger-add").click();
  await page.getByTestId("income-name").fill(`ZZTEST-LEDGER-INC-${s}`);
  await page.getByTestId("income-amount").fill("200");
  await page.getByTestId("income-submit").click();
  const incRow = page.locator("tr", { hasText: `ZZTEST-LEDGER-INC-${s}` });
  await expect(incRow).toBeVisible();
  await expect.poll(async () => num(await total().textContent())).toBeCloseTo(inc0 + 200, 2);
  expect(num(await net().textContent())).toBeCloseTo(net0 - 123.45 + 200, 2);

  await incRow.getByRole("button", { name: "ลบ", exact: true }).click();
  await incRow.getByRole("button", { name: "ยืนยันลบ" }).click();
  await expect(incRow).toHaveCount(0);
  await page.getByTestId("ledger-tab-expense").click();
  await expRow.getByRole("button", { name: "ลบ", exact: true }).click();
  await expRow.getByRole("button", { name: "ยืนยันลบ" }).click();
  await expect(expRow).toHaveCount(0);
  await expect.poll(async () => num(await net().textContent())).toBeCloseTo(net0, 2);
});

test("W10 settings: carrier commission rate saves, persists, and is restored", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/settings");
  const form = page.locator("form", { has: page.locator('input[type="number"]') }).first();
  const input = form.locator('input[type="number"]');
  await expect(input).toBeVisible();
  const original = await input.inputValue();
  test.info().annotations.push({ type: "original-rate", description: original });
  const changed = (Number(original) >= 99.98 ? Number(original) - 0.01 : Number(original) + 0.01).toFixed(2);
  try {
    await input.fill(changed);
    await form.getByRole("button", { name: "บันทึก" }).click();
    await expect(page.getByText("บันทึกอัตรา")).toBeVisible();
    await page.reload();
    await expect(form.locator('input[type="number"]')).toHaveValue(changed);
  } finally {
    await page.goto("/settings");
    const again = page.locator("form", { has: page.locator('input[type="number"]') }).first();
    await again.locator('input[type="number"]').fill(original);
    if (await again.getByRole("button", { name: "บันทึก" }).isEnabled()) await again.getByRole("button", { name: "บันทึก" }).click();
    await expect(again.locator('input[type="number"]')).toHaveValue(original);
  }
});
