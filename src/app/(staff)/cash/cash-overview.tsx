"use client";

import Link from "next/link";
import type { CashStatus, CashHandover } from "@/lib/cash/types";
import { formatMoney, moneyCents } from "@/lib/cash/money";
import DaySelection from "./day-selection";
import CashRecovery from "./cash-recovery";
import CashHistory from "./cash-history";
import OwnerControls from "./owner-controls";
import HandoverCard from "./handover-card";
import ReviewCard from "./review-card";

// Owner page, in the order the owner works: review slips → balances → money out → new deposit → history → tools.
export default function CashOverview({ status, userName, focusedHandover, focusError }: { status: CashStatus; userName?: string; focusedHandover?: CashHandover | null; focusError?: string }) {
  const isReviewable = (item: CashHandover) => item.state === "reported" || item.state === "disputed";
  const toReview = status.handovers.filter(isReviewable);
  // A LINE link can point at a handover older than the recent list the status carries.
  if (focusedHandover && isReviewable(focusedHandover) && !toReview.some(item => item.id === focusedHandover.id)) toReview.unshift(focusedHandover);
  const moneyOut = status.handovers.filter(item => item.state === "handed_over");
  const funds = [["เงินเก๊ะ", status.drawer], ["เงินรอฝากในร้าน", status.available], ...(moneyCents(status.reserved) > BigInt(0) ? [["กำลังไปฝาก", status.reserved]] : [])];
  return <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
    <header className="flex items-center justify-between"><h1 className="text-xl font-bold">เงินสดร้าน</h1><Link href="/close-day" className="text-sm underline">ปิดร้าน</Link></header>
    <CashRecovery />
    {focusError && <p role="alert">{focusError}</p>}
    {focusedHandover && !isReviewable(focusedHandover) && <section><h2 className="mb-2 font-bold">รายการจากลิงก์ LINE</h2><HandoverCard item={focusedHandover} status={status} /></section>}
    {status.epoch ? <>
      {toReview.length > 0 && <section className="space-y-3"><h2 className="font-bold">ต้องตรวจ ({toReview.length})</h2>
        {toReview.map(item => <ReviewCard key={`${item.id}:${item.state}`} item={item} status={status} />)}
      </section>}
      <section aria-label="ยอดเงิน">
        <div className={`grid gap-3 ${funds.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {funds.map(([label, amount]) => <div key={label} className="ucom-surface p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-2 text-base font-bold md:text-lg">฿{formatMoney(amount)}</p></div>)}
        </div>
        <p className="mt-2 text-xs text-ink-muted">ยอด ณ {new Date(status.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
      </section>
      {moneyOut.length > 0 && <section className="space-y-3"><h2 className="font-bold">แจ้งผลเงินที่นำออกไปฝาก</h2>
        {moneyOut.map(item => <HandoverCard key={item.id} item={item} status={status} />)}
      </section>}
      {moneyOut.length === 0 && <details className="ucom-surface p-4"><summary className="cursor-pointer font-bold">นำเงินไปฝาก</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-muted">บันทึกก่อนหยิบเงินออกจากร้าน ระบบกันยอดนี้ไว้จนแจ้งฝากหรือคืนเงินจริง</p>
          {status.dayAllocationsEnabled ? <DaySelection key={`${status.epoch}:${status.version}`} status={status} userName={userName} /> : <p role="alert">ยังไม่เปิดระบบเลือกวัน กรุณาให้เจ้าของตรวจการย้ายยอดก่อนนำเงินออก</p>}
        </div>
      </details>}
      <CashHistory movements={status.movements} handovers={status.handovers} />
    </> : <p className="ucom-surface p-4">ยังไม่เปิดระบบสองกองเงิน เจ้าของต้องตรวจคิวและนับยอดตั้งต้นก่อน</p>}
    <OwnerControls status={status} />
  </main>;
}
