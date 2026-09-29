import assert from "node:assert/strict";
import { isScannerBurst } from "./useBarcodeScanner.ts";

assert.equal(isScannerBurst("4712389914354", 20), true);
assert.equal(isScannerBurst("4712389914354", 51), false);
assert.equal(isScannerBurst("12345", 20), false);
