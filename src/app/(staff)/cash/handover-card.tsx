"use client";

import { useEffect, useRef, useState } from "react";
import type { CashHandover, CashStatus } from "@/lib/cash/types";
import { formatMoney, moneyCents } from "@/lib/cash/money";
import { lineDayLabel } from "@/lib/cash/day-selection";
import CashForm, { Check, Field } from "./cash-form";
import { evidenceUrl, resendCashSnapshot } from "./actions";
import { CARD, FILE_INPUT, HANDOVER_CHIP, NOTE, SUMMARY, TEXT_LINK, chip } from "./cash-styles";

function settleMismatch(form: FormData, amount: string) {
  const total = ["bank", "drawer", "returned"].reduce((sum, key) => sum + moneyCents(String(form.get(key) ?? "") || "0"), BigInt(0));
  const remainder = Number(moneyCents(amount) - total) / 100;
  if (remainder === 0) return null;
  const shown = formatMoney(Math.abs(remainder).toFixed(2));
  return remainder > 0
    ? `ยอดยังขาด ฿${shown} — ใส่เงินที่เหลือกลับร้าน (คืนเข้าเก๊ะ/คืนกองรอฝาก) ให้รวมครบ ฿${formatMoney(amount)}`
    : `ยอดรวมเกินเงินที่นำออกไป ฿${shown} ตรวจยอดฝากอีกครั้ง`;
}

// Live check of the same sum settleMismatch enforces on submit, read from the enclosing form.
function SettleTotal({ amount }: { amount: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => {
      // Read inputs directly: new FormData(form) skips them while CashForm's fieldset is still disabled on load.
      const values = new FormData();
      for (const key of ["bank", "drawer", "returned"]) {
        const input = form.elements.namedItem(key);
        if (input instanceof HTMLInputElement) values.set(key, input.value);
      }
      try { setProblem(settleMismatch(values, amount)); } catch { setProblem("กรอกยอดเป็นตัวเลข เช่น 1500 หรือ 1500.50"); }
    };
    Promise.resolve().then(update);
    form.addEventListener("input", update);
    return () => form.removeEventListener("input", update);
  }, [amount]);
  return <p ref={ref} role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold tabular-nums ${problem ? "bg-warning-bg text-warning" : "bg-success-bg text-success"}`}>{problem ?? `ยอดครบ ฿${formatMoney(amount)} พอดี`}</p>;
}

const states = { handed_over: "กำลังไปฝาก", reported: "แจ้งฝากแล้ว รอตรวจ", confirmed: "เจ้าของยืนยันแล้ว", disputed: "หลักฐานต้องแก้ไข", returned: "คืนเงินเข้าร้านแล้ว" };

export default function HandoverCard({ item, status, isCompact = false }: { item: CashHandover; status: CashStatus; isCompact?: boolean }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  async function viewEvidence() {
    setIsBusy(true);
    try { const signed = await evidenceUrl(item.id); setUrl(signed); if (!signed) setMessage("ไม่สามารถเปิดหลักฐานได้"); } catch { setMessage("ไม่สามารถเปิดหลักฐานได้"); }
    finally { setIsBusy(false); }
  }
  async function resend() {
    setIsBusy(true);
    try { setMessage(await resendCashSnapshot(item.snapshot?.eventOperationId ?? item.id) ? "ส่ง LINE ซ้ำแล้ว" : "ส่งไม่สำเร็จ รายการเงินยังอยู่ตามเดิม"); } catch { setMessage("ส่งไม่สำเร็จ"); }
    finally { setIsBusy(false); }
  }
  return <article className={`${CARD} space-y-3`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold tabular-nums">{item.custodian} · ฿{formatMoney(item.amount)}</h3><p className="text-sm text-muted-foreground tabular-nums">{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div><span className={chip(HANDOVER_CHIP[item.state])}>{states[item.state]}</span></div>
    {item.selectedTotal && <p className={`${NOTE} tabular-nums`}>เงินที่เลือกจากวันที่ ฿{formatMoney(item.selectedTotal)} · เข้าเก๊ะก่อนออก ฿{formatMoney(item.drawerBeforeDeparture ?? "0")} · นำออกไปฝาก ฿{formatMoney(item.bankBound ?? item.amount)}</p>}
    {item.selectedLines?.map(line => <p key={line.key} className="text-sm text-muted-foreground tabular-nums">{line.receiptDay ? lineDayLabel({ receiptDay: line.receiptDay, kind: "date" }) : "ยอดไม่ทราบวัน"} · ฿{formatMoney(line.amount)}</p>)}
    {item.state === "handed_over" && <>
      <details open={isCompact || undefined}><summary className={SUMMARY}>แจ้งฝากและแนบสลิป</summary><div className="mt-3">
        <CashForm action="settle" epoch={status.epoch} fields={{ handoverId: item.id }} uploadHandOver={item.id} check={form => settleMismatch(form, item.amount)} label={isCompact ? "ส่งสรุปเข้า LINE" : "ยืนยันแจ้งฝาก"}>
          <p className={NOTE}>ยอดฝาก + เงินคืนเข้าเก๊ะเพิ่ม + คืนกองรอฝาก ต้องเท่ากับ ฿{formatMoney(item.amount)} เศษก่อนออกเข้าร้านแล้ว ไม่ต้องนับซ้ำ</p>
          <Field name="bank" type="number" label="ฝากธนาคารจริง (บาท)" value={isCompact ? item.bankBound ?? item.amount : undefined} />
          {isCompact ? <details className="rounded-xl bg-muted px-4 py-1"><summary className={SUMMARY}>เงินเหลือกลับร้าน</summary><div className="space-y-3 pb-3"><Field name="drawer" type="number" label="เงินคืนเข้าเก๊ะเพิ่มหลังนำออก (บาท)" value="0" /><Field name="returned" type="number" label="คืนกองรอฝาก (บาท)" value="0" /></div></details>
            : <><Field name="drawer" type="number" label="เงินคืนเข้าเก๊ะเพิ่มหลังนำออก (บาท)" value="0" /><Field name="returned" type="number" label="คืนกองรอฝาก (บาท)" value="0" /></>}
          <SettleTotal amount={item.amount} />
          <Field name="depositedAt" type="datetime-local" label="วันและเวลาที่ฝากจริง (เวลาไทย)" isNow />
          <label className="text-sm font-semibold">หลักฐานฝากเงิน<input className={FILE_INPUT} name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label>
          <Check name="physicallyReturned" label={isCompact ? "ยืนยันว่าเงินที่นำออกไปจัดการครบแล้ว (ฝากธนาคารแล้ว และเงินที่เหลือถ้ามีคืนเข้าร้านแล้ว)" : "นำเศษเข้าเก๊ะและยอดคืนกองรอฝากกลับเข้าร้านแล้ว เงินที่นำออกได้รับการจัดการครบ"} />
        </CashForm>
      </div></details>
      <details className="border-t border-border pt-2"><summary className={`${SUMMARY} text-sm text-danger`}>ยกเลิกและคืนเงินทั้งหมด</summary><div className="mt-3"><CashForm action="return" epoch={status.epoch} fields={{ handoverId: item.id }} label="ยืนยันคืนเงินทั้งหมด">
        <Field name="reason" label="เหตุผลที่ไม่นำฝาก" /><Check name="physicallyReturned" label="คืนเงินทั้งหมดเข้ากองเงินรอฝากในร้านแล้ว ยังไม่มีการฝากธนาคาร" />
      </CashForm></div></details>
    </>}
    {item.bank !== null && <p className="text-sm tabular-nums">ฝาก ฿{formatMoney(item.bank)} · เข้าเก๊ะ ฿{formatMoney(item.drawer ?? "0")} · คืนรอฝาก ฿{formatMoney(item.returned ?? "0")}</p>}
    {item.reviewNote && <p className={`${NOTE} ${item.state === "disputed" ? "bg-danger-bg text-danger" : ""}`}>หมายเหตุตรวจ: {item.reviewNote}</p>}
    {item.evidencePath && <div className="flex flex-wrap gap-x-4"><button className={TEXT_LINK} disabled={isBusy} onClick={viewEvidence}>เปิดหลักฐานส่วนตัว</button>{url && <a className={TEXT_LINK} href={url} target="_blank" rel="noopener noreferrer">ดูหลักฐาน (ลิงก์อายุ 1 นาที)</a>}</div>}
    {item.snapshot && <button className={TEXT_LINK} disabled={isBusy} onClick={resend}>ส่งสรุปเดิมเข้า LINE อีกครั้ง</button>}
    {item.state === "disputed" && <details open={isCompact || undefined}><summary className={SUMMARY}>ส่งหลักฐานใหม่</summary><div className="mt-3"><CashForm action="evidence" epoch={status.epoch} fields={{ handoverId: item.id }} uploadHandOver={item.id} label={isCompact ? "ส่งสรุปเข้า LINE" : "ส่งหลักฐานแก้ไข"}>
      <Field name="reason" label="รายละเอียดที่แก้ไข" /><label className="text-sm font-semibold">หลักฐานใหม่<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className={FILE_INPUT} /></label>
    </CashForm></div></details>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </article>;
}
