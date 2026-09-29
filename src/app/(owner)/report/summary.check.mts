import assert from "node:assert/strict";
import { channelOf, salesByChannel, topProducts } from "./summary.ts";

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

console.log("summary.check ok");
