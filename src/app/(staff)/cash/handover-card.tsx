"use client";

import { useState } from "react";
import type { CashHandover, CashStatus } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";
import CashForm, { Check, Field } from "./cash-form";
import { evidenceUrl, resendCashSnapshot } from "./actions";

const states = { handed_over: "อยู่กับผู้นำฝาก", reported: "แจ้งฝากแล้ว รอตรวจ", confirmed: "เจ้าของยืนยันแล้ว", disputed: "หลักฐานต้องแก้ไข", returned: "คืนเงินเข้าร้านแล้ว" };

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
  return <article className="ucom-surface space-y-3 p-4">
    <div><h3 className="font-bold">{item.custodian} · ฿{formatMoney(item.amount)}</h3><p className="text-sm text-ink-muted">{states[item.state]} · {new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p></div>
    {item.selectedTotal && <p className="text-sm">เงินที่เลือกจากวันที่ ฿{formatMoney(item.selectedTotal)} · เข้าเก๊ะก่อนออก ฿{formatMoney(item.drawerBeforeDeparture ?? "0")} · นำออกไปฝาก ฿{formatMoney(item.bankBound ?? item.amount)}</p>}
    {item.selectedLines?.map(line => <p key={line.key} className="text-xs text-ink-muted">{line.receiptDay ?? "ยอดไม่ทราบวัน"} · ฿{formatMoney(line.amount)}</p>)}
    {item.state === "handed_over" && <>
      <details open={isCompact || undefined}><summary className="cursor-pointer text-sm font-semibold">แจ้งฝากและแนบสลิป</summary><div className="mt-3">
        <CashForm action="settle" epoch={status.epoch} fields={{ handoverId: item.id }} uploadHandOver={item.id} label={isCompact ? "ส่งสรุปเข้า LINE" : "ยืนยันแจ้งฝาก"}>
          <p className="text-sm">ยอดฝาก + เงินคืนเข้าเก๊ะเพิ่ม + คืนกองรอฝาก ต้องเท่ากับ ฿{formatMoney(item.amount)} เศษก่อนออกเข้าร้านแล้ว ไม่ต้องนับซ้ำ</p>
          <Field name="bank" type="number" label="ฝากธนาคารจริง (บาท)" value={isCompact ? item.bankBound ?? item.amount : undefined} />
          {isCompact ? <details><summary className="cursor-pointer text-sm">เงินเหลือกลับร้าน</summary><div className="mt-3 space-y-3"><Field name="drawer" type="number" label="เงินคืนเข้าเก๊ะเพิ่มหลังนำออก (บาท)" value="0" /><Field name="returned" type="number" label="คืนกองรอฝาก (บาท)" value="0" /></div></details>
            : <><Field name="drawer" type="number" label="เงินคืนเข้าเก๊ะเพิ่มหลังนำออก (บาท)" value="0" /><Field name="returned" type="number" label="คืนกองรอฝาก (บาท)" value="0" /></>}
          <Field name="depositedAt" type="datetime-local" label="วันและเวลาที่ฝากจริง (เวลาไทย)" />
          <label className="text-sm">หลักฐานฝากเงิน<input className="mt-1 block w-full text-sm" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label>
          <Check name="physicallyReturned" label="นำเศษเข้าเก๊ะและยอดคืนกองรอฝากกลับเข้าร้านแล้ว เงินที่นำออกได้รับการจัดการครบ" />
        </CashForm>
      </div></details>
      <details><summary className="cursor-pointer text-sm">ยกเลิกและคืนเงินทั้งหมด</summary><div className="mt-3"><CashForm action="return" epoch={status.epoch} fields={{ handoverId: item.id }} label="ยืนยันคืนเงินทั้งหมด">
        <Field name="reason" label="เหตุผลที่ไม่นำฝาก" /><Check name="physicallyReturned" label="คืนเงินทั้งหมดเข้ากองรอฝากที่ร้านแล้ว ยังไม่มีการฝากธนาคาร" />
      </CashForm></div></details>
    </>}
    {item.bank !== null && <p className="text-sm">ฝาก ฿{formatMoney(item.bank)} · เข้าเก๊ะ ฿{formatMoney(item.drawer ?? "0")} · คืนรอฝาก ฿{formatMoney(item.returned ?? "0")}</p>}
    {item.reviewNote && <p className="text-sm">หมายเหตุตรวจ: {item.reviewNote}</p>}
    {item.evidencePath && <div className="flex flex-wrap gap-3"><button className="text-sm underline" disabled={isBusy} onClick={viewEvidence}>เปิดหลักฐานส่วนตัว</button>{url && <a className="text-sm underline" href={url} target="_blank" rel="noopener noreferrer">ดูหลักฐาน (ลิงก์อายุ 1 นาที)</a>}</div>}
    {item.snapshot && <button className="text-sm underline" disabled={isBusy} onClick={resend}>ส่งสรุปเดิมเข้า LINE อีกครั้ง</button>}
    {!isCompact && status.isOwner && ["reported", "disputed"].includes(item.state) && <details><summary className="cursor-pointer text-sm font-semibold">เจ้าของตรวจหลักฐาน</summary><div className="mt-3"><CashForm action="review" epoch={status.epoch} fields={{ handoverId: item.id }} label="บันทึกผลตรวจ">
      <label className="text-sm">ผลตรวจ<select name="confirmed" className="ucom-field ml-2 p-2"><option value="true">ยืนยัน</option><option value="false">ขอแก้หลักฐาน</option></select></label>
      <Field name="reason" label="บันทึกผลตรวจ" /><Check name="confirmedInput" label="ตรวจหลักฐานและรายการธนาคารแล้ว" />
    </CashForm></div></details>}
    {item.state === "disputed" && <details open={isCompact || undefined}><summary className="cursor-pointer text-sm font-semibold">ส่งหลักฐานใหม่</summary><div className="mt-3"><CashForm action="evidence" epoch={status.epoch} fields={{ handoverId: item.id }} uploadHandOver={item.id} label={isCompact ? "ส่งสรุปเข้า LINE" : "ส่งหลักฐานแก้ไข"}>
      <Field name="reason" label="รายละเอียดที่แก้ไข" /><label className="text-sm">หลักฐานใหม่<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="mt-1 block w-full" /></label>
    </CashForm></div></details>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </article>;
}
