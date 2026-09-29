import assert from "node:assert/strict";
import { GENERIC_ERROR, toThaiError } from "./errors.ts";

assert.equal(toThaiError({ code: "P0001", message: "ยอดเงินในวอลเล็ตไม่พอ" }), "ยอดเงินในวอลเล็ตไม่พอ");
assert.equal(toThaiError({ code: "P0001", message: "insufficient wallet" }), GENERIC_ERROR);
assert.equal(toThaiError({ code: "23505", message: "duplicate key ภาษาไทย" }), GENERIC_ERROR);
assert.equal(toThaiError(null), GENERIC_ERROR);
assert.equal(toThaiError("boom"), GENERIC_ERROR);
console.log("errors.check ok");
