"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Json } from "@/lib/types/database";
import { getReceivingDevice, getReceivingDeviceToken } from "@/lib/cash/client";
import { parseMoney } from "@/lib/cash/money";
import { executeCash, prepareCashEvidence } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { readQueue } from "../pos/queue";
import type { CashSource } from "@/lib/cash/types";

type Job = { id: string; epoch: string | null; payload: Record<string, Json> };
const moneyKeys = new Set(["amount", "bank", "drawer", "pending", "returned", "minimum"]);
const numberKeys = new Set(["version", "weekday", "overdueHours"]);
const boolKeys = new Set(["confirmed", "physicallyReturned", "queueDrained", "physicallyPaused", "enabled"]);

export function Field({ name, label, type = "text", value, required = true }: { name: string; label: string; type?: string; value?: string; required?: boolean }) {
  return <label className="flex flex-col gap-1 text-sm">{label}<input className="ucom-field px-3 py-2" type={type} name={name} defaultValue={value} required={required} step={type === "number" ? "0.01" : undefined} /></label>;
}
export function Check({ name, label }: { name: string; label: string }) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" name={name} value="true" required className="mt-1" />{label}</label>;
}

export default function CashForm({ action, epoch, fields = {}, children, label, uploadHandOver, isDisabled = false, sources }: {
  action: string; epoch: string | null; fields?: Record<string, Json>; children: ReactNode; label: string; uploadHandOver?: string; isDisabled?: boolean; sources?: CashSource[];
}) {
  const router = useRouter();
  const storageKey = `ucom.cash.operation.v1.${action}.${String(fields.handoverId ?? fields.id ?? fields.kind ?? "new")}`;
  const [job, setJob] = useState<Job | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    Promise.resolve().then(() => {
      try { const saved = sessionStorage.getItem(storageKey); if (saved) setJob(JSON.parse(saved) as Job); } catch { /* storage may be unavailable */ }
    });
  }, [storageKey]);
  async function submit(form: FormData) {
    if (isBusy || (isDisabled && !job)) return;
    setIsBusy(true);
    try {
      let pending = job;
      if (!pending) {
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
        pending = { id: crypto.randomUUID(), epoch, payload };
        sessionStorage.setItem(storageKey, JSON.stringify(pending)); setJob(pending);
      }
      const result = await executeCash(pending.id, pending.epoch, action, pending.payload);
      setMessage(result.message);
      if (result.ok || !result.ambiguous) { sessionStorage.removeItem(storageKey); setJob(null); }
      if (result.ok) router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "ยังไม่ทราบผล กดลองอีกครั้งด้วยรายการเดิม"); }
    finally { setIsBusy(false); }
  }
  return <form action={submit} className="flex flex-col gap-3">
    <fieldset disabled={isBusy || Boolean(job) || isDisabled} className="flex flex-col gap-3">{children}</fieldset>
    {job && <div className="text-sm text-warning"><p>มีรายการรอผล ลองซ้ำด้วยข้อมูลเดิมก่อนทำรายการอื่น</p><dl>{Object.entries(job.payload).filter(([key]) => ["amount", "bank", "drawer", "pending", "returned", "custodian", "reason"].includes(key)).map(([key, value]) => <div key={key}>{({ amount: "ยอด", bank: "ฝากธนาคาร", drawer: "เก๊ะ", pending: "รอฝาก", returned: "คืนรอฝาก", custodian: "ผู้ถือเงิน", reason: "เหตุผล" } as Record<string, string>)[key]}: {String(value)}</div>)}</dl></div>}
    <button className="ucom-primary justify-center px-4 py-2" disabled={isBusy || (isDisabled && !job)}>{isBusy ? "กำลังบันทึก…" : job ? "ลองรายการเดิมซ้ำ" : label}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
