import assert from "node:assert/strict";
import { moneyCents, parseMoney } from "./money.ts";

assert.equal(parseMoney("00057.1"), "57.10");
assert.equal(parseMoney("-0.00", true), "0.00");
assert.equal(moneyCents("16457.00") - moneyCents("16400"), BigInt(5700));
assert.equal(moneyCents("-57.01"), BigInt(-5701));
for (const raw of ["1.001", "1e2", "NaN", "1,000", "-1", "", "10000000000.00"]) assert.throws(() => parseMoney(raw));
console.log("cash money check ok");
