import assert from "node:assert/strict";
import { cashToSend } from "./cashToSend.ts";

assert.equal(cashToSend({
  cashBills: 5180,
  cashIncome: 0,
  cashExpenses: 300,
  cashConsignmentPayouts: 0,
  cashParts: 1130,
}), 3750);
assert.equal(cashToSend({
  cashBills: 0,
  cashIncome: 400,
  cashExpenses: 0,
  cashConsignmentPayouts: 100,
  cashParts: 0,
}), 300);
console.log("cashToSend.check ok");
