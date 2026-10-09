"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/types/database";
import type { CashExecuteResult, CashStatus } from "./types";
import { parseMoney } from "./money";
import { isDefiniteCashError } from "./errors";
import { refreshCashOperations } from "./operations";
export { isDefiniteCashError } from "./errors";

const DEVICE_KEY = "ucom-receiving-device-v1";
const TOKEN_KEY = "ucom-receiving-token-v1";
const STATUS_KEY = "ucom-cash-status-v2";
export const CASH_PAUSE_KEY = "ucom-cash-receiving-paused-v1:";
const RECEIVING_LOCK = "ucom-cash-receiving-v1";
export const CASH_REQUEST_KEY = "ucom-cash-request-v1:";
export const RECEIPT_OFFLINE_MESSAGE = "ปิดการออกบิล offline ชั่วคราว กรุณาเชื่อมต่อระบบก่อนออกบิล";
export type CashError = { message: string; code?: string };
type Request = { id: string; epoch: string; action: string; payload: Json };
type Result = { data?: unknown; error: unknown };

export function getReceivingDevice(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)) return existing;
  const device = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, device);
  return device;
}

export function getReceivingDeviceToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function hasPendingCashRequests(): boolean {
  if (refreshCashOperations().length) return true;
  if (!isCashQueueReadable()) return true;
  return Object.keys(localStorage).some(key => key.startsWith(CASH_REQUEST_KEY) || key.startsWith("ucom-cash-sale-v1:"));
}

export function isCashQueueReadable(): boolean {
  const saved = localStorage.getItem("ucom-pos-queue-v1");
  if (saved === null) return true;
  try { return Array.isArray(JSON.parse(saved)); } catch { return false; }
}

function readStatus(value: unknown): CashStatus {
  if (!value || typeof value !== "object" || !("epoch" in value) || !("version" in value)
    || (value.epoch !== null && typeof value.epoch !== "string") || typeof value.version !== "number") {
    throw new Error("ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อและลองใหม่");
  }
  const status = value as CashStatus;
  if (typeof status.isReceivingPaused !== "boolean") throw new Error("ต้องเชื่อมต่อเพื่อตรวจระบบรับเงินรุ่นล่าสุด");
  try {
    for (const key of ["drawer", "pending", "reserved", "available"] as const) {
      if (typeof status[key] !== "string") throw new Error("invalid amount");
      parseMoney(status[key]);
    }
  } catch { throw new Error("ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อและลองใหม่"); }
  if (!Array.isArray(status.handovers) || !Array.isArray(status.closings) || !Array.isArray(status.movements)) {
    throw new Error("ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อและลองใหม่");
  }
  return status;
}

export async function cashStatus(options: { cached?: boolean } = {}): Promise<CashStatus> {
  if (options.cached && !navigator.onLine) {
    const saved = localStorage.getItem(STATUS_KEY);
    if (!saved) throw new Error("ต้องเชื่อมต่อเพื่อตรวจระบบเงินสดก่อนรับเงิน");
    try { return readStatus(JSON.parse(saved)); }
    catch { throw new Error("อ่านสถานะเงินสดในเครื่องไม่ได้ กรุณาเชื่อมต่อเพื่อตรวจใหม่"); }
  }
  const { data, error } = await createClient().rpc("rpc_cash_status");
  if (error) throw new Error("ตรวจสถานะเงินสดไม่สำเร็จ กรุณาเชื่อมต่อและลองใหม่");
  const status = readStatus(data);
  if (status.epoch && status.isReceivingPaused) localStorage.setItem(CASH_PAUSE_KEY + status.epoch, "paused");
  localStorage.setItem(STATUS_KEY, JSON.stringify({ ...status, isOwner: false, movements: [], sources: undefined }));
  return status;
}

export function isReceivingLocallyPaused(status: CashStatus): boolean {
  return Boolean(status.epoch && (status.isReceivingPaused || localStorage.getItem(CASH_PAUSE_KEY + status.epoch) !== null));
}

export function assertReceivingIntake(status: CashStatus): void {
  if (refreshCashOperations().length) throw new Error("มีรายการเงินสดเดิมรอยืนยันผล กรุณาตรวจรายการเดิมก่อนรับเงินใหม่");
  if (!navigator.onLine) throw new Error(RECEIPT_OFFLINE_MESSAGE);
  if (isReceivingLocallyPaused(status)) throw new Error("หยุดรับเงินอยู่ กรุณาให้เครื่อง POS หลักกดกลับมารับเงินหลังปิดยอดหรือส่งมอบเสร็จ");
}

export async function withReceivingIntake<T>(work: (status: CashStatus) => Promise<T>): Promise<T> {
  const execute = async () => {
    if (!navigator.onLine) throw new Error(RECEIPT_OFFLINE_MESSAGE);
    const status = await cashStatus();
    if (status.epoch && !navigator.locks?.request) throw new Error("เบราว์เซอร์นี้ล็อกเครื่องรับเงินไม่ได้ กรุณาใช้เบราว์เซอร์ของเครื่อง POS หลัก");
    assertReceivingIntake(status);
    return work(status);
  };
  return navigator.locks?.request ? navigator.locks.request(RECEIVING_LOCK, execute) : execute();
}

export async function cashExecute(id: string, epoch: string | null, action: string, payload: Json) {
  try {
    const { data, error } = await createClient().rpc("rpc_cash_execute", { p_operation_id: id, p_epoch: epoch, p_action: action, p_payload: payload });
    if (!error && (!data || typeof data !== "object" || Array.isArray(data) || typeof data.id !== "string")) {
      return { data: null, error: { message: "ยังยืนยันผลไม่ได้ กรุณาลองรายการเดิมอีกครั้ง" } as CashError };
    }
    return { data: data as CashExecuteResult | null, error };
  } catch {
    return { data: null, error: { message: "ยังยืนยันผลไม่ได้ กรุณาลองรายการเดิมอีกครั้ง" } as CashError };
  }
}

// ponytail: one pending request per form prevents changed retries; add an explicit recovery view if operations need parallel drafts.
export async function cashWrite(scope: string, action: string, payload: Json, legacy: () => PromiseLike<Result>, id?: string): Promise<Result> {
  try {
    const isReceipt = ["income", "consign_sell", "consign_settle"].includes(action);
    const execute = async (status: CashStatus): Promise<Result> => {
      if (!status.epoch) return await legacy();
      const key = CASH_REQUEST_KEY + scope;
      const saved = localStorage.getItem(key);
      if (!saved && refreshCashOperations().length) throw new Error("มีรายการเงินสดเดิมรอยืนยันผล กรุณาตรวจรายการเดิมก่อนสร้างรายการใหม่");
      let request: Request;
      const devicePayload = () => {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("ข้อมูลรับเงินไม่ถูกต้อง");
        return { ...payload, device: receiptDevice(status), deviceToken: getReceivingDeviceToken() };
      };
      if (saved !== null) {
        try {
          const value: unknown = JSON.parse(saved);
          if (!value || typeof value !== "object" || Array.isArray(value)
            || !("id" in value) || typeof value.id !== "string"
            || !("epoch" in value) || typeof value.epoch !== "string"
            || !("action" in value) || typeof value.action !== "string" || !("payload" in value)) throw new Error("invalid request");
          request = value as Request;
        } catch { return { error: { message: "อ่านรายการเดิมไม่ได้ กรุณาให้เจ้าของตรวจสอบก่อนรับเงินต่อ", code: "P0001" } }; }
      } else {
        request = { id: id ?? crypto.randomUUID(), epoch: status.epoch, action, payload: isReceipt ? devicePayload() : payload };
      }
      const intent = (value: Json) => isReceipt && value && typeof value === "object" && !Array.isArray(value) ? { ...value, device: undefined, deviceToken: undefined } : value;
      if (request.action !== action || JSON.stringify(intent(request.payload)) !== JSON.stringify(intent(payload))) {
        throw new Error("รายการเดิมยังไม่ยืนยันผล กรุณาลองด้วยข้อมูลเดิมก่อนเปลี่ยนยอด");
      }
      localStorage.setItem(key, JSON.stringify(request));
      const result = await cashExecute(request.id, request.epoch, request.action, request.payload);
      if (!result.error || isDefiniteCashError(result.error)) localStorage.removeItem(key);
      return result;
    };
    if (isReceipt) return await withReceivingIntake(execute);
    if (!navigator.locks?.request) throw new Error("เบราว์เซอร์นี้ล็อกรายการเงินไม่ได้ กรุณาใช้เบราว์เซอร์ที่รองรับ");
    return await navigator.locks.request(RECEIVING_LOCK, async () => execute(await cashStatus()));
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : "ตรวจสถานะเงินสดไม่สำเร็จ", code: "P0001" } };
  }
}

export async function pauseReceivingPos(): Promise<CashStatus> {
  if (!navigator.locks?.request) throw new Error("เบราว์เซอร์นี้ล็อกเครื่องรับเงินไม่ได้ กรุณาใช้เบราว์เซอร์ของเครื่อง POS หลัก");
  return navigator.locks.request(RECEIVING_LOCK, async () => {
    const status = await cashStatus({ cached: true });
    if (!status.epoch) throw new Error("ระบบเงินสดยังไม่เปิดใช้งาน");
    receiptDevice(status);
    localStorage.setItem(CASH_PAUSE_KEY + status.epoch, "paused");
    if (!navigator.onLine) throw new Error("หยุดรับเงินในเครื่องแล้ว กรุณาเชื่อมต่อและยืนยันหยุดรับเงินอีกครั้ง");
    if (!isCashQueueReadable()) throw new Error("หยุดรับเงินในเครื่องแล้ว แต่อ่านคิวบิลเดิมไม่ได้ กรุณาให้เจ้าของตรวจสอบก่อนยืนยันหยุด");
    const queue: unknown = JSON.parse(localStorage.getItem("ucom-pos-queue-v1") ?? "[]");
    if (!Array.isArray(queue) || queue.length || hasPendingCashRequests()) throw new Error("หยุดรับเงินในเครื่องแล้ว กรุณาส่งบิลค้างและยืนยันรายการเดิมให้ครบ จากนั้นกดยืนยันหยุดอีกครั้ง");
    try {
      const { error } = await createClient().rpc("rpc_cash_pos_ack", { p_epoch: status.epoch, p_device: getReceivingDevice(), p_device_token: getReceivingDeviceToken(), p_version: status.version });
      if (error) throw error;
    } catch { throw new Error("หยุดรับเงินในเครื่องแล้ว แต่ยังยืนยันกับระบบไม่ได้ กรุณาลองยืนยันหยุดอีกครั้ง"); }
    return cashStatus();
  });
}

export async function resumeReceivingPos(): Promise<CashStatus> {
  if (!navigator.locks?.request) throw new Error("เบราว์เซอร์นี้ล็อกเครื่องรับเงินไม่ได้ กรุณาใช้เบราว์เซอร์ของเครื่อง POS หลัก");
  return navigator.locks.request(RECEIVING_LOCK, async () => {
    if (!navigator.onLine) throw new Error("ต้องเชื่อมต่อเพื่อยืนยันกลับมารับเงินกับระบบก่อน");
    const status = await cashStatus();
    if (!status.epoch) throw new Error("ระบบเงินสดยังไม่เปิดใช้งาน");
    if (hasPendingCashRequests()) throw new Error("มีรายการเงินสดเดิมรอยืนยันผล กรุณาตรวจให้ครบก่อนกลับมารับเงิน");
    receiptDevice(status);
    try {
      const { error } = await createClient().rpc("rpc_cash_pos_resume", { p_epoch: status.epoch, p_device: getReceivingDevice(), p_device_token: getReceivingDeviceToken() });
      if (error) throw error;
    } catch { throw new Error("ยังยืนยันกลับมารับเงินไม่ได้ กรุณาลองอีกครั้ง"); }
    const resumed = await cashStatus();
    if (resumed.isReceivingPaused) throw new Error("ระบบยังหยุดรับเงินอยู่ กรุณาตรวจสอบกับเครื่อง POS หลัก");
    localStorage.removeItem(CASH_PAUSE_KEY + status.epoch);
    return resumed;
  });
}

export function receiptDevice(status: CashStatus): string {
  const device = getReceivingDevice();
  if (status.epoch && status.receivingDevice !== device) throw new Error("รับเงินได้เฉพาะเครื่อง POS ที่กำหนด กรุณาใช้เครื่องรับเงินของร้าน");
  return device;
}
