import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

const proof = { name: "local-proof.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") };
function headers() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role: "authenticated", sub: "00000000-0000-4000-8000-000000000001", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 7200 })}`;
  return { Authorization: `Bearer ${unsigned}.${createHmac("sha256", "ucom-local-cash-fixture-jwt-secret-20261007-32chars").update(unsigned).digest("base64url")}` };
}
async function login(page: Page, username = "staff") {
  await page.goto("/cash?intent=deposit");
  await page.getByLabel("ชื่อผู้ใช้", { exact: true }).fill(username);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^(เงินสดร้าน|ฝากเงินร้าน)$/ })).toBeVisible();
}
async function acknowledge(page: Page) {
  const statusResponse = await page.request.post("http://localhost:55441/rest/v1/rpc/rpc_cash_status", { headers: headers(), data: {} });
  expect(statusResponse.ok()).toBe(true);
  const status = await statusResponse.json();
  const ack = await page.request.post("http://localhost:55441/rest/v1/rpc/rpc_cash_pos_ack", { headers: headers(), data: { p_epoch: status.epoch, p_device: "20000000-0000-4000-8000-000000000001", p_device_token: "a".repeat(64), p_version: status.version } });
  expect(ack.ok()).toBe(true);
  return status;
}

test("daily mobile deposit selects dates, moves pre-departure drawer and preserves partial return", async ({ page }, info) => {
  await login(page);
  await expect(page.getByTestId("cash-deposit")).toContainText("1,557");
  await page.getByRole("button", { name: "เลือกทุกวัน", exact: true }).click();
  await expect(page.getByTestId("cash-day-date:2026-09-30")).toBeChecked();
  await expect(page.getByTestId("cash-day-date:2026-10-01")).toBeChecked();
  await page.getByLabel("แยกเข้าเก๊ะ (บาท)").fill("57");
  await page.getByLabel("ผู้ถือเงินไปฝาก").fill("ทดสอบรายวัน");
  await page.getByLabel("แยกเศษเข้าเก๊ะแล้ว และตรวจเงินที่จะนำออกไปฝากตามยอดข้างต้นแล้ว").check();
  await page.getByRole("button", { name: "ยืนยันนำเงินออกไปฝาก", exact: true }).click();
  const handover = page.locator("article").filter({ hasText: "ทดสอบรายวัน" });
  await expect(handover).toContainText("กำลังไปฝาก");
  await expect(handover).toContainText("1,443");
  await page.reload();
  await expect(handover).toContainText("1,443");
  await handover.getByLabel("ฝากธนาคารจริง (บาท)").fill("1200");
  await handover.getByText("เงินเหลือกลับร้าน", { exact: true }).click();
  await handover.getByLabel("คืนกองรอฝาก (บาท)").fill("243");
  await handover.getByLabel("วันและเวลาที่ฝากจริง (เวลาไทย)").fill(new Date(Date.now() + 60000).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).replace(" ", "T").slice(0, 16));
  await handover.locator('input[type="file"]').setInputFiles(proof);
  await handover.getByLabel("ยืนยันว่าเงินที่นำออกไปจัดการครบแล้ว (ฝากธนาคารแล้ว และเงินที่เหลือถ้ามีคืนเข้าร้านแล้ว)").check();
  await handover.getByRole("button", { name: "ส่งสรุปเข้า LINE", exact: true }).click();
  await expect(handover).toContainText("แจ้งฝากแล้ว รอตรวจ");
  const settled = await acknowledge(page);
  expect(Number(settled.drawer)).toBe(1057);
  expect(Number(settled.pending)).toBe(300);
  expect(Number(settled.reserved)).toBe(0);
  await handover.getByRole("button", { name: "เปิดหลักฐานส่วนตัว" }).click();
  await expect(handover.getByRole("link", { name: /ดูหลักฐาน/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("daily-deposit-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.context().clearCookies();
  await login(page, "admin");
  await handover.getByText("เจ้าของตรวจหลักฐาน", { exact: true }).click();
  await handover.getByLabel("บันทึกผลตรวจ", { exact: true }).fill("ตรวจหลักฐานจำลองแล้ว");
  await handover.getByLabel("ตรวจหลักฐานและรายการธนาคารแล้ว").check();
  await handover.getByRole("button", { name: "บันทึกผลตรวจ", exact: true }).click();
  await expect(handover).toContainText("เจ้าของยืนยันแล้ว");
  const reviewed = await acknowledge(page);
  expect(reviewed.drawer).toBe(settled.drawer);
  expect(reviewed.pending).toBe(settled.pending);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("ucom-cash-operation-v2:")).length)).toBe(0);
});

test("lost committed response survives reload, replays once and cancellation keeps drawer remainder", async ({ page }) => {
  await acknowledge(page);
  await login(page);
  await page.getByTestId("cash-day-date:2026-10-01").check();
  await page.getByLabel("แยกเข้าเก๊ะ (บาท)").fill("3");
  await page.getByLabel("ผู้ถือเงินไปฝาก").fill("ทดสอบเน็ตหลุด");
  await page.getByLabel("แยกเศษเข้าเก๊ะแล้ว และตรวจเงินที่จะนำออกไปฝากตามยอดข้างต้นแล้ว").check();
  let hasDroppedResponse = false;
  await page.route("**/cash?intent=deposit", async route => {
    if (!hasDroppedResponse && route.request().method() === "POST" && route.request().postData()?.includes("handover_days")) {
      hasDroppedResponse = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "ยืนยันนำเงินออกไปฝาก", exact: true }).click();
  await expect.poll(() => hasDroppedResponse).toBe(true);
  await expect.poll(async () => Number((await acknowledge(page)).reserved)).toBe(240);
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("ucom-cash-operation-v2:")).length)).toBe(1);
  await page.unroute("**/cash?intent=deposit");
  await page.reload();
  const recovery = page.getByTestId("cash-event-recovery");
  await recovery.getByRole("button", { name: "ยืนยันข้อมูลเดิม", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("ucom-cash-operation-v2:")).length)).toBe(0);
  const replayed = await acknowledge(page);
  expect(Number(replayed.reserved)).toBe(240);
  expect(Number(replayed.drawer)).toBe(1060);
  expect(replayed.handovers.filter((item: { custodian: string }) => item.custodian === "ทดสอบเน็ตหลุด")).toHaveLength(1);
  const handover = page.locator("article").filter({ hasText: "ทดสอบเน็ตหลุด" });
  await handover.getByText("ยกเลิกและคืนเงินทั้งหมด", { exact: true }).click();
  await handover.getByLabel("เหตุผลที่ไม่นำฝาก").fill("ทดสอบคืนเงินจริง");
  await handover.getByLabel("คืนเงินทั้งหมดเข้ากองเงินรอฝากในร้านแล้ว ยังไม่มีการฝากธนาคาร").check();
  await handover.getByRole("button", { name: "ยืนยันคืนเงินทั้งหมด", exact: true }).click();
  await expect(handover).toHaveCount(0);
  const returned = await acknowledge(page);
  expect(Number(returned.drawer)).toBe(1060);
  expect(Number(returned.pending)).toBe(297);
  expect(Number(returned.reserved)).toBe(0);
});

test("an unresolved corrupt deposit blocks closing until the original request is investigated", async ({ page }) => {
  const status = await acknowledge(page);
  await login(page, "admin");
  const key = "ucom-cash-operation-v2:70000000-0000-4000-8000-000000000001";
  await page.evaluate(key => localStorage.setItem(key, "{corrupt-test-fixture"), key);
  await page.goto("/close-day");
  await expect(page.getByTestId("two-fund-closing")).toBeVisible();
  await page.getByTestId("close-drawer-count").fill(status.drawer);
  await page.getByTestId("close-pending-count").fill(status.available);
  await page.getByTestId("cash-close-review").click();
  await expect(page.getByTestId("two-fund-closing").getByRole("alert")).toContainText("รายการเงินสดเดิม");
  await expect(page.getByTestId("cash-close-confirm")).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith("ucom-cash-close-v1:")))).toBe(false);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("{corrupt-test-fixture");
  await page.evaluate(key => localStorage.removeItem(key), key);
});
