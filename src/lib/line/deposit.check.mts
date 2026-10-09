import assert from "node:assert/strict";
import { cashMessages, type DepositSnapshot } from "./cashFlex.ts";
import { cashPartRetryKey, pushCashSnapshot } from "./push.ts";

const id = "123e4567-e89b-42d3-a456-426614174000";
const snapshot: DepositSnapshot = {
  id, eventOperationId: id, handoverId: id, event: "review", state: "confirmed", asOf: "2026-10-09T03:00:00Z", version: 8,
  drawer: "57.00", pending: "6400.00", reserved: "0.00", available: "6400.00", reporterName: "F", custodian: "F",
  selectedTotal: "16457.00", drawerBeforeDeparture: "57.00", bankBound: "16400.00",
  selectedLines: Array.from({ length: 110 }, (_, index) => ({ key: `day:${index}`, receiptDay: index === 0 ? null : index % 2 ? "2025-12-31" : "2026-01-01", kind: index === 0 ? "opening" as const : "date" as const, amount: `${index}.00` })),
  deposit: { bank: "16400.00", drawer: "0.00", returned: "0.00", custodian: "F", depositedAt: "2026-10-09T02:00:00Z" },
};
const frozen = JSON.stringify(snapshot);
const messages = cashMessages(snapshot, "https://ucom.example");
assert.equal(messages.length, 5);
const dayTexts = messages.flatMap(part => part.contents.body.contents).flatMap(row => "text" in row && typeof row.text === "string" && /^(\d{2}\/\d{2}\/\d{4}|ยอดตั้งต้นไม่ทราบวัน):/.test(row.text) ? [row.text] : []);
assert.equal(dayTexts.length, 110);
assert.deepEqual(dayTexts.map(text => text.split(": ")[1]), snapshot.selectedLines!.map(line => `${line.amount} บาท`));
for (const part of messages) {
  const text = JSON.stringify(part);
  assert.ok(Buffer.byteLength(JSON.stringify(part.contents)) <= 30000);
  assert.ok(part.altText.length <= 400);
  assert.ok(text.includes(id)); assert.ok(text.includes("เจ้าของยืนยันแล้ว")); assert.ok(!text.includes("รอเจ้าของตรวจหลักฐาน"));
  assert.ok(text.includes("31/12/2025 – 01/01/2026 · รวมยอดไม่ทราบวัน"));
  assert.ok(text.includes("เศษคืนเข้าเก๊ะเพิ่มเติมหลังนำออก")); assert.ok(text.includes("handover="));
  assert.ok(!text.includes("evidencePath"));
}
assert.ok(JSON.stringify(messages).includes("31/12/2025")); assert.ok(JSON.stringify(messages).includes("01/01/2026"));
assert.equal(JSON.stringify(snapshot), frozen);
assert.ok(JSON.stringify(cashMessages({ ...snapshot, selectedLines: [{ key: "unknown", receiptDay: null, kind: "reconciliation", amount: "57" }] }, "https://ucom.example")).includes("ไม่ทราบวันทั้งหมด"));
for (const [state, label] of [["disputed", "หลักฐานต้องแก้ไข"], ["returned", "คืนเงินนำฝากแล้ว"], ["reported", "รอเจ้าของตรวจหลักฐาน"]]) assert.ok(JSON.stringify(cashMessages({ ...snapshot, state }, "https://ucom.example")).includes(label));
assert.throws(() => cashMessages({ ...snapshot, custodian: "ย".repeat(20000) }, "https://ucom.example"), /limits/);
assert.notEqual(cashPartRetryKey(id, 0), cashPartRetryKey(id, 1));
assert.match(cashPartRetryKey(id, 0), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
process.env.LINE_APP_URL = "https://ucom.example"; process.env.LINE_CHANNEL_ACCESS_TOKEN = "mock"; process.env.LINE_GROUP_ID = "Cmock";
const oldFetch = globalThis.fetch;
const calls: { body: string; key: string }[] = [];
globalThis.fetch = async (_url, options) => {
  calls.push({ body: String(options?.body), key: new Headers(options?.headers).get("X-Line-Retry-Key") ?? "" });
  return new Response(null, { status: 409, headers: { "x-line-accepted-request-id": "accepted" } });
};
try {
  assert.equal(await pushCashSnapshot(snapshot, "first"), true);
  const first = calls.splice(0);
  assert.equal(await pushCashSnapshot(snapshot, "different resend title", true), true);
  assert.deepEqual(calls, first);
  for (const call of first) assert.equal(JSON.parse(call.body).messages.length, 1);
  globalThis.fetch = async () => new Response(null, { status: 409 });
  assert.equal(await pushCashSnapshot(snapshot), false);
  globalThis.fetch = async () => { throw new Error("network"); };
  assert.equal(await pushCashSnapshot(snapshot), false);
} finally { globalThis.fetch = oldFetch; }
console.log("deposit LINE split, snapshot, retry and mocked-send checks passed");
