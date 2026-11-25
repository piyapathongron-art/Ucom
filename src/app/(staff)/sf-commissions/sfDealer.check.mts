import assert from "node:assert/strict";
import { balanceAsOf, dealerEntryProblem, statementDifference } from "./sfDealer.ts";

const lines = [
  { kind: "invoice", entry_date: "2026-11-01", debt_change: 15000, voided_at: null },
  { kind: "credit_financed", entry_date: "2026-11-03", debt_change: -10000, voided_at: null },
  { kind: "payment", entry_date: "2026-11-05", debt_change: -6000, voided_at: "2026-11-06T00:00:00Z" },
  { kind: "invoice", entry_date: "2026-11-10", debt_change: 8000, voided_at: null },
  { kind: "adjustment", entry_date: "2026-11-12", debt_change: -0.1, voided_at: null },
];

assert.equal(balanceAsOf(lines, "2026-11-04"), 5000);
assert.equal(balanceAsOf(lines, "2026-11-30"), 12999.9, "voided payment ignored; cents add up exactly");
assert.equal(statementDifference(lines, "2026-11-30", "12,999.90"), 0);
assert.equal(statementDifference(lines, "2026-11-04", "20707"), 15707);
assert.equal(statementDifference(lines, "2026-11-04", "abc"), null);

const today = "2026-11-25";
assert.equal(dealerEntryProblem("payment", "6000", "", "2026-11-25", today), null);
assert.equal(dealerEntryProblem("payment", "0", "", "2026-11-25", today), "จำนวนเงินต้องมากกว่า 0");
assert.equal(dealerEntryProblem("payment", "6000", "", "2026-11-26", today), "วันที่ต้องไม่เป็นวันในอนาคต");
assert.equal(dealerEntryProblem("adjustment", "-500", "", "2026-11-25", today), "การปรับยอดต้องมีเหตุผล");
assert.equal(dealerEntryProblem("adjustment", "-500", "ยอดตั้งต้น", "2026-11-25", today), null);
assert.equal(dealerEntryProblem("credit_other", "1.234", "", "2026-11-25", today), "จำนวนเงินต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง");

console.log("✓ sfDealer.check passed");
