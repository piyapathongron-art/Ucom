"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Json } from "@/lib/types/database";
import { getReceivingDevice, getReceivingDeviceToken } from "@/lib/cash/client";
import { parseMoney } from "@/lib/cash/money";
import { cashActor, executeCash, prepareCashEvidence } from "./actions";
import { CASH_OPERATION_EVENT, assertStoredCashIntent, clearCashIntent, refreshCashOperations, saveCashIntent, withCashOperationLock, type CashIntent } from "@/lib/cash/operations";
import { createClient } from "@/lib/supabase/client";
import { readQueue } from "../pos/queue";
import type { CashSource } from "@/lib/cash/types";

const moneyKeys = new Set(["amount", "bank", "drawer", "pending", "returned", "minimum", "drawerBeforeDeparture"]);
const numberKeys = new Set(["version", "weekday", "overdueHours"]);
const boolKeys = new Set(["confirmed", "physicallyReturned", "queueDrained", "physicallyPaused", "enabled", "drawerPhysicallySeparated"]);

// Ref callback (client only) so the Bangkok "now" default cannot cause a hydration mismatch.
function fillBangkokNow(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = new Date(Math.ceil((Date.now() + 7 * 3600_000) / 60_000) * 60_000).toISOString().slice(0, 16); // rounded up: never earlier than the handover, within the 5-minute future tolerance
}
export function Field({ name, label, type = "text", value, required = true, isNow = false }: { name: string; label: string; type?: string; value?: string; required?: boolean; isNow?: boolean }) {
  return <label className="flex flex-col gap-1 text-sm">{label}<input className="ucom-field px-3 py-2" type={type} name={name} defaultValue={value} required={required} step={type === "number" ? "0.01" : undefined} ref={isNow ? fillBangkokNow : undefined} /></label>;
}
export function Check({ name, label }: { name: string; label: string }) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} value="true" required className="mt-1" />{label}</label>;
}

export default function CashForm({ action, epoch, fields = {}, children, label, uploadHandOver, isDisabled = false, disabledReason, check, sources }: {
  action: string; epoch: string | null; fields?: Record<string, Json>; children: ReactNode; label: string; uploadHandOver?: string; isDisabled?: boolean;
  disabledReason?: string; check?: (form: FormData) => string | null; sources?: CashSource[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const scope = String(fields.handoverId ?? fields.id ?? fields.kind ?? "new");
  const [job, setJob] = useState<CashIntent | null>(null);
  const [hasBlockedIntent, setHasBlockedIntent] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => {
      const entries = refreshCashOperations();
      const matched = entries.find(item => item.intent?.action === action && item.intent.payload && typeof item.intent.payload === "object" && !Array.isArray(item.intent.payload) && String(item.intent.payload.handoverId ?? item.intent.payload.id ?? item.intent.payload.kind ?? "new") === scope);
      setJob(matched?.intent ?? null); setHasBlockedIntent(entries.length > 0);
    };
    Promise.resolve().then(refresh);
    window.addEventListener("storage", refresh); window.addEventListener(CASH_OPERATION_EVENT, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(CASH_OPERATION_EVENT, refresh); };
  }, [action, scope]);
  async function submit(form: FormData) {
    if (isBusy || (isDisabled && !job)) return;
    setIsBusy(true);
    try {
      await withCashOperationLock(job?.id ?? null, async () => {
      let pending = job;
      if (!pending) {
        if (refreshCashOperations().length) throw new Error("มีรายการเดิมรอยืนยันผล กรุณาตรวจรายการเดิมก่อนทำรายการใหม่");
        const actorId = await cashActor();
        if (!actorId) throw new Error("กรุณาเข้าสู่ระบบด้วยบัญชีร้าน");
        const problem = check?.(form);
        if (problem) throw new Error(problem);
        const payload: Record<string, Json> = { ...fields };
        for (const [key, value] of form.entries()) {
          if (value instanceof File || key.startsWith("$ACTION") || key === "confirmedInput") continue;
          payload[key] = moneyKeys.has(key) ? parseMoney(value, action === "adjust") : numberKeys.has(key) ? Number(value) : boolKeys.has(key) ? value === "true" : value;
        }
        if (sources) {
          const source = sources.find(item => `${item.table}:${item.id}` === payload.sourceChoice);
          if (!source) throw new Error("เลือกรายการต้นทางที่ต้องการแก้ไข");
          delete payload.sourceChoice;
          if (action === "correct") { payload.table = source.table; payload.id = source.id; }
          if (action === "adjust") payload.sourceOperationId = source.operationId;
        }
        if (action === "open") {
          if (!window.matchMedia("(min-width: 1024px)").matches) throw new Error("เปิดยอดตั้งต้นบนเครื่องรับเงินหลักของร้านเท่านั้น");
          if (readQueue().length) throw new Error("ยังมีบิลในคิวบนเครื่องนี้ ต้องซิงก์ให้เซิร์ฟเวอร์รับครบก่อนนับยอดตั้งต้น");
          payload.device = getReceivingDevice();
          payload.deviceToken = getReceivingDeviceToken();
        }
        if (uploadHandOver) {
          const file = form.get("file");
          if (!(file instanceof File)) throw new Error("แนบหลักฐานก่อนบันทึก");
          const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
          const ascii = new TextDecoder().decode(head);
          const hasValidHeader = file.type === "image/jpeg" ? head[0] === 255 && head[1] === 216 && head[2] === 255
            : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => head[i] === byte)
            : file.type === "image/webp" ? ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP" : file.type === "application/pdf" && ascii.startsWith("%PDF-");
          if (!hasValidHeader) throw new Error("ชนิดไฟล์ไม่ตรงกับเนื้อหา กรุณาเลือกภาพหรือ PDF ที่ถูกต้อง");
          const result = await prepareCashEvidence(uploadHandOver, crypto.randomUUID(), file.type, file.size);
          if (result.error || !result.path || !result.token) throw new Error(result.error ?? "อัปโหลดไม่สำเร็จ");
          const { error: uploadError } = await createClient().storage.from("ucom-cash-evidence").uploadToSignedUrl(result.path, result.token, file, { contentType: file.type });
          if (uploadError) throw new Error("อัปโหลดไม่สำเร็จ ยังไม่ได้บันทึกการฝากเงิน");
          payload.evidencePath = result.path;
          if (action === "settle") payload.depositedAt = new Date(`${String(payload.depositedAt)}+07:00`).toISOString();
        }
        pending = { storageVersion: 2, id: crypto.randomUUID(), actorId, epoch, action, payload, status: "unresolved" };
        saveCashIntent(pending); setJob(pending);
      }
      if (!pending.actorId || await cashActor() !== pending.actorId) throw new Error("ต้องใช้บัญชีผู้ทำรายการเดิมเพื่อยืนยันผล รายการเก่าต้องตรวจเจ้าของคำขอก่อน");
      assertStoredCashIntent(pending);
      const result = await executeCash(pending.id, pending.epoch, pending.action, pending.payload, pending.actorId);
      setMessage(result.message);
      if ((result.ok || ("rejected" in result && result.rejected)) && "actorId" in result && result.actorId === pending.actorId && "id" in result && result.id === pending.id) {
        if (result.ok && "notificationSent" in result && result.notificationSent === false) localStorage.setItem(`ucom-cash-notification-v1:${pending.id}`, pending.actorId);
        clearCashIntent(pending); setJob(null);
        // Keep what staff typed (and the attached slip) when the server rejects; they fix one field and resend.
        if (result.ok) formRef.current?.reset();
        router.refresh();
      }
      if (result.ok) router.refresh();
      });
    } catch (error) { setMessage(error instanceof Error ? error.message : "ยังไม่ทราบผล กดลองอีกครั้งด้วยรายการเดิม"); }
    finally { setIsBusy(false); }
  }
  // onSubmit, not action={}: React 19 resets uncontrolled fields after a form action, which wiped everything a rejected submit should keep.
  return <form ref={formRef} onSubmit={event => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }} className="flex flex-col gap-3">
    <fieldset disabled={isBusy || Boolean(job) || hasBlockedIntent} className="flex flex-col gap-3">{children}</fieldset>
    {hasBlockedIntent && <p className="text-sm text-warning">มีรายการเงินเดิมรอยืนยัน ต้องใช้บัญชีผู้ทำรายการเดิมตรวจผลก่อนทำรายการใหม่</p>}
    {job && <div className="text-sm text-warning"><p>ลองซ้ำด้วยข้อมูลเดิมก่อนทำรายการอื่น</p></div>}
    <button className="ucom-primary justify-center px-4 py-2" disabled={isBusy || (!job && (isDisabled || hasBlockedIntent))}>{isBusy ? "กำลังบันทึก…" : job ? "ลองรายการเดิมซ้ำ" : label}</button>
    {isDisabled && !job && !hasBlockedIntent && disabledReason && <p className="text-sm text-ink-muted">{disabledReason}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
