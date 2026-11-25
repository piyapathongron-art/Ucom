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
import { PageFrame } from "@/app/_components/PageFrame";
import { ALERT, CARD, SUMMARY } from "./cash-styles";

// Owner page, in the order the owner works: review slips → balances → money out → new deposit → history → tools.
export default function CashOverview({ status, userName, focusedHandover, focusError }: { status: CashStatus; userName?: string; focusedHandover?: CashHandover | null; focusError?: string }) {
  const isReviewable = (item: CashHandover) => item.state === "reported" || item.state === "disputed";
  const toReview = status.handovers.filter(isReviewable);
  // A LINE link can point at a handover older than the recent list the status carries.
  if (focusedHandover && isReviewable(focusedHandover) && !toReview.some(item => item.id === focusedHandover.id)) toReview.unshift(focusedHandover);
  const moneyOut = status.handovers.filter(item => item.state === "handed_over");
  const funds = [["เงินเก๊ะ", status.drawer], ["เงินรอฝากในร้าน", status.available], ...(moneyCents(status.reserved) > BigInt(0) ? [["กำลังไปฝาก", status.reserved]] : [])];
  return <PageFrame page="cash" title="เงินสดร้าน" description={status.epoch ? `ยอด ณ ${new Date(status.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}` : undefined} className="max-w-4xl" actions={<Link href="/close-day" className="ucom-secondary h-11 px-5">ปิดร้าน</Link>}>
    <CashRecovery />
    {focusError && <p role="alert" className={ALERT}>{focusError}</p>}
    {focusedHandover && !isReviewable(focusedHandover) && <section className="space-y-3"><h2 className="text-lg font-bold">รายการจากลิงก์ LINE</h2><HandoverCard item={focusedHandover} status={status} /></section>}
    {status.epoch ? <>
      {toReview.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold tabular-nums">ต้องตรวจ ({toReview.length})</h2>
        {toReview.map(item => <ReviewCard key={`${item.id}:${item.state}`} item={item} status={status} />)}
      </section>}
      <section aria-label="ยอดเงิน">
        <div className={`grid gap-3 ${funds.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {funds.map(([label, amount]) => <div key={label} className={label === "กำลังไปฝาก" ? "rounded-xl bg-warning-bg p-5 text-warning" : CARD}><p className={`text-sm ${label === "กำลังไปฝาก" ? "" : "text-muted-foreground"}`}>{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">฿{formatMoney(amount)}</p></div>)}
        </div>
      </section>
      {moneyOut.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold">แจ้งผลเงินที่นำออกไปฝาก</h2>
        {moneyOut.map(item => <HandoverCard key={item.id} item={item} status={status} />)}
      </section>}
      {moneyOut.length === 0 && <details className={CARD}><summary className={`${SUMMARY} text-lg font-bold`}>นำเงินไปฝาก</summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">บันทึกก่อนหยิบเงินออกจากร้าน ระบบกันยอดนี้ไว้จนแจ้งฝากหรือคืนเงินจริง</p>
          {status.dayAllocationsEnabled ? <DaySelection key={`${status.epoch}:${status.version}`} status={status} userName={userName} /> : <p role="alert" className={ALERT}>ยังไม่เปิดระบบเลือกวัน กรุณาให้เจ้าของตรวจการย้ายยอดก่อนนำเงินออก</p>}
        </div>
      </details>}
      <CashHistory movements={status.movements} handovers={status.handovers} />
    </> : <p className={CARD}>ยังไม่เปิดระบบสองกองเงิน เจ้าของต้องตรวจคิวและนับยอดตั้งต้นก่อน</p>}
    <OwnerControls status={status} />
  </PageFrame>;
}
