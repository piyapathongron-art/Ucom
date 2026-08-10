import type { Page } from "@playwright/test";

// Login takes the bare username, NOT an email: usernameToEmail() in login/actions.ts
// appends @ucom.local server-side. Filling "staff@ucom.local" here fails every test.
export async function loginAs(page: Page, username: "staff" | "admin") {
  await page.goto("/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

// Every Thai string the repair specs need, written once here so specs stay ASCII.
export const TH = {
  statusPending: "รอซ่อม",
  statusInProgress: "กำลังซ่อม",
  statusReady: "รอรับเครื่อง",
  statusCollected: "รับแล้ว",
  statusAbandoned: "ลูกค้าทิ้ง",
  partCostEntered: "กรอกแล้ว",
  pageHeading: "งานซ่อม",
} as const;

// Repeated runs hit prod, so every row this suite creates must be findable and must not
// collide with a leftover from an earlier run.
export function uniqueCustomer(): string {
  return "ZZTEST-customer-" + Date.now();
}

export function uniqueDevice(): string {
  return "ZZTEST-device-" + Date.now();
}

// The row testids are keyed by job uuid, which the spec does not know up front. Find the
// row by the customer name it just typed, then read the uuid back off the row element.
export async function findJobIdByCustomer(
  page: Page,
  customerName: string,
): Promise<string> {
  const cell = page
    .locator('[data-testid^="repair-customer-"]')
    .filter({ hasText: customerName })
    .first();
  await cell.waitFor({ state: "visible", timeout: 15000 });
  const testId = await cell.getAttribute("data-testid");
  if (!testId) throw new Error("row for " + customerName + " has no data-testid");
  return testId.replace("repair-customer-", "");
}
