import assert from "node:assert/strict";
import { findDuplicateRows, rowMessages } from "./sfDuplicates.ts";

assert.deepEqual([...findDuplicateRows(["111", " 111 ", "222", "", ""])].sort(), [0, 1]);
assert.equal(findDuplicateRows(["", ""]).size, 0);
assert.deepEqual(rowMessages(["111", "222", "222"], new Set(["111"])), {
  0: "IMEI นี้มีอยู่ในระบบแล้ว",
  1: "IMEI ซ้ำกับแถวอื่นในบิลนี้",
  2: "IMEI ซ้ำกับแถวอื่นในบิลนี้",
});
console.log("sfDuplicates.check ok");

const { positivePrice, sfRowProblem } = await import("./sfDuplicates.ts");
const row = (over: Record<string, unknown> = {}) => ({ id: "", imei: "3540", model: "A55", list: "13990", sale: "", locked: false, ...over });
assert.equal(positivePrice("13990"), 13990);
assert.equal(positivePrice("13990.50"), 13990.5);
for (const bad of ["", "0", "13,990", "abc", "-5", "1e3"]) assert.equal(positivePrice(bad), null, bad);
assert.equal(sfRowProblem(row()), null);
assert.equal(sfRowProblem(row({ imei: "", model: "", list: "" })), null, "untouched new row is skipped");
assert.equal(sfRowProblem(row({ id: "x", imei: "", model: "", list: "", sale: "" })), "ต้องมี IMEI และรุ่นเครื่อง หรือกด × เพื่อลบเครื่องนี้");
assert.equal(sfRowProblem(row({ list: "0" })), "ราคาป้าย SF ต้องเป็นตัวเลขมากกว่า 0");
assert.equal(sfRowProblem(row({ list: "13,990" })), "ราคาป้าย SF ต้องเป็นตัวเลขมากกว่า 0");
assert.equal(sfRowProblem(row({ sale: "0" })), "ราคาขายต้องเป็นตัวเลขมากกว่า 0 หรือเว้นว่าง");
assert.equal(sfRowProblem(row({ list: "0", locked: true })), null);
console.log("sfRowProblem.check ok");
