import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

const mockOpening = 1000;
const startedAt = new Date(Date.now() - 60_000).toISOString();
const attemptedCarrierIds = new Set<string>();
const saleUuids = new Set<string>();
let ownerReader: ReturnType<typeof createClient> | null = null;

function adminClient() {
  process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase test credentials");
  return createClient(url, key);
}

async function carriers() {
  const result = await adminClient().from("topup_carriers").select("id,name,commission_rate")
    .eq("is_active", true).order("name");
  if (result.error) throw result.error;
  expect(result.data?.map((row) => row.name)).toEqual(["Ais", "Dtac", "True"]);
  return result.data!;
}

async function walletBalance(carrierId: string) {
  if (!ownerReader) {
    process.loadEnvFile(".env.local");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase test credentials");
    ownerReader = createClient(url, key);
    const auth = await ownerReader.auth.signInWithPassword({ email: "admin@ucom.local", password: "123456" });
    if (auth.error) throw auth.error;
  }
  const result = await ownerReader.from("v_pos_topup_wallet_balance")
    .select("balance,is_initialized").eq("carrier_id", carrierId).single();
  if (result.error) throw result.error;
  return result.data as { balance: number | null; is_initialized: boolean };
}

async function saleState(clientUuid: string) {
  const admin = adminClient();
  const sale = await admin.from("sales").select("id").eq("client_uuid", clientUuid).single();
  if (sale.error) throw sale.error;
  const lines = await admin.from("sale_items")
    .select("kind,topup_carrier_id,unit_price,unit_cost,wallet_applied_at")
    .eq("sale_id", sale.data.id);
  if (lines.error) throw lines.error;
  expect(lines.data).toHaveLength(1);
  return { id: sale.data.id, line: lines.data![0] };
}

async function captureSaleRequests(page: Page) {
  page.on("request", (request) => {
    if (!request.url().includes("/rpc/rpc_create_sale") || request.method() !== "POST") return;
    const uuid = request.postDataJSON()?.payload?.client_uuid;
    if (typeof uuid === "string") saleUuids.add(uuid);
  });
}

test.afterAll(async () => {
  console.log("TOPUP_TEST_CLEANUP_REQUIRED", JSON.stringify({
    startedAt,
    mockOpening,
    carrierIds: [...attemptedCarrierIds],
    saleUuids: [...saleUuids],
  }));
});

// Wallet sales are immutable. Cleanup runs afterward in one guarded SQL transaction.
test("temporary wallet openings support dedicated and POS sales, then reject overdraft", async ({ browser }) => {
  test.skip(process.env.ALLOW_SHARED_SUPABASE_TOPUP_E2E !== "1", "requires an approved shared-project test run and external exact-ID cleanup");
  test.setTimeout(120_000);
  const carrierRows = await carriers();
  const admin = adminClient();
  const existing = await admin.from("topup_wallet_openings").select("carrier_id")
    .in("carrier_id", carrierRows.map((row) => row.id));
  if (existing.error) throw existing.error;
  expect(existing.data).toHaveLength(0);

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAs(owner, "admin");
  await owner.goto("/topup");
  for (const carrier of carrierRows) {
    const input = owner.getByRole("spinbutton", { name: `ยอดตั้งต้น ${carrier.name}` });
    await input.fill(String(mockOpening));
    attemptedCarrierIds.add(carrier.id);
    await input.locator("..").getByRole("button", { name: "ตั้งยอด" }).click();
    await owner.getByRole("button", { name: "ยืนยันตั้งยอด" }).click();
    await expect(input).toHaveCount(0);
    expect(Number((await walletBalance(carrier.id)).balance)).toBe(mockOpening);
  }

  const trueId = carrierRows.find((row) => row.name === "True")!.id;
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await captureSaleRequests(staff);
  await loginAs(staff, "staff");
  await staff.goto("/topup");
  await staff.getByLabel("ค่าย").selectOption(trueId);
  await staff.getByLabel("จำนวนเงินที่ลูกค้าจ่าย").fill("50");
  await staff.getByRole("button", { name: /ยืนยันขายเติมเงิน/ }).click();
  await expect(staff.getByText("ขายเติมเงินสำเร็จ")).toBeVisible();
  const firstUuid = [...saleUuids][0];
  expect(firstUuid).toBeTruthy();
  const firstSale = await saleState(firstUuid);
  expect(firstSale.line.kind).toBe("topup");
  expect(Number(firstSale.line.unit_price)).toBe(50);
  expect(Number(firstSale.line.unit_cost)).toBe(48.5);
  expect(firstSale.line.wallet_applied_at).toBeTruthy();
  expect(Number((await walletBalance(trueId)).balance)).toBe(951.5);

  await staff.goto("/pos");
  await staff.locator('[data-testid="catalog-tab-topup"]').click();
  await staff.locator('[data-testid="topup-carrier-True"]').click();
  await staff.locator('[data-testid="topup-amount"]').fill("20");
  await staff.locator('[data-testid="topup-add"]').click();
  await staff.locator('[data-testid="pay-cash"]').click();
  await staff.locator('[data-testid="bill-note"]').fill("ZZTEST-TOPUP-ACCEPTANCE");
  await staff.locator('[data-testid="checkout-submit"]').click();
  await expect(staff.locator('[data-testid="cart-lines"]')).toHaveAttribute("data-count", "0");
  expect(saleUuids.size).toBe(2);
  const secondUuid = [...saleUuids][1];
  const secondSale = await saleState(secondUuid);
  expect(Number(secondSale.line.unit_price)).toBe(20);
  expect(Number(secondSale.line.unit_cost)).toBe(19.4);
  expect(Number((await walletBalance(trueId)).balance)).toBe(932.1);

  await staff.goto("/topup");
  await staff.getByLabel("ค่าย").selectOption(trueId);
  await staff.getByLabel("จำนวนเงินที่ลูกค้าจ่าย").fill("2000");
  await staff.getByRole("button", { name: /ยืนยันขายเติมเงิน/ }).click();
  await expect(staff.getByText("ยอดวอลเล็ตค่ายนี้ไม่พอ")).toBeVisible();
  expect(Number((await walletBalance(trueId)).balance)).toBe(932.1);

  await staffContext.close();
  await ownerContext.close();
});
