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
