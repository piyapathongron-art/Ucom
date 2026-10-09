"use server";

import { createClient } from "@/lib/supabase/server";
import { pushCashSnapshot } from "@/lib/line/push";
import type { CashExecuteResult, CashSnapshot, CashHandover } from "@/lib/cash/types";
import { validatesCashProof } from "@/lib/cash/operations";
import type { Json } from "@/lib/types/database";
import { isDefiniteCashError } from "@/lib/cash/errors";
import { toThaiError } from "@/lib/errors";

const actions = new Set(["open", "handover_days", "handover", "return", "settle", "review", "evidence", "adjust", "correct", "reminder"]);

async function member() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["owner", "staff"].includes(profile.role)) return null;
  return { supabase, user, isOwner: profile.role === "owner" };
}

export async function cashActor() { return (await member())?.user.id ?? null; }
export async function inspectCashOperation(id: string) {
  const auth = await member();
  if (!auth) return null;
  const { data, error } = await auth.supabase.rpc("rpc_cash_operation_snapshot", { p_operation_id: id });
  if (error || !data || typeof data !== "object" || Array.isArray(data) || data.actorId !== auth.user.id) return null;
  return data;
}
export async function executeCash(id: string, epoch: string | null, action: string, payload: Json, actorId?: string) {
  try {
    const auth = await member();
    if (!auth || (actorId && actorId !== auth.user.id)) return { ok: false, ambiguous: true, message: "กรุณาเข้าสู่ระบบด้วยบัญชีผู้ทำรายการเดิม" };
    if (!actions.has(action) || (!auth.isOwner && ["open", "review", "adjust", "correct", "reminder"].includes(action))) return { ok: false, ambiguous: true, message: "ไม่มีสิทธิ์ทำรายการนี้" };
    const { data, error } = await auth.supabase.rpc("rpc_cash_execute", { p_operation_id: id, p_epoch: epoch, p_action: action, p_payload: payload });
    if (error) {
      const inspection = await auth.supabase.rpc("rpc_cash_operation_snapshot", { p_operation_id: id });
      const isRejected = isDefiniteCashError(error) && !inspection.error && inspection.data === null;
      return { ok: false, ambiguous: !isRejected, rejected: isRejected, actorId: auth.user.id, id, message: error.code === "40001" ? "ยอดเปลี่ยนแล้ว รีเฟรชและนับเงินใหม่ก่อนทำรายการ" : toThaiError(error) };
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.id !== "string") return { ok: false, ambiguous: true, message: "ยังยืนยันผลรายการเดิมไม่ได้" };
    const proof = await auth.supabase.rpc("rpc_cash_operation_snapshot", { p_operation_id: id });
    const record = proof.data;
    if (proof.error || !validatesCashProof(record, { id, actorId: auth.user.id, epoch, action, payload }, data)) return { ok: false, ambiguous: true, message: "ยังตรวจตัวตนและข้อมูลรายการเดิมไม่ได้" };
    const result = data as unknown as CashExecuteResult;
    const titles: Record<string, string> = { handover_days: "นำเงินออกไปฝาก", handover: "นำเงินออกไปฝาก", settle: "แจ้งฝากเงินแล้ว · รอเจ้าของตรวจ", return: "คืนเงินนำฝากเข้าร้านแล้ว", review: "บันทึกผลตรวจหลักฐาน", evidence: "ส่งหลักฐานฝากเงินใหม่" };
    const isSent = result.snapshot ? await pushCashSnapshot(result.snapshot, titles[action] ?? "เงินสดร้าน", false, id) : true;
    return { ok: true, ambiguous: false, actorId: auth.user.id, id, notificationSent: isSent, message: isSent ? "บันทึกแล้ว" : "บันทึกแล้ว แต่ส่ง LINE ไม่สำเร็จ สามารถส่งซ้ำได้" };
  } catch { return { ok: false, ambiguous: true, message: "ยังไม่ทราบผลรายการ กดลองซ้ำด้วยข้อมูลเดิมเพื่อป้องกันบันทึกซ้ำ" }; }
}

export async function prepareCashEvidence(handover: string, upload: string, mime: string, size: number) {
  const auth = await member();
  if (!auth) return { error: "กรุณาเข้าสู่ระบบด้วยบัญชีร้าน" };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  if (!extensions[mime] || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024 || !uuid.test(handover) || !uuid.test(upload)) return { error: "เลือกภาพ JPG/PNG/WebP หรือ PDF ขนาดไม่เกิน 10 MiB" };
  const { data, error } = await auth.supabase.rpc("rpc_cash_handover", { p_handover_id: handover });
  const item = data as unknown as CashHandover;
  if (error || !item || !["handed_over", "disputed"].includes(item.state)) return { error: "รายการนี้ยังไม่พร้อมแนบหลักฐาน" };
  const path = `${auth.user.id}/${handover}/${upload}.${extensions[mime]}`;
  const { data: signed, error: uploadError } = await auth.supabase.storage.from("ucom-cash-evidence").createSignedUploadUrl(path, { upsert: false });
  if (uploadError) return { error: "อัปโหลดไม่สำเร็จ ยังไม่ได้บันทึกการฝากเงิน" };
  return { path, token: signed.token };
}

export async function evidenceUrl(handoverId: string) {
  const auth = await member();
  if (!auth) return null;
  const { data, error } = await auth.supabase.rpc("rpc_cash_handover", { p_handover_id: handoverId });
  if (error) return null;
  const handover = data as unknown as CashHandover;
  if (!handover?.evidencePath) return null;
  const { data: signed } = await auth.supabase.storage.from("ucom-cash-evidence").createSignedUrl(handover.evidencePath, 60);
  return signed?.signedUrl ?? null;
}

export async function resendCashSnapshot(operationId: string) {
  const auth = await member();
  if (!auth) return false;
  const { data, error } = await auth.supabase.rpc("rpc_cash_operation_snapshot", { p_operation_id: operationId });
  if (error) return false;
  const event = data as unknown as CashExecuteResult;
  return event?.snapshot ? pushCashSnapshot(event.snapshot as CashSnapshot, "สรุปรายการเงินสดเดิม", true, operationId) : false;
}
