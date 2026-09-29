import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const outModel = `ZZTEST-CONS-OUT-${suffix}`;
const inModel = `ZZTEST-CONS-IN-${suffix}`;
const outReturnModel = `ZZTEST-CONS-OUT-RETURN-${suffix}`;
const inReturnModel = `ZZTEST-CONS-IN-RETURN-${suffix}`;
const counterparty = `ZZTEST-PARTNER-${suffix}`;

function adminClient() {
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase test credentials");
  return createClient(url, key);
}

async function caseState(model: string) {
  const admin = adminClient();
  const device = await admin.from("device_units").select("id,status").eq("model_name", model).single();
  if (device.error || !device.data) throw device.error ?? new Error(`Missing ${model}`);
  const result = await admin.from("consignments").select("id,direction,status,sale_id,gross_sale_amount,partner_share")
    .eq("device_unit_id", device.data.id).eq("counterparty_name", counterparty).single();
  if (result.error || !result.data) throw result.error ?? new Error(`Missing case for ${model}`);
  return { device: device.data, consignment: result.data };
}

async function assertSale(model: string, amount: number, cost: number) {
  const admin = adminClient();
  const state = await caseState(model);
  expect(state.consignment.sale_id).toBeTruthy();
  const lines = await admin.from("sale_items").select("unit_price,unit_cost,device_unit_id")
    .eq("sale_id", state.consignment.sale_id!);
  if (lines.error) throw lines.error;
  expect(lines.data).toHaveLength(1);
  expect(Number(lines.data?.[0].unit_price)).toBe(amount);
  expect(Number(lines.data?.[0].unit_cost)).toBe(cost);
  expect(lines.data?.[0].device_unit_id).toBe(state.device.id);
}

async function fillOpenForm(page: Page, imei: string, listedPrice: string, model?: string) {
  await page.locator('[data-testid="open-consignment-dialog"]').click();
  await page.getByLabel("IMEI").fill(imei);
  if (model) await page.getByLabel("รุ่นเครื่อง").fill(model);
  await page.getByLabel(model ? "เจ้าของเครื่อง" : "ร้านที่รับฝาก").fill(counterparty);
  await page.getByLabel("ราคาตั้ง").fill(listedPrice);
}

test.afterAll(async () => {
  const admin = adminClient();
  for (const model of [outModel, inModel, outReturnModel, inReturnModel]) {
    const device = await admin.from("device_units").select("id").eq("model_name", model);
    if (device.error) throw device.error;
    if (!device.data?.length) continue;
    if (device.data.length !== 1) throw new Error(`Unsafe cleanup: ${model} matched ${device.data.length} devices`);
    const deviceId = device.data[0].id;
    const cases = await admin.from("consignments").select("id,sale_id,counterparty_name")
      .eq("device_unit_id", deviceId);
    if (cases.error) throw cases.error;
    if ((cases.data?.length ?? 0) > 1 || (cases.data?.[0] && cases.data[0].counterparty_name !== counterparty)) {
      throw new Error(`Unsafe cleanup: case mismatch for ${model}`);
    }
    const caseRow = cases.data?.[0];
    if (caseRow) {
      const deletedCase = await admin.from("consignments").delete().eq("id", caseRow.id).select("id");
      if (deletedCase.error || deletedCase.data?.length !== 1) throw deletedCase.error ?? new Error("Case cleanup failed");
      if (caseRow.sale_id) {
        const deletedSale = await admin.from("sales").delete().eq("id", caseRow.sale_id).select("id");
        if (deletedSale.error || deletedSale.data?.length !== 1) throw deletedSale.error ?? new Error("Sale cleanup failed");
      }
    }
    const deletedDevice = await admin.from("device_units").delete().eq("id", deviceId).select("id");
    if (deletedDevice.error || deletedDevice.data?.length !== 1) throw deletedDevice.error ?? new Error("Device cleanup failed");
  }
});

test("outgoing and incoming consignment keep custody, sale and settlement separate", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "staff");
  const outImei = `${Date.now()}1`.slice(0, 15);
  const inImei = `${Date.now()}2`.slice(0, 15);

  await page.goto("/stock");
  await page.locator('[data-testid="stock-kind-device"]').click();
  await page.locator('[data-testid="open-add-device"]').click();
  await page.locator('[data-testid="add-device-imei"]').fill(outImei);
  await page.locator('[data-testid="add-device-model"]').fill(outModel);
  await page.locator('[data-testid="add-device-price"]').fill("1500");
  await page.locator('[data-testid="add-device-cost"]').fill("1000");
  await page.locator('[data-testid="add-device-submit"]').click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/consignments");
  await fillOpenForm(page, outImei, "1500");
  await page.locator('[data-testid="consignment-open-submit"]').click();
  const outRow = page.getByRole("row", { name: new RegExp(outModel) });
  await expect(outRow).toContainText("ฝากอยู่");
  expect((await caseState(outModel)).consignment.sale_id).toBeNull();

  await outRow.getByRole("button", { name: "แจ้งขาย" }).click();
  await page.getByLabel("ราคาที่ขายจริง").fill("1500");
  await page.getByLabel("ส่วนแบ่งคู่ค้า").fill("200");
  await page.getByRole("button", { name: "ยืนยันคู่ค้าแจ้งขาย" }).click();
  await expect(outRow).toContainText("แจ้งขายแล้ว");
  expect((await caseState(outModel)).consignment.sale_id).toBeNull();

  await outRow.getByRole("button", { name: "รับเงิน" }).click();
  await page.getByRole("button", { name: "ยืนยันรับเงินเต็มยอด" }).click();
  await expect(outRow).toContainText("รับเงินแล้ว");
  await assertSale(outModel, 1300, 1000);

  await page.locator('[data-testid="consignments-tab-in"]').click();
  await fillOpenForm(page, inImei, "1500", inModel);
  await page.locator('[data-testid="consignment-open-submit"]').click();
  const inRow = page.getByRole("row", { name: new RegExp(inModel) });
  await expect(inRow).toContainText("ฝากอยู่");
  expect((await caseState(inModel)).consignment.sale_id).toBeNull();

  await inRow.getByRole("button", { name: "ขายหน้าร้าน" }).click();
  await page.getByLabel("ราคาที่ขายจริง").fill("1500");
  await page.getByLabel("ยอดที่ต้องจ่ายเจ้าของเครื่อง").fill("1200");
  await page.getByRole("button", { name: "ยืนยันขายและรับเงินลูกค้า" }).click();
  await expect(inRow).toContainText("รอจ่ายเจ้าของ");
  await assertSale(inModel, 1500, 1200);

  await inRow.getByRole("button", { name: "จ่ายเจ้าของ" }).click();
  await page.getByRole("button", { name: "ยืนยันจ่ายเจ้าของเครื่อง" }).click();
  await expect(inRow).toContainText("จ่ายเจ้าของแล้ว");
});

test("outgoing and incoming consignment returns restore custody once", async ({ page }) => {
  test.setTimeout(120_000);
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase test credentials");
  const staffApi = createClient(url, anonKey);
  const auth = await staffApi.auth.signInWithPassword({ email: "staff@ucom.local", password: "123456" });
  if (auth.error) throw auth.error;
  await loginAs(page, "staff");

  const outImei = `${Date.now()}3`.slice(0, 15);
  await page.goto("/stock");
  await page.locator('[data-testid="stock-kind-device"]').click();
  await page.locator('[data-testid="open-add-device"]').click();
  await page.locator('[data-testid="add-device-imei"]').fill(outImei);
  await page.locator('[data-testid="add-device-model"]').fill(outReturnModel);
  await page.locator('[data-testid="add-device-price"]').fill("1200");
  await page.locator('[data-testid="add-device-cost"]').fill("800");
  await page.locator('[data-testid="add-device-submit"]').click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto("/consignments");
  await fillOpenForm(page, outImei, "1200");
  await page.locator('[data-testid="consignment-open-submit"]').click();
  const outRow = page.getByRole("row", { name: new RegExp(outReturnModel) });
  await expect(outRow).toContainText("ฝากอยู่");
  const outCase = (await caseState(outReturnModel)).consignment;
  await outRow.getByRole("button", { name: "คืนเครื่อง" }).click();
  await page.getByRole("button", { name: "ยืนยันคืนเครื่อง" }).click();
  await expect(outRow).toContainText("คืนเครื่องแล้ว");
  const returnedOut = await caseState(outReturnModel);
  expect(returnedOut.device.status).toBe("in_stock");
  expect(returnedOut.consignment.status).toBe("returned");
  expect(returnedOut.consignment.sale_id).toBeNull();
  const duplicateOut = await staffApi.rpc("rpc_consignment_return", { p_id: outCase.id });
  expect(duplicateOut.error?.message).toContain("คืนได้เฉพาะเครื่องที่ยังฝากอยู่");

  await page.locator('[data-testid="consignments-tab-in"]').click();
  const inImei = `${Date.now()}4`.slice(0, 15);
  await fillOpenForm(page, inImei, "1100", inReturnModel);
  await page.locator('[data-testid="consignment-open-submit"]').click();
  const inRow = page.getByRole("row", { name: new RegExp(inReturnModel) });
  await expect(inRow).toContainText("ฝากอยู่");
  const inCase = (await caseState(inReturnModel)).consignment;
  await inRow.getByRole("button", { name: "คืนเครื่อง" }).click();
  await page.getByRole("button", { name: "ยืนยันคืนเครื่อง" }).click();
  await expect(inRow).toContainText("คืนเครื่องแล้ว");
  const returnedIn = await caseState(inReturnModel);
  expect(returnedIn.device.status).toBe("returned");
  expect(returnedIn.consignment.status).toBe("returned");
  expect(returnedIn.consignment.sale_id).toBeNull();
  const duplicateIn = await staffApi.rpc("rpc_consignment_return", { p_id: inCase.id });
  expect(duplicateIn.error?.message).toContain("คืนได้เฉพาะเครื่องที่ยังฝากอยู่");
});
