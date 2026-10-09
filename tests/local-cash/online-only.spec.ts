import { test, expect, type Page } from "@playwright/test";

// UI/transport checks only: simulated localhost RPC responses, not SQL financial E2E.
const QUEUE = "ucom-pos-queue-v1";
const RECEIPT = "ucom-cash-sale-v1:";
const ROUTE = "ucom-cash-receipt-route-v1:";
const DEVICE = "20000000-0000-4000-8000-000000000001";
const EPOCH = "20000000-0000-4000-8000-000000000002";
const PRODUCT = "20000000-0000-4000-8000-000000000003";
type Payload = { client_uuid: string; [key: string]: unknown };

async function localPos(page: Page, epoch: string | null) {
  let mode: "success" | "unknown" = "success";
  const attempts: Payload[] = [];
  const committed = new Map<string, Payload>();
  await page.context().addInitScript(({ device }) => {
    localStorage.setItem("ucom-receiving-device-v1", device);
    localStorage.setItem("ucom-receiving-token-v1", "a".repeat(64));
  }, { device: DEVICE });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local-only browser fixture attempted an external request");
    if (!url.pathname.startsWith("/rest/v1/")) return route.continue();
    const endpoint = url.pathname.slice("/rest/v1/".length);
    if (endpoint === "rpc/rpc_cash_status") return route.fulfill({ json: {
      epoch, version: 1, drawer: "1000.00", pending: "0.00", reserved: "0.00", available: "0.00",
      asOf: new Date().toISOString(), isOwner: false, receivingDevice: DEVICE, ackVersion: null,
      ackAt: null, isReceivingPaused: false, activationReady: true, openedAt: null,
      handovers: [], closings: [], movements: [],
    } });
    if (["rpc/rpc_cash_execute", "rpc/rpc_create_sale"].includes(endpoint)) {
      const body = route.request().postDataJSON();
      const payload: Payload = endpoint === "rpc/rpc_cash_execute" ? body.p_payload.payload : body.payload;
      attempts.push(payload);
      if (mode === "unknown") return route.abort("failed");
      committed.set(payload.client_uuid, payload);
      return route.fulfill({ json: { id: payload.client_uuid } });
    }
    if (endpoint === "v_pos_catalog") return route.fulfill({
      headers: { "content-range": "0-0/1" },
      json: [{ id: PRODUCT, kind: "product", name: "LOCAL ONLINE ONLY", code: "LOCAL-ONLINE", price: 100, qty: 8, category_name: "เคส" }],
    });
    if (endpoint === "categories") return route.fulfill({ json: [{ name: "เคส", sort_order: 1 }] });
    if (endpoint === "v_pos_topup_carriers") return route.fulfill({ json: [] });
    return route.continue();
  });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("/pos");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill("staff");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  const product = page.getByTestId(`catalog-item-product-${PRODUCT}`);
  await expect(product).toContainText("เหลือ 8");
  return { product, attempts, committed, setMode: (next: typeof mode) => { mode = next; } };
}

async function savedReceipts(page: Page) {
  return page.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix))
    .map(key => JSON.parse(localStorage.getItem(key)!)), RECEIPT);
}

for (const epoch of [null, EPOCH]) {
  const phase = epoch ? "cash book active" : "legacy cash book inactive";
  test(`offline checkout creates no bill and keeps cart (${phase})`, async ({ page, context }) => {
    const fixture = await localPos(page, epoch);
    await fixture.product.click();
    await context.setOffline(true);
    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("checkout-error")).toContainText("เชื่อมต่อ");
    await expect(page.getByTestId("cart-lines")).toHaveAttribute("data-count", "1");
    await expect(fixture.product).toContainText("เหลือ 8");
    expect(fixture.attempts).toHaveLength(0);
    expect(await savedReceipts(page)).toEqual([]);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), QUEUE)).toEqual([]);
    await context.setOffline(false);
    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("cart-lines")).toHaveAttribute("data-count", "0");
    expect(fixture.attempts).toHaveLength(1);
    expect(fixture.committed.size).toBe(1);
    expect(await savedReceipts(page)).toEqual([]);
  });

  test(`unknown online response retains same bill for successful retry (${phase})`, async ({ page }) => {
    const fixture = await localPos(page, epoch);
    fixture.setMode("unknown");
    await fixture.product.click();
    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("checkout-error")).toBeVisible();
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.getByTestId("cart-lines")).toHaveAttribute("data-count", "1");
    await expect(fixture.product).toContainText("เหลือ 8");
    expect(fixture.attempts).toHaveLength(1);
    const original = fixture.attempts[0];
    expect(await savedReceipts(page)).toEqual([original]);
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "[]"), QUEUE)).toEqual([]);
    fixture.setMode("success");
    await page.getByTestId("checkout-submit").click();
    await expect(page.getByTestId("cart-lines")).toHaveAttribute("data-count", "0");
    expect(fixture.attempts).toEqual([original, original]);
    expect(fixture.committed.size).toBe(1);
    expect(await savedReceipts(page)).toEqual([]);
  });
}

test("existing queued and ambiguous bills survive failures and remain recoverable", async ({ page }) => {
  const fixture = await localPos(page, EPOCH);
  fixture.setMode("unknown");
  const queueId = "30000000-0000-4000-8000-000000000001";
  const pendingId = "30000000-0000-4000-8000-000000000002";
  const draft = (id: string) => ({ client_uuid: id, cash_epoch: EPOCH, receiving_device: DEVICE,
    receiving_token: "a".repeat(64), sold_at: "2026-10-09T00:00:00Z", payment_method: "cash",
    bill_discount: "0.00", items: [{ kind: "product", product_id: PRODUCT, qty: 1, unit_price: "100.00", item_discount: "0.00" }] });
  const queued = [{ clientUuid: queueId, payload: draft(queueId), queuedAt: "2026-10-09T00:00:00Z", lastError: null }];
  await page.evaluate(({ queued, pending, queueKey, receiptKey, routeKey }) => {
    localStorage.setItem(queueKey, JSON.stringify(queued));
    localStorage.setItem(receiptKey, JSON.stringify(pending));
    localStorage.setItem(routeKey, JSON.stringify({ action: "sale" }));
  }, { queued, pending: draft(pendingId), queueKey: QUEUE, receiptKey: RECEIPT + pendingId, routeKey: ROUTE + pendingId });
  await page.reload();
  await expect(page.getByTestId("queue-count")).toContainText("1");
  await expect(page.getByTestId("cash-pending-requests")).toContainText(pendingId);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), QUEUE)).toEqual(queued);
  expect(await savedReceipts(page)).toContainEqual(draft(pendingId));
  await page.getByRole("button", { name: "ลองยืนยันข้อมูลเดิม", exact: true }).click();
  await expect(page.getByTestId("cash-pending-requests").getByRole("alert")).toBeVisible();
  expect(await savedReceipts(page)).toContainEqual(draft(pendingId));
  fixture.setMode("success");
  await page.getByRole("button", { name: "ลองยืนยันข้อมูลเดิม", exact: true }).click();
  await expect(page.getByTestId("cash-pending-requests")).toHaveCount(0);
  await page.getByTestId("queue-sync").click();
  await expect(page.getByTestId("queue-banner")).toHaveCount(0);
  expect(fixture.committed.size).toBe(2);
  expect(fixture.committed.get(pendingId)).toEqual(draft(pendingId));
  expect(fixture.committed.get(queueId)).toEqual(draft(queueId));
  expect(await savedReceipts(page)).toEqual([]);
});
