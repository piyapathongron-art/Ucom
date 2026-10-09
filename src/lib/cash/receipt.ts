"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";
import { assertReceivingIntake, cashExecute, cashStatus, getReceivingDevice, getReceivingDeviceToken, isDefiniteCashError, receiptDevice } from "./client";
import { parseMoney } from "./money";
import type { CashStatus } from "./types";

type Payload = { [key: string]: Json | undefined };
export const CASH_RECEIPT_KEY = "ucom-cash-sale-v1:";
export const CASH_RECEIPT_ROUTE_KEY = "ucom-cash-receipt-route-v1:";
const sameIntent = (payload: Payload) => JSON.stringify({ ...payload, sold_at: undefined, cash_epoch: undefined, receiving_device: undefined, receiving_token: undefined });

export function prepareReceipt(draft: Payload, status: CashStatus): Payload {
  if (typeof draft.client_uuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.client_uuid)) throw new Error("ไม่พบรหัสบิล กรุณาโหลดหน้าใหม่");
  const key = CASH_RECEIPT_KEY + draft.client_uuid;
  const saved = localStorage.getItem(key);
  const payload: Payload = { ...draft };
  for (const field of ["bill_discount"] as const) {
    if (payload[field] !== undefined) payload[field] = parseMoney(String(payload[field]));
  }
  if (Array.isArray(payload.items)) payload.items = payload.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("รายการขายไม่ถูกต้อง");
    const line = { ...item };
    for (const field of ["unit_price", "item_discount"] as const) if (line[field] !== undefined) line[field] = parseMoney(String(line[field]));
    return line;
  });
  if (saved !== null) {
    let original: Payload;
    try { original = JSON.parse(saved) as Payload; }
    catch { throw new Error("อ่านบิลค้างเดิมไม่ได้ กรุณาให้เจ้าของตรวจสอบก่อนรับเงินต่อ"); }
    if (!original || typeof original !== "object" || original.client_uuid !== draft.client_uuid) throw new Error("ข้อมูลบิลค้างเดิมไม่ตรงกัน กรุณาให้เจ้าของตรวจสอบ");
    if (sameIntent(original) !== sameIntent(payload)) throw new Error("บิลเดิมยังไม่ยืนยันผล กรุณาลองด้วยรายการและยอดเดิมก่อนแก้ไข");
    return original;
  }
  assertReceivingIntake(status);
  const device = status.epoch ? receiptDevice(status) : getReceivingDevice();
  payload.cash_epoch = status.epoch; payload.receiving_device = device; payload.receiving_token = getReceivingDeviceToken();
  localStorage.setItem(CASH_RECEIPT_ROUTE_KEY + draft.client_uuid, JSON.stringify({ action: "sale" }));
  localStorage.setItem(key, JSON.stringify(payload));
  return payload;
}

export async function sendReceipt(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.client_uuid !== "string") {
    return { data: null, error: { message: "ข้อมูลบิลค้างไม่ถูกต้อง กรุณาให้เจ้าของตรวจสอบ", code: "P0001" } };
  }
  try {
    const status = await cashStatus();
    const result = status.epoch
      ? await cashExecute(payload.client_uuid, typeof payload.cash_epoch === "string" ? payload.cash_epoch : null, "sale", { payload, device: payload.receiving_device ?? null, deviceToken: payload.receiving_token ?? null })
      : await createClient().rpc("rpc_create_sale", { payload });
    if (!result.error || isDefiniteCashError(result.error)) clearReceipt(payload.client_uuid);
    return result;
  } catch {
    return { data: null, error: { message: "ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อแล้วลองบิลเดิม" } };
  }
}

export async function sendRepairReceipt(id: string, payload: Payload) {
  if (typeof payload.client_uuid !== "string") return { data: null, error: { message: "ไม่พบรหัสบิลซ่อม", code: "P0001" } };
  try {
    localStorage.setItem(CASH_RECEIPT_ROUTE_KEY + payload.client_uuid, JSON.stringify({ action: "repair_close", id }));
    const status = await cashStatus();
    const result = status.epoch
      ? await cashExecute(payload.client_uuid, typeof payload.cash_epoch === "string" ? payload.cash_epoch : null, "repair_close", { id, payload, device: payload.receiving_device ?? null, deviceToken: payload.receiving_token ?? null })
      : await createClient().rpc("rpc_close_repair_job", { p_job_id: id, p_sale_payload: payload });
    if (!result.error || isDefiniteCashError(result.error)) clearReceipt(payload.client_uuid);
    return result;
  } catch { return { data: null, error: { message: "ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อแล้วลองบิลเดิม" } }; }
}

export function clearReceipt(id: string) {
  localStorage.removeItem(CASH_RECEIPT_KEY + id);
  localStorage.removeItem(CASH_RECEIPT_ROUTE_KEY + id);
}
