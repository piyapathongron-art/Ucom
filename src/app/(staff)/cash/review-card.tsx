"use client";

import { useEffect, useState } from "react";
import type { CashHandover, CashStatus } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";
import { lineDayLabel } from "@/lib/cash/day-selection";
import { Modal } from "@/app/_components/Modal";
import CashForm, { Check, Field } from "./cash-form";
import { evidenceUrl } from "./actions";

function EvidencePreview({ handoverId, path }: { handoverId: string; path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isFailed, setIsFailed] = useState(false);
  useEffect(() => {
    let isCancelled = false;
    if (path) evidenceUrl(handoverId).then(
      signed => { if (isCancelled) return; if (signed) setUrl(signed); else setIsFailed(true); },
      () => { if (!isCancelled) setIsFailed(true); },
    );
    return () => { isCancelled = true; };
  }, [handoverId, path]);
  if (!path) return <p className="text-sm text-warning">ยังไม่มีหลักฐาน</p>;
  if (isFailed) return <p className="text-sm text-warning">เปิดสลิปไม่ได้ ลองรีเฟรชหน้านี้</p>;
  if (!url) return <p className="text-sm text-ink-muted">กำลังโหลดสลิป…</p>;
  // ponytail: short-lived signed URL, so a plain <img> instead of next/image — add remotePatterns only if resizing is ever needed
  return /\.pdf$/i.test(path)
    ? <a className="text-sm underline" href={url} target="_blank" rel="noopener noreferrer">เปิดสลิป (PDF)</a>
    // eslint-disable-next-line @next/next/no-img-element
    : <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="สลิปฝากเงิน" className="max-h-96 w-full rounded-lg bg-sunken object-contain" /></a>;
}

// Parent keys this card by `${id}:${state}` so the popup closes itself once the review moves the handover on.
export default function ReviewCard({ item, status }: { item: CashHandover; status: CashStatus }) {
  const [decision, setDecision] = useState<"approve" | "dispute" | null>(null);
  const isWaitingStaff = item.state === "disputed";
  const close = () => setDecision(null);
  return <article className="ucom-surface space-y-3 p-4">
    <div>
      <h3 className="font-bold">{item.custodian} · ฿{formatMoney(item.amount)}</h3>
      <p className="text-sm text-ink-muted">{isWaitingStaff ? "รอพนักงานส่งหลักฐานใหม่" : "แจ้งฝากแล้ว รอตรวจ"} · {new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
    </div>
    {item.selectedLines && <p className="text-xs text-ink-muted">{item.selectedLines.map(line => `${line.receiptDay ? lineDayLabel({ receiptDay: line.receiptDay, kind: "date" }) : "ยอดไม่ทราบวัน"} ฿${formatMoney(line.amount)}`).join(" · ")}</p>}
    {item.bank !== null && <p className="text-sm">ฝาก ฿{formatMoney(item.bank)} · เข้าเก๊ะ ฿{formatMoney(item.drawer ?? "0")} · คืนเงินรอฝาก ฿{formatMoney(item.returned ?? "0")}</p>}
    {item.reviewNote && <p className="text-sm">หมายเหตุตรวจ: {item.reviewNote}</p>}
    <EvidencePreview handoverId={item.id} path={item.evidencePath} />
    {!isWaitingStaff && <div className="flex gap-3">
      <button type="button" className="ucom-primary flex-1 px-4 py-2.5" onClick={() => setDecision("approve")}>ถูกต้อง</button>
      <button type="button" className="ucom-secondary flex-1 px-4 py-2.5" onClick={() => setDecision("dispute")}>ขอแก้หลักฐาน</button>
    </div>}
    {decision && <Modal open onClose={close} title={decision === "approve" ? "ยืนยันว่าสลิปถูกต้อง" : "ขอให้แก้หลักฐาน"}
      footer={<button type="button" className="ucom-secondary px-4 py-2" onClick={close}>ยกเลิก</button>}>
      <p className="text-sm">{item.custodian} · ฝาก ฿{formatMoney(item.bank ?? item.amount)}</p>
      <CashForm action="review" epoch={status.epoch}
        fields={decision === "approve" ? { handoverId: item.id, confirmed: true, reason: "ตรวจแล้วถูกต้อง" } : { handoverId: item.id, confirmed: false }}
        label={decision === "approve" ? "ยืนยันว่าถูกต้อง" : "ส่งกลับให้แก้"}>
        {decision === "dispute" && <Field name="reason" label="ต้องแก้อะไร (พนักงานจะเห็นข้อความนี้)" />}
        <Check name="confirmedInput" label="ตรวจสลิปและรายการธนาคารแล้ว" />
      </CashForm>
    </Modal>}
  </article>;
}
