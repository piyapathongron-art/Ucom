"use server";

import { createClient } from "@/lib/supabase/server";
import { pushCashSnapshot } from "@/lib/line/push";
import type { CashExecuteResult, CashSnapshot, CashStatus } from "@/lib/cash/types";
import type { Json } from "@/lib/types/database";
import { isDefiniteCashError } from "@/lib/cash/errors";
import { toThaiError } from "@/lib/errors";

const actions = new Set(["open", "handover", "return", "settle", "review", "evidence", "adjust", "correct", "reminder"]);

async function member() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["owner", "staff"].includes(profile.role)) return null;
  return { supabase, user, isOwner: profile.role === "owner" };
}

export async function executeCash(id: string, epoch: string | null, action: string, payload: Json) {
  try {
    const auth = await member();
    if (!auth) return { ok: false, ambiguous: false, message: "กรุณาเข้าสู่ระบบด้วยบัญชีร้าน" };
    if (!actions.has(action) || (!auth.isOwner && ["open", "review", "adjust", "correct", "reminder"].includes(action))) return { ok: false, ambiguous: false, message: "ไม่มีสิทธิ์ทำรายการนี้" };
    const { data, error } = await auth.supabase.rpc("rpc_cash_execute", { p_operation_id: id, p_epoch: epoch, p_action: action, p_payload: payload });
    if (error) return { ok: false, ambiguous: !isDefiniteCashError(error), message: error.code === "40001" ? "ยอดระบบเปลี่ยนแล้ว ตรวจยอดล่าสุดและนับเงินใหม่ก่อนทำรายการ" : error.code === "22023" ? "ข้อมูลรายการไม่ถูกต้อง ตรวจยอดและรายละเอียดก่อนลองอีกครั้ง" : toThaiError(error) };
    const result = data as unknown as CashExecuteResult;
    const titles: Record<string, string> = { handover: "นำเงินออกไปฝาก", settle: "แจ้งฝากเงินแล้ว · รอเจ้าของตรวจ", return: "คืนเงินนำฝากเข้าร้านแล้ว", review: "บันทึกผลตรวจหลักฐาน", evidence: "ส่งหลักฐานฝากเงินใหม่" };
    const isSent = result.snapshot ? await pushCashSnapshot(result.snapshot, titles[action] ?? "เงินสดร้าน", false, id) : true;
    return { ok: true, ambiguous: false, message: isSent ? "บันทึกแล้ว" : "บันทึกแล้ว แต่ส่ง LINE ไม่สำเร็จ สามารถส่งซ้ำได้" };
  } catch { return { ok: false, ambiguous: true, message: "ยังไม่ทราบผลรายการ กดลองซ้ำด้วยข้อมูลเดิมเพื่อป้องกันบันทึกซ้ำ" }; }
}

export async function prepareCashEvidence(handover: string, upload: string, mime: string, size: number) {
  const auth = await member();
  if (!auth) return { error: "กรุณาเข้าสู่ระบบด้วยบัญชีร้าน" };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  if (!extensions[mime] || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024 || !uuid.test(handover) || !uuid.test(upload)) return { error: "เลือกภาพ JPG/PNG/WebP หรือ PDF ขนาดไม่เกิน 10 MiB" };
  const { data, error } = await auth.supabase.rpc("rpc_cash_status");
  const status = data as unknown as CashStatus;
  if (error || !status?.handovers.some((item) => item.id === handover && ["handed_over", "disputed"].includes(item.state))) return { error: "รายการนี้ยังไม่พร้อมแนบหลักฐาน" };
  const path = `${auth.user.id}/${handover}/${upload}.${extensions[mime]}`;
  const { data: signed, error: uploadError } = await auth.supabase.storage.from("ucom-cash-evidence").createSignedUploadUrl(path, { upsert: false });
  if (uploadError) return { error: "อัปโหลดไม่สำเร็จ ยังไม่ได้บันทึกการฝากเงิน" };
  return { path, token: signed.token };
}

export async function evidenceUrl(handoverId: string) {
  const auth = await member();
  if (!auth) return null;
  const { data, error } = await auth.supabase.rpc("rpc_cash_status");
  if (error) return null;
  const handover = (data as unknown as CashStatus).handovers.find((item) => item.id === handoverId);
  if (!handover?.evidencePath) return null;
  const { data: signed } = await auth.supabase.storage.from("ucom-cash-evidence").createSignedUrl(handover.evidencePath, 60);
  return signed?.signedUrl ?? null;
}

export async function resendCashSnapshot(handoverId: string) {
  const auth = await member();
  if (!auth) return false;
  const { data, error } = await auth.supabase.rpc("rpc_cash_status");
  if (error) return false;
  const handover = (data as unknown as CashStatus).handovers.find((item) => item.id === handoverId);
  const snapshot = handover?.snapshot;
  const title = handover?.state === "handed_over" ? "นำเงินออกไปฝาก" : handover?.state === "returned" ? "คืนเงินนำฝากเข้าร้านแล้ว" : "แจ้งฝากเงิน";
  return snapshot ? pushCashSnapshot(snapshot as CashSnapshot, title, true) : false;
}
