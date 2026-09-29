import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

// Layer 1 of docs/pos/plan-redesign-e2e.md — READ ONLY. Never clicks a submit/confirm button that
// writes; every write RPC/REST call is tracked and asserted to be absent.
const WRITE_CALL = /\/rest\/v1\/rpc\/rpc_(?!.*(?:get|list))|\/rest\/v1\/(?:expenses|shop_income|products|device_units|topup_wallet_entries)\b/;
const FORBIDDEN_TEXT = /STAFF DESK|OWNER ONLY|OWNER VIEW|STAFF VIEW|WALLET \/ LIVE|SERVICE \/ WORKFLOW/;
const EMOJI = /\p{Extended_Pictographic}/u;
const THAI = /[฀-๿]/;

let owner: BrowserContext;
let staff: BrowserContext;

test.beforeAll(async ({ browser }) => {
  owner = await browser.newContext();
  staff = await browser.newContext();
  await loginAs(await owner.newPage(), "admin");
  await loginAs(await staff.newPage(), "staff");
});
test.afterAll(async () => {
  await owner.close();
  await staff.close();
});

// A page that records write calls (must stay empty) and console/page errors.
async function open(ctx: BrowserContext, path: string) {
  const page = await ctx.newPage();
  const writes: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && WRITE_CALL.test(r.url())) writes.push(`${r.method()} ${r.url()}`);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text());
  });
  page.on("dialog", (d) => { errors.push(`native dialog: ${d.message()}`); void d.dismiss(); });
  await page.goto(path);
  return { page, writes, errors };
}

const bodyText = (page: Page) => page.locator("body").innerText();
const dialog = (page: Page) => page.getByRole("dialog");

test("R1 sidebar: order, footer group, role differences, no eyebrows/emoji", async () => {
  const links = async (ctx: BrowserContext) => {
    const { page } = await open(ctx, "/repairs");
    await expect(page.locator("aside a").first()).toBeVisible();
    const texts = (await page.locator("aside a").allTextContents()).slice(1).map((t) => t.trim());
    expect(await page.locator('aside a[href="/sf-commissions"]').count()).toBe(0);
    await expect(page.locator("aside a[aria-current=page]")).toContainText("งานซ่อม");
    await expect(page.getByRole("button", { name: "ออกจากระบบ" }).first()).toBeVisible();
    const text = await bodyText(page);
    expect(text).not.toMatch(FORBIDDEN_TEXT);
    expect(text).not.toMatch(EMOJI);
    await page.close();
    return texts;
  };
  const base = ["ขายสินค้า", "สต็อก/เครื่อง", "งานซ่อม", "ฝากขาย & SF+", "เติมเงิน"];
  expect(await links(staff)).toEqual([...base, "ปิดร้าน"]);
  expect(await links(owner)).toEqual([...base, "รายงาน", "รายรับ–รายจ่าย", "ปิดร้าน", "ตั้งค่า"]);
});

test("R2 design tokens are applied", async () => {
  const { page } = await open(staff, "/repairs");
  const cta = page.getByTestId("open-intake-form");
  await expect(cta).toBeVisible();
  const style = await page.evaluate(() => {
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    return {
      font: cs(document.body)?.fontFamily,
      ctaBg: cs(document.querySelector(".ucom-primary"))?.backgroundColor,
      ctaRadius: cs(document.querySelector(".ucom-primary"))?.borderTopLeftRadius,
      thBg: cs(document.querySelector(".ucom-table th"))?.backgroundColor,
      cardRadius: cs(document.querySelector(".ucom-table-wrap, .ucom-surface"))?.borderTopLeftRadius,
    };
  });
  expect(style.font).toMatch(/^"?Inter/);
  expect(style.ctaBg).toBe("rgb(221, 255, 141)");
  expect(parseFloat(style.ctaRadius ?? "0")).toBeGreaterThanOrEqual(999);
  expect(style.cardRadius).toBe("20px");
  if (style.thBg) expect(style.thBg).toBe("rgb(17, 16, 22)");
});

test("R3 /sf-commissions redirects into the SF+ tab", async () => {
  const { page } = await open(staff, "/sf-commissions");
  await expect(page).toHaveURL(/\/consignments\?tab=sf/);
  await expect(page.getByTestId("consignments-tab-sf")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("sf-tab-due")).toBeVisible();
});

test("R4 repairs: intake dialog, abandon dialog hides part cost", async () => {
  const { page, writes, errors } = await open(staff, "/repairs");
  await page.getByTestId("open-intake-form").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("intake-submit")).toBeDisabled();
  await page.getByTestId("intake-customer-name").fill("ZZRO-not-saved");
  await page.getByTestId("intake-device-desc").fill("ZZRO-device");
  await expect(page.getByTestId("intake-submit")).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();

  await expect(page.locator('[aria-busy="true"]')).toBeHidden({ timeout: 15000 });
  for (const f of ["open", "collected", "abandoned", "all"]) await expect(page.getByTestId(`filter-${f}`)).toBeVisible();
  const abandon = page.locator('[data-testid^="repair-abandon-"]:not([data-testid*="confirm"])').first();
  if (await abandon.count()) {
    await abandon.click();
    await expect(dialog(page)).toContainText("ลูกค้าทิ้ง");
    await expect(dialog(page)).not.toContainText(/ต้นทุน|part cost/i);
    await dialog(page).getByRole("button", { name: "ยกเลิก" }).click();
    await expect(dialog(page)).toBeHidden();
  } else test.info().annotations.push({ type: "skipped-part", description: "no open repair job to open the abandon dialog on" });
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("R5 stock: tabs, CTA per tab, drawer, empty state, no SF button", async () => {
  const { page, writes, errors } = await open(owner, "/stock");
  await expect(page.getByTestId("stock-kind-product")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("open-add-product")).toBeVisible();
  await expect(page.getByTestId("cost-column-header")).toBeVisible();
  await expect(page.getByRole("button", { name: /รับ SF|รับบิล SF/ })).toHaveCount(0);
  const productStatuses = await page.getByTestId("stock-status-filter").locator("option").allTextContents();
  expect(productStatuses.join()).not.toContain("ฝากขายออกแล้ว");

  const firstRow = page.locator('[data-testid^="stock-open-"]').first();
  await firstRow.waitFor({ timeout: 15000 }).catch(() => undefined);
  if (await firstRow.count()) {
    await firstRow.click();
    await expect(dialog(page)).toBeVisible();
    const box = await dialog(page).boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(380);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
  }

  await page.getByTestId("stock-kind-device").click();
  await expect(page.getByTestId("open-add-device")).toBeVisible();
  await expect(page.getByTestId("open-add-product")).toHaveCount(0);
  expect((await page.getByTestId("stock-status-filter").locator("option").allTextContents()).join()).toContain("ฝากขายออกแล้ว");

  await page.getByPlaceholder("ค้นหาสินค้า / เครื่อง / SKU / IMEI").fill("zzz-no-match-xyz");
  await expect(page.getByText("ไม่พบรายการตามตัวกรอง")).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await expect(page.getByPlaceholder("ค้นหาสินค้า / เครื่อง / SKU / IMEI")).toHaveValue("");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("R6 consignments: tabs, CTA, validation without RPC, SF dialog scan + duplicate check", async () => {
  const { page, writes, errors } = await open(staff, "/consignments");
  await expect(page.getByTestId("open-consignment-dialog")).toContainText("ฝากออก");
  await page.getByTestId("open-consignment-dialog").click();
  await page.getByTestId("consignment-open-submit").click();
  await expect(dialog(page)).toContainText("กรุณากรอก IMEI");
  await page.keyboard.press("Escape");

  await page.getByTestId("consignments-tab-in").click();
  await expect(page.getByTestId("open-consignment-dialog")).toContainText("รับฝากเข้า");
  await page.getByTestId("consignments-tab-sf").click();
  await expect(page.getByTestId("open-sf-intake")).toContainText("รับบิล SF");
  for (const t of ["pending", "receipts", "due"]) {
    await page.getByTestId(`sf-tab-${t}`).click();
    await expect(page.getByTestId(`sf-tab-${t}`)).toHaveAttribute("aria-selected", "true");
  }

  await page.getByTestId("open-sf-intake").click();
  await expect(dialog(page)).toBeVisible();
  await page.getByTestId("sf-order-no").fill("ZZRO-SF-not-saved");
  const scan = async (code: string) => { await page.keyboard.type(code, { delay: 5 }); await page.keyboard.press("Enter"); };
  await page.getByTestId("sf-order-no").blur();
  await scan("990000000000001");
  await expect(page.getByTestId("sf-device-imei-0")).toHaveValue("990000000000001");
  await page.getByTestId("sf-device-model-0").fill("ZZRO-model");
  await page.getByTestId("sf-device-price-0").fill("1000");
  await page.getByTestId("sf-order-no").blur();
  await scan("990000000000002");
  await expect(page.getByTestId("sf-device-imei-1")).toHaveValue("990000000000002");
  await expect(page.getByTestId("sf-device-model-1")).toHaveValue("ZZRO-model");
  await expect(page.getByTestId("sf-device-price-1")).toHaveValue("1000");
  await expect(page.getByTestId("sf-intake-summary")).toContainText("2 เครื่อง");
  await page.getByTestId("sf-order-no").blur();
  await scan("990000000000001");
  await expect(page.getByTestId("sf-device-imei-2")).toHaveValue("990000000000001");
  await page.getByTestId("sf-intake-submit").click();
  await expect(dialog(page).getByText("IMEI ซ้ำกับแถวอื่นในบิลนี้").first()).toBeVisible();
  await page.keyboard.press("Escape");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("R7 topup: wallet cards, owner-only fund dialog, opening confirm cancel", async () => {
  const o = await open(owner, "/topup");
  await expect(o.page.locator('[data-testid^="wallet-balance-"]').first()).toBeVisible();
  await o.page.getByTestId("open-wallet-fund").click();
  await expect(dialog(o.page)).toContainText("เติมเงินเข้าวอลเล็ต");
  await o.page.keyboard.press("Escape");
  await expect(dialog(o.page)).toBeHidden();
  const openers = o.page.getByRole("spinbutton", { name: /ยอดตั้งต้น/ });
  if (await openers.count()) {
    await openers.first().fill("1");
    await openers.first().locator("..").getByRole("button", { name: "ตั้งยอด" }).click();
    await expect(dialog(o.page)).toContainText("ตั้งได้เพียงครั้งเดียว");
    await dialog(o.page).getByRole("button", { name: "ยกเลิก" }).click();
    await expect(dialog(o.page)).toBeHidden();
  } else test.info().annotations.push({ type: "skipped-part", description: "all wallets already initialized" });
  expect(o.writes).toEqual([]);
  expect(o.errors).toEqual([]);

  const s = await open(staff, "/topup");
  await expect(s.page.locator('[data-testid^="wallet-balance-"]').first()).toBeVisible();
  await expect(s.page.getByTestId("open-wallet-fund")).toHaveCount(0);
});

test("R8 ledger (owner): tabs, totals, add dialog date rule, range filter", async () => {
  const { page, writes, errors } = await open(owner, "/expenses");
  await expect(page.getByTestId("expense-total")).toBeVisible();
  await expect(page.getByTestId("ledger-net")).toBeVisible();
  await expect(page.locator("thead").first()).toContainText("จ่ายจาก");
  await page.getByTestId("open-ledger-add").click();
  await expect(page.getByTestId("expense-date")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("ledger-tab-income").click();
  await expect(page.getByTestId("ledger-tab-income")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("open-ledger-add").click();
  await expect(page.getByTestId("income-name")).toBeVisible();
  await expect(page.getByTestId("income-date")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("expense-filter-from").fill("2099-01-01");
  await page.getByTestId("expense-filter-to").fill("2099-12-31");
  await expect(page.getByTestId("expense-total")).toContainText("0.00");
  await expect(page.getByTestId("ledger-net")).toContainText("0.00");
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);

  const denied = await open(staff, "/expenses");
  await denied.page.waitForLoadState("networkidle");
  await expect(denied.page.getByTestId("expense-total")).toHaveCount(0);
});

test("R9 close-day: shared add dialog has no date, ledger link by role, confirm dialog cancels", async () => {
  const { page, writes, errors } = await open(staff, "/close-day");
  await expect(page.getByTestId("open-close-day-expense-add")).toBeVisible();
  await page.getByTestId("open-close-day-expense-add").click();
  await expect(page.getByTestId("close-day-expense-name")).toBeVisible();
  await expect(page.getByTestId("close-day-expense-date")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("close-day-expense-ledger-link")).toHaveCount(0);

  if (await page.getByTestId("close-day-reclose").count()) await page.getByTestId("close-day-reclose").click();
  await page.getByTestId("close-day-counted-cash").fill("0");
  const confirm = page.getByTestId("close-day-confirm");
  if (await confirm.isEnabled()) {
    await confirm.click();
    await expect(dialog(page)).toContainText("ยอดที่ต้องส่ง");
    await expect(dialog(page)).toContainText("นับได้จริง");
    await expect(dialog(page)).toContainText("ส่วนต่าง");
    await dialog(page).getByRole("button", { name: "ยกเลิก" }).click();
    await expect(dialog(page)).toBeHidden();
  } else await expect(page.getByTestId("close-day-queue-warning")).toBeVisible();
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);

  const o = await open(owner, "/close-day");
  await expect(o.page.getByTestId("close-day-expense-ledger-link")).toBeVisible();
});

test("R10 pos: no native dialog, empty queue banner absent", async () => {
  const { page, errors } = await open(staff, "/pos");
  await expect(page.getByTestId("catalog-search")).toBeVisible();
  await expect(page.getByTestId("queue-banner")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("R11 report + settings (owner): load clean, no eyebrow", async () => {
  for (const path of ["/report", "/settings"]) {
    const { page, errors } = await open(owner, path);
    await page.waitForLoadState("networkidle");
    expect(await bodyText(page)).not.toMatch(FORBIDDEN_TEXT);
    expect(errors, path).toEqual([]);
  }
});

test("R12 backend failure shows a Thai panel, never raw DB text; retry recovers", async () => {
  const targets: [BrowserContext, string][] = [
    [staff, "/repairs"], [owner, "/stock"], [staff, "/consignments"], [owner, "/expenses"], [staff, "/close-day"], [owner, "/report"],
  ];
  for (const [ctx, path] of targets) {
    const page = await ctx.newPage();
    await page.route("**/rest/v1/**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "XX000", message: 'relation "secret_table" does not exist PGRST' }) }));
    await page.goto(path);
    const panel = page.locator('main div[role="alert"]').first();
    await expect(panel, path).toBeVisible({ timeout: 15000 });
    const text = await bodyText(page);
    expect(text, path).not.toMatch(/secret_table|PGRST|relation|does not exist/i);
    expect(await panel.innerText(), path).toMatch(THAI);
    if (path === "/repairs") {
      await page.unroute("**/rest/v1/**");
      await page.getByRole("button", { name: "ลองใหม่" }).first().click();
      await expect(page.locator('main div[role="alert"]')).toHaveCount(0, { timeout: 15000 });
    }
    await page.close();
  }
});

test("R13 no console/page errors across every page", async () => {
  const all: [BrowserContext, string][] = [
    [staff, "/pos"], [staff, "/stock"], [staff, "/repairs"], [staff, "/consignments"], [staff, "/consignments?tab=sf"],
    [staff, "/topup"], [staff, "/close-day"], [owner, "/report"], [owner, "/expenses"], [owner, "/settings"],
  ];
  for (const [ctx, path] of all) {
    const { page, errors } = await open(ctx, path);
    await page.waitForLoadState("networkidle");
    const text = await bodyText(page);
    expect(text, path).not.toMatch(FORBIDDEN_TEXT);
    expect(errors, path).toEqual([]);
    await page.close();
  }
});
