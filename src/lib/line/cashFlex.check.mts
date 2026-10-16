import assert from "node:assert/strict";
import { cashFlex } from "./cashFlex.ts";
import { safeReturnPath } from "../safe-return.ts";

for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "/login?next=/cash", "/login/", "/api", "/api/line/webhook", "/cash\n"]) assert.equal(safeReturnPath(path), "/");
assert.equal(safeReturnPath("/cash?handover=abc"), "/cash?handover=abc");
const snapshot = { id: "original", date: "2026-10-07", revision: 1, asOf: "2026-10-07T03:00:00Z", version: 1, drawer: "57.00", pending: "6400.00", reserved: "0.00", available: "6400.00", drawerCount: "57.00", pendingCount: "6400.00", drawerVariance: "0.00", pendingVariance: "0.00", daily: null };
const message = cashFlex(snapshot, "https://ucom.example", "ฝากเงิน", true);
const serialized = JSON.stringify(message);
assert.ok(serialized.includes("57.00"));
assert.ok(serialized.includes("6400.00"));
assert.ok(serialized.includes("ส่งซ้ำ"));
assert.ok(serialized.includes("https://ucom.example/cash"));
assert.ok(!serialized.includes("evidencePath"));
assert.equal(snapshot.drawer, "57.00");
const depositMessage = cashFlex({ ...snapshot, deposit: { bank: "16400.00", drawer: "57.00", returned: "0.00", custodian: "พนักงาน", depositedAt: snapshot.asOf } }, "https://ucom.example", "ฝากเงิน");
assert.ok(JSON.stringify(depositMessage).includes("ฝากธนาคารจริง: 16400.00"));
const daily = {
  date: snapshot.date, closedBy: "LOCAL STAFF", closedAt: snapshot.asOf, createdAt: snapshot.asOf,
  countedCash: 16457, salesTotal: 100, toSend: 16457,
  salesLines: [{ name: "ขายสินค้า", amount: 100, isRepair: false }],
  devices: [{ model: "เครื่องทดสอบ", imeiLast4: "1234", amount: 100 }],
  sims: [{ carrier: "AIS", sold: 1, free: 0, stockLeft: 2, amount: 50 }],
  topups: [{ carrier: "TRUE", sold: 1, walletBalance: 500, entered: 0, amount: 50 }],
  receipts: { cash: 100, transfer: 0, thaiChuaiThai: 0 }, cashOutLines: [{ label: "ค่าเดินทาง", amount: 20 }], repairsClosed: 1, sfReleased: 0,
};
const closeMessage = JSON.stringify(cashFlex({ ...snapshot, daily }, "https://ucom.example", "ปิดร้าน"));
for (const label of ["รายการขาย", "เครื่องทดสอบ", "ซิม", "เติมเงิน", "รับเงินทาง", "รายจ่ายเงินสดวันนี้ (ทุกกอง)", "ค่าเดินทาง", "งานซ่อมเสร็จ"]) assert.ok(closeMessage.includes(label), label);
for (const oldLabel of ["ยอดที่ต้องส่ง (เงินสด)", "นับได้จริง", "เงินออกจากลิ้นชัก"]) assert.ok(!closeMessage.includes(oldLabel), oldLabel);
assert.ok(JSON.stringify(cashFlex({ ...snapshot, drawerVariance: "-20.00", note: "ทอนเกินให้ลูกค้า" }, "https://ucom.example", "ปิดร้าน")).includes("หมายเหตุ: ทอนเกินให้ลูกค้า"));
assert.ok(!JSON.stringify(cashFlex(snapshot, "https://ucom.example", "ปิดร้าน")).includes("หมายเหตุ:"));
console.log("cash LINE snapshot and safe login destination checks passed");
