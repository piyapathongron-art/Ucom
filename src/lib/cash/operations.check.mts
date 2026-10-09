import assert from "node:assert/strict";
import { CASH_OPERATION_KEY, canonicalIntent, importLegacyOperations, parseCashIntent, scanCashOperations, retireLegacyCashIntent, validatesCashProof, withCashOperationLock, saveCashIntent } from "./operations.ts";
import { selectionAmounts } from "./day-selection.ts";
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const id = "10000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000001";
const storage = new MemoryStorage(), legacy = new MemoryStorage();
const payload = { bank: "1200.00", handoverId: id };
legacy.setItem(`ucom.cash.operation.v1.settle.${id}`, JSON.stringify({ id, epoch: id, payload }));
importLegacyOperations(storage, legacy);
assert.equal(scanCashOperations(storage)[0].intent?.actorId, null, "legacy ownership cannot be guessed");
const bound = { ...scanCashOperations(storage)[0].intent!, actorId };
storage.setItem(CASH_OPERATION_KEY + id, JSON.stringify(bound));
importLegacyOperations(storage, legacy);
assert.equal(scanCashOperations(storage).length, 1, "verified legacy ownership survives refresh without conflict sentinel");
assert.equal(scanCashOperations(storage)[0].intent?.actorId, actorId);
retireLegacyCashIntent(legacy, bound);
storage.removeItem(CASH_OPERATION_KEY + id);
importLegacyOperations(storage, legacy);
assert.equal(scanCashOperations(storage).length, 0, "validated success cannot re-import retired original session request");
const entityId = "30000000-0000-4000-8000-000000000001";
const result = { id: entityId, snapshot: { eventOperationId: id } };
const proof = { operationId: id, actorId, epoch: id, action: "settle", payload, result };
assert.equal(validatesCashProof(proof, bound, result), true, "settlement entity UUID differs from operation UUID");
assert.equal(validatesCashProof({ ...proof, actorId: entityId }, bound, result), false);
assert.equal(validatesCashProof({ ...proof, operationId: entityId }, bound, result), false);
assert.equal(validatesCashProof(proof, bound, { ...result, id }), false, "mismatched server result cannot clear intent");
storage.setItem(CASH_OPERATION_KEY + "corrupt", "broken");
assert.equal(scanCashOperations(storage)[0].intent, null, "corrupt requests remain visible blockers");
assert.equal(parseCashIntent(JSON.stringify({ ...bound, id: "invalid" }), CASH_OPERATION_KEY + "invalid"), null);
assert.equal(canonicalIntent({ b: 2, a: 1 }), canonicalIntent({ a: 1, b: 2 }));
assert.notEqual(canonicalIntent(payload), canonicalIntent({ ...payload, bank: "1300.00" }));
const lines = [{ key: "date:2026-10-01", receiptDay: "2026-10-01", kind: "date" as const, available: "1000.01", reserved: "20" }, { key: "opening:x", receiptDay: null, kind: "opening" as const, available: "57.02", reserved: "0" }];
assert.deepEqual(selectionAmounts(lines, lines.map(line => line.key), "57.03"), { selectedTotal: "1057.03", bankBound: "1000.00", lines: [{ key: lines[0].key, amount: "1000.01" }, { key: lines[1].key, amount: "57.02" }] });
assert.throws(() => selectionAmounts(lines, [lines[0].key, lines[0].key], "0"));
assert.throws(() => selectionAmounts(lines, [lines[0].key], "1000.01"));
assert.throws(() => selectionAmounts([{ ...lines[0], available: "0", reserved: "100" }], [lines[0].key], "0"));
const lockOrder: string[] = [];
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: { request: async (name: string, work: () => Promise<unknown>) => { lockOrder.push(name); return work(); } } } });
await withCashOperationLock(id, async () => { lockOrder.push("dispatch"); });
assert.deepEqual(lockOrder, ["ucom-cash-receiving-v1", `ucom-cash-operation:${id}`, "dispatch"]);
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
await assert.rejects(withCashOperationLock(id, async () => { throw new Error("must never dispatch"); }), /ล็อกรายการเงินไม่ได้/);
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => { throw new Error("storage disabled"); } } });
let isDispatched = false;
assert.throws(() => { saveCashIntent(bound); isDispatched = true; }, /storage disabled/);
assert.equal(isDispatched, false, "storage failure prevents financial dispatch");
const unreadable = new MemoryStorage(); unreadable.setItem("x", "x"); unreadable.key = () => { throw new Error("blocked"); };
assert.equal(scanCashOperations(unreadable)[0].key, "storage-unreadable");
console.log("cash durable intent and exact day selection checks passed");
