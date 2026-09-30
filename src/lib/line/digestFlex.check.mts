import assert from "node:assert/strict";
import { digestFlex, type DigestData } from "./digestFlex.ts";

const sheet: DigestData = {
  date: "2026-09-28", closedBy: "พนักงาน", closedAt: "2026-09-28T13:14:00Z", createdAt: "2026-09-28T13:14:00Z",
  countedCash: 3750, salesTotal: 5480, toSend: 3750,
  salesLines: [{ name: "ขายหน้าร้าน", amount: 2000, isRepair: false }, { name: "ค่าซ่อม", amount: 850, isRepair: true }],
  devices: [{ model: "iPhone", imeiLast4: "1234", amount: 900 }],
  sims: [{ carrier: "AIS", sold: 3, free: 0, stockLeft: 16, amount: 150 }, { carrier: "True", sold: 1, free: 0, stockLeft: 23, amount: 50 }],
  topups: [
    { carrier: "AIS", sold: 1050, walletBalance: 1547, entered: 4000, amount: 1050 },
    { carrier: "Dtac", sold: 250, walletBalance: 2746, entered: 0, amount: 250 },
    { carrier: "True", sold: 230, walletBalance: 4402, entered: 0, amount: 230 },
  ],
  receipts: { cash: 5180, transfer: 0, thaiChuaiThai: 300 },
  cashOutLines: [
    { label: "ไอติม", amount: 250 }, { label: "ฟิล์มกล้อง", amount: 50 },
    { label: "อะไหล่ · งานซ่อม A", amount: 950 }, { label: "อะไหล่ · งานซ่อม B", amount: 180 },
  ],
  repairsClosed: 2, sfReleased: 1,
};

assert.equal(sheet.receipts.cash - sheet.cashOutLines.reduce((sum, item) => sum + item.amount, 0), 3750);
assert.equal(sheet.toSend, 3750);
assert.equal(sheet.salesLines.reduce((sum, item) => sum + item.amount, 0) + sheet.devices[0].amount + sheet.sims.reduce((sum, item) => sum + item.amount, 0) + sheet.topups.reduce((sum, item) => sum + item.amount, 0), 5480);

const message = digestFlex(sheet, "https://pos.example.com");
const body = JSON.stringify(message.contents);
assert.equal(message.altText, "ปิดร้าน 28 ก.ย. · ขาย ฿5,480 · ส่ง ฿3,750 · ตรง");
assert.match(body, /ปิดร้าน จ\. 28 ก\.ย\. 69/);
assert.match(body, /ปิดโดย พนักงาน · 20:14/);
assert.match(body, /ยอดที่ต้องส่ง \(เงินสด\)/);
assert.match(body, /"text":"3 · 0 · 16"/);
assert.match(body, /"text":"1,050 · 1,547"/);
assert.match(body, /"text":"รวม"/);
assert.match(body, /เติมเข้า \+4,000/);
assert.match(body, /อะไหล่ · งานซ่อม A/);
assert.match(body, /https:\/\/pos\.example\.com\/close-day\?date=2026-09-28/);
assert.doesNotMatch(body, /ต้นทุน|กำไร|part_cost|profit/);

assert.match(JSON.stringify(digestFlex({ ...sheet, closedAt: "2026-09-28T13:15:00Z" }, "https://pos.example.com").contents), /แก้ไข/);
assert.match(JSON.stringify(digestFlex(sheet, "https://pos.example.com", true).contents), /ส่งซ้ำ/);
assert.equal(digestFlex({ ...sheet, countedCash: 3700 }, "https://pos.example.com").altText.endsWith("ขาด ฿50"), true);
assert.equal(digestFlex({ ...sheet, countedCash: 3770 }, "https://pos.example.com").altText.endsWith("เกิน ฿20"), true);

const longList = Array.from({ length: 12 }, (_, index) => ({ name: `รายการ ${index}`, amount: 12 - index, isRepair: false }));
const overflow = JSON.stringify(digestFlex({ ...sheet, salesLines: longList, devices: [], sims: [] }, "https://pos.example.com").contents);
assert.match(overflow, /\+ อีก 2 รายการ ฿3/);
assert.doesNotMatch(overflow, /รายการ 10|รายการ 11|"text":"เครื่อง"|"text":"ซิม/);

// Full-coverage day: free SIM, consignment payout, off-bill income, null wallet — the card must let a
// reader reproduce cash-to-send from what it shows: cash + off-bill income - cash out.
const full: DigestData = {
  ...sheet, toSend: 5180 + 200 - 1730, countedCash: 3650, cashIncome: 200,
  sims: [{ carrier: "AIS", sold: 3, free: 2, stockLeft: 14, amount: 150 }],
  topups: [{ carrier: "Dtac", sold: 100, walletBalance: null, entered: 0, amount: 100 }],
  cashOutLines: [...sheet.cashOutLines, { label: "จ่ายเจ้าของเครื่องฝากเข้า", amount: 300 }],
};
assert.equal(full.receipts.cash + (full.cashIncome ?? 0) - full.cashOutLines.reduce((total, item) => total + item.amount, 0), full.toSend);
const fullBody = JSON.stringify(digestFlex(full, "https://pos.example.com").contents);
assert.match(fullBody, /"text":"3 · 2 · 14"/);
assert.match(fullBody, /"text":"100 · —"/);
assert.match(fullBody, /รายรับนอกบิล \(เงินสด\)/);
assert.match(fullBody, /จ่ายเจ้าของเครื่องฝากเข้า/);
assert.doesNotMatch(JSON.stringify(digestFlex({ ...sheet, cashIncome: 0 }, "https://pos.example.com").contents), /รายรับนอกบิล/);
assert.doesNotMatch(JSON.stringify(digestFlex({ ...sheet, receipts: { cash: 0, transfer: 0, thaiChuaiThai: 0 } }, "https://pos.example.com").contents), /"text":"รับเงินทาง"/);
// stock-only SIM rows (nothing sold) show no "รวม 0" line
const stockOnly = JSON.stringify(digestFlex({ ...sheet, sims: [{ carrier: "AIS", sold: 0, free: 0, stockLeft: 2, amount: 0 }], devices: [], topups: [], salesLines: [], cashOutLines: [] }, "https://pos.example.com").contents);
assert.match(stockOnly, /"text":"0 · 0 · 2"/);
assert.equal((stockOnly.match(/"text":"รวม"/g) ?? []).length, 0);
console.log("digestFlex.check ok");
