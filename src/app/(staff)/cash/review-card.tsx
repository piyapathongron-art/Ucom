"use client";

import { useEffect, useState } from "react";
import type { CashHandover, CashStatus } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";
import { lineDayLabel } from "@/lib/cash/day-selection";
import { Modal } from "@/app/_components/Modal";
import CashForm, { Check, Field } from "./cash-form";
import { evidenceUrl } from "./actions";
import { CARD, HANDOVER_CHIP, NOTE, TEXT_LINK, chip } from "./cash-styles";

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
  if (!path) return <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">ยังไม่มีหลักฐาน</p>;
  if (isFailed) return <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">เปิดสลิปไม่ได้ ลองรีเฟรชหน้านี้</p>;
  if (!url) return <p className="flex h-40 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">กำลังโหลดสลิป…</p>;
  // ponytail: short-lived signed URL, so a plain <img> instead of next/image — add remotePatterns only if resizing is ever needed
  return /\.pdf$/i.test(path)
    ? <a className={TEXT_LINK} href={url} target="_blank" rel="noopener noreferrer">เปิดสลิป (PDF)</a>
    // eslint-disable-next-line @next/next/no-img-element
    : <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="สลิปฝากเงิน" className="max-h-96 w-full rounded-xl bg-muted object-contain" /></a>;
}

// Parent keys this card by `${id}:${state}` so the popup closes itself once the review moves the handover on.
export default function ReviewCard({ item, status }: { item: CashHandover; status: CashStatus }) {
  const [decision, setDecision] = useState<"approve" | "dispute" | null>(null);
  const isWaitingStaff = item.state === "disputed";
  const close = () => setDecision(null);
  return <article className={`${CARD} space-y-3 ${isWaitingStaff ? "" : "ring-2 ring-primary/30"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-bold tabular-nums">{item.custodian} · ฿{formatMoney(item.amount)}</h3>
        <p className="text-sm text-muted-foreground tabular-nums">{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
      </div>
      <span className={chip(HANDOVER_CHIP[item.state])}>{isWaitingStaff ? "รอพนักงานส่งหลักฐานใหม่" : "แจ้งฝากแล้ว รอตรวจ"}</span>
    </div>
    {item.selectedLines && <p className="text-sm text-muted-foreground tabular-nums">{item.selectedLines.map(line => `${line.receiptDay ? lineDayLabel({ receiptDay: line.receiptDay, kind: "date" }) : "ยอดไม่ทราบวัน"} ฿${formatMoney(line.amount)}`).join(" · ")}</p>}
    {item.bank !== null && <p className={`${NOTE} tabular-nums`}>ฝาก ฿{formatMoney(item.bank)} · เข้าเก๊ะ ฿{formatMoney(item.drawer ?? "0")} · คืนเงินรอฝาก ฿{formatMoney(item.returned ?? "0")}</p>}
    {item.reviewNote && <p className={NOTE}>หมายเหตุตรวจ: {item.reviewNote}</p>}
    <EvidencePreview handoverId={item.id} path={item.evidencePath} />
    {!isWaitingStaff && <div className="flex gap-3">
      <button type="button" className="ucom-primary h-12 flex-1 px-5" onClick={() => setDecision("approve")}>ถูกต้อง</button>
      <button type="button" className="ucom-danger h-12 flex-1 px-5" onClick={() => setDecision("dispute")}>ขอแก้หลักฐาน</button>
    </div>}
    {decision && <Modal open onClose={close} title={decision === "approve" ? "ยืนยันว่าสลิปถูกต้อง" : "ขอให้แก้หลักฐาน"}
      footer={<button type="button" className="ucom-secondary h-12 px-6" onClick={close}>ยกเลิก</button>}>
      <p className="font-semibold tabular-nums">{item.custodian} · ฝาก ฿{formatMoney(item.bank ?? item.amount)}</p>
      <CashForm action="review" epoch={status.epoch}
        fields={decision === "approve" ? { handoverId: item.id, confirmed: true, reason: "ตรวจแล้วถูกต้อง" } : { handoverId: item.id, confirmed: false }}
        label={decision === "approve" ? "ยืนยันว่าถูกต้อง" : "ส่งกลับให้แก้"}>
        {decision === "dispute" && <Field name="reason" label="ต้องแก้อะไร (พนักงานจะเห็นข้อความนี้)" />}
        <Check name="confirmedInput" label="ตรวจสลิปและรายการธนาคารแล้ว" />
      </CashForm>
    </Modal>}
  </article>;
}
