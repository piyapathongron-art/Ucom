import assert from "node:assert/strict";
import { billLabel, changeText, channelOf, salesByChannel, topProducts } from "./summary.ts";
import { previousRange, weekStartOf } from "./types.ts";

assert.equal(channelOf("cash", null), "เงินสด");
assert.equal(channelOf("transfer", "KBank"), "โอนเงิน");
assert.equal(channelOf("transfer", "ไทยช่วยไทย"), "ไทยช่วยไทย");

const split = salesByChannel(
  [
    { ref_id: "a", detail: "cash", sale_revenue: 100 },
    { ref_id: "b", detail: "transfer", sale_revenue: 250 },
    { ref_id: "c", detail: "transfer", sale_revenue: 2000 },
    { ref_id: "d", detail: "cash", sale_revenue: -50 },
  ],
  [{ id: "b", receiving_account: "KBank" }, { id: "c", receiving_account: "ไทยช่วยไทย" }],
);
assert.deepEqual(split, [
  { channel: "เงินสด", amount: 50 },
  { channel: "โอนเงิน", amount: 250 },
  { channel: "ไทยช่วยไทย", amount: 2000 },
]);
assert.equal(split.reduce((s, c) => s + c.amount, 0), 2300);

assert.deepEqual(
  topProducts([
    { product_id: "p1", name_snapshot: "ฟิล์ม", qty: 2 },
    { product_id: "p2", name_snapshot: "เคส", qty: 1 },
    { product_id: "p1", name_snapshot: "ฟิล์ม", qty: 3 },
    { product_id: "p3", name_snapshot: "สาย", qty: 1 },
  ], 2),
  [{ name: "ฟิล์ม", qty: 5 }, { name: "เคส", qty: 1 }],
);

// previous period = same length, ending the day before
assert.deepEqual(previousRange("2026-09-29", "2026-09-29"), { from: "2026-09-28", to: "2026-09-28" });
assert.deepEqual(previousRange("2026-09-01", "2026-09-29"), { from: "2026-08-03", to: "2026-08-31" });
assert.deepEqual(previousRange("2026-01-01", "2026-01-07"), { from: "2025-12-25", to: "2025-12-31" });
assert.equal(weekStartOf("2026-09-29"), "2026-09-28");
assert.equal(weekStartOf("2026-09-28"), "2026-09-28");
assert.equal(weekStartOf("2026-10-04"), "2026-09-28");

assert.equal(changeText(100, null, true), null);
assert.equal(changeText(100, 0, true), null);
assert.deepEqual(changeText(112, 100, true), { text: "+12% จากเมื่อวาน", isUp: true });
assert.deepEqual(changeText(50, 100, false), { text: "−50% จากช่วงก่อนหน้า", isUp: false });
assert.deepEqual(changeText(100, 100, false), { text: "+0% จากช่วงก่อนหน้า", isUp: true });

assert.deepEqual(changeText(90000, 100, false), { text: "+999%+ จากช่วงก่อนหน้า", isUp: true });

assert.equal(billLabel(92), "#0092");
assert.equal(billLabel(1093), "#1093");
assert.equal(billLabel(12345), "#12345");
assert.equal(billLabel(null), "-");

console.log("summary.check ok");
