import type { Json } from "../types/database";

export const CASH_OPERATION_KEY = "ucom-cash-operation-v2:";
export const CASH_OPERATION_EVENT = "ucom-cash-operation-change";
export type CashIntent = { storageVersion: 2; id: string; actorId: string | null; epoch: string | null; action: string; payload: Json; status: "unresolved" };
export type CashInvestigation = { key: string; intent: CashIntent | null; reason: string };
export const canonicalIntent = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalIntent).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalIntent(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
};
export function validatesCashProof(proof: unknown, intent: Pick<CashIntent, "id" | "actorId" | "epoch" | "action" | "payload">, result?: unknown): boolean {
  if (!proof || typeof proof !== "object" || Array.isArray(proof)) return false;
  const record = proof as Record<string, unknown>;
  return Boolean(intent.actorId && record.operationId === intent.id && record.actorId === intent.actorId && record.epoch === intent.epoch
    && record.action === intent.action && canonicalIntent(record.payload) === canonicalIntent(intent.payload)
    && (result === undefined || canonicalIntent(record.result) === canonicalIntent(result)));
}
export function parseCashIntent(raw: string | null, key: string): CashIntent | null {
  try {
    const value = JSON.parse(raw ?? "null");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!value || value.storageVersion !== 2 || value.status !== "unresolved" || typeof value.id !== "string" || !uuid.test(value.id)
      || key !== CASH_OPERATION_KEY + value.id || (value.actorId !== null && typeof value.actorId !== "string")
      || (value.actorId !== null && !uuid.test(value.actorId)) || (value.epoch !== null && !uuid.test(value.epoch))
      || !["open", "handover", "handover_days", "return", "settle", "review", "evidence", "adjust", "correct", "reminder"].includes(value.action)
      || !value.payload || typeof value.payload !== "object" || Array.isArray(value.payload)) return null;
    return value;
  } catch { return null; }
}
export function importLegacyOperations(storage: Storage, legacy: Storage): void {
  for (let i = 0; i < legacy.length; i++) {
    const key = legacy.key(i);
    if (!key?.startsWith("ucom.cash.operation.v1.")) continue;
    const raw = legacy.getItem(key);
    const target = CASH_OPERATION_KEY + "legacy-" + key;
    try {
      const value = JSON.parse(raw ?? "null");
      if (!value || typeof value.id !== "string" || !("epoch" in value) || !("payload" in value)) throw new Error("invalid");
      const action = key.slice("ucom.cash.operation.v1.".length).split(".")[0];
      const intent: CashIntent = { storageVersion: 2, id: value.id, actorId: null, epoch: value.epoch, action, payload: value.payload, status: "unresolved" };
      const existing = storage.getItem(CASH_OPERATION_KEY + intent.id);
      const previous = parseCashIntent(existing, CASH_OPERATION_KEY + intent.id);
      if (existing && (!previous || previous.epoch !== intent.epoch || previous.action !== intent.action || canonicalIntent(previous.payload) !== canonicalIntent(intent.payload))) storage.setItem(target, raw ?? "null");
      else if (!existing) storage.setItem(CASH_OPERATION_KEY + intent.id, JSON.stringify(intent));
    } catch { storage.setItem(target, raw ?? "null"); }
  }
}
export function scanCashOperations(storage: Storage): CashInvestigation[] {
  const result: CashInvestigation[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(CASH_OPERATION_KEY)) continue;
      const intent = parseCashIntent(storage.getItem(key), key);
      result.push({ key, intent, reason: !intent ? "อ่านรายการเดิมไม่ได้ ต้องตรวจสอบ" : !intent.actorId ? "รายการเก่ายังไม่ยืนยันเจ้าของคำขอ" : "รายการเดิมรอยืนยันผล" });
    }
  } catch { result.push({ key: "storage-unreadable", intent: null, reason: "อ่านที่เก็บรายการไม่ได้ ห้ามทำรายการใหม่" }); }
  return result;
}
export function refreshCashOperations(): CashInvestigation[] {
  try { importLegacyOperations(localStorage, sessionStorage); return scanCashOperations(localStorage); }
  catch { return [{ key: "storage-unreadable", intent: null, reason: "อ่านที่เก็บรายการไม่ได้ ห้ามทำรายการใหม่" }]; }
}
export function saveCashIntent(intent: CashIntent): void {
  const key = CASH_OPERATION_KEY + intent.id;
  const raw = JSON.stringify(intent);
  localStorage.setItem(key, raw);
  if (localStorage.getItem(key) !== raw) throw new Error("เก็บรายการเดิมไม่สำเร็จ ยังไม่ได้ส่งรายการ");
  window.dispatchEvent(new Event(CASH_OPERATION_EVENT));
}
export function assertStoredCashIntent(intent: CashIntent): void {
  const key = CASH_OPERATION_KEY + intent.id;
  if (canonicalIntent(parseCashIntent(localStorage.getItem(key), key)) !== canonicalIntent(intent)) throw new Error("รายการเดิมในเครื่องเปลี่ยนหรืออ่านไม่ได้ ต้องตรวจสอบก่อนส่ง");
}
export function clearCashIntent(intent: CashIntent): void {
  const key = CASH_OPERATION_KEY + intent.id;
  assertStoredCashIntent(intent);
  retireLegacyCashIntent(sessionStorage, intent);
  localStorage.removeItem(key);
  window.dispatchEvent(new Event(CASH_OPERATION_EVENT));
}
export function retireLegacyCashIntent(legacyStorage: Storage, intent: CashIntent): void {
  for (let i = legacyStorage.length - 1; i >= 0; i--) {
    const legacyKey = legacyStorage.key(i);
    if (!legacyKey?.startsWith("ucom.cash.operation.v1.")) continue;
    try {
      const legacy = JSON.parse(legacyStorage.getItem(legacyKey) ?? "null");
      if (legacy?.id === intent.id && legacy.epoch === intent.epoch && canonicalIntent(legacy.payload) === canonicalIntent(intent.payload)
        && legacyKey.slice("ucom.cash.operation.v1.".length).split(".")[0] === intent.action) legacyStorage.removeItem(legacyKey);
    } catch { /* Unknown legacy entries remain blocked for investigation. */ }
  }
}
export async function withCashOperationLock<T>(id: string | null, work: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) throw new Error("เบราว์เซอร์นี้ล็อกรายการเงินไม่ได้ กรุณาใช้เบราว์เซอร์ที่รองรับ");
  return navigator.locks.request("ucom-cash-receiving-v1", () => navigator.locks.request(id ? `ucom-cash-operation:${id}` : "ucom-cash-operation-creation-v2", work));
}
