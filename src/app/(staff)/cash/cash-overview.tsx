"use client";

import Link from "next/link";
import type { CashStatus, CashHandover } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";
import DaySelection from "./day-selection";
import CashRecovery from "./cash-recovery";
import OwnerControls from "./owner-controls";
import HandoverCard from "./handover-card";

const movementNames: Record<string, string> = { posting: "รับ/จ่ายเงิน", opening: "ยอดตั้งต้น", handover: "นำเงินออกไปฝาก", settle: "ฝากธนาคาร", return: "คืนเงินเข้าร้าน", reconciliation: "ปรับยอดจากการนับ", refund: "คืนเงินจริง", correction: "แก้รายการ" };

export default function CashOverview({ status, userName, focusedHandover, focusError }: { status: CashStatus; userName?: string; focusedHandover?: CashHandover | null; focusError?: string }) {
  return <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
    <header className="flex items-center justify-between"><h1 className="text-xl font-bold">เงินสดร้าน</h1><Link href="/close-day" className="text-sm underline">ปิดร้าน</Link></header>
    <p className="text-xs text-ink-muted">ยอด ณ {new Date(status.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
    <CashRecovery />
    {focusError && <p role="alert">{focusError}</p>}
    {focusedHandover && <section><h2 className="mb-2 font-bold">รายการจากลิงก์ LINE</h2><HandoverCard item={focusedHandover} status={status} /></section>}
    {status.epoch ? <>
      <section className="grid grid-cols-2 gap-3" aria-label="ยอดเงินสองกอง">
        {[ ["เงินเก๊ะ", status.drawer], ["เงินรอฝาก", status.pending], ["กำลังไปฝาก", status.reserved], ["เงินรอฝากในร้าน", status.available] ].map(([label, amount]) => <div key={label} className="ucom-surface p-4"><p className="text-xs text-ink-muted">{label}</p><p className="mt-2 text-lg font-bold">฿{formatMoney(amount)}</p></div>)}
      </section>
      <section className="ucom-surface p-4"><h2 className="mb-3 font-bold">นำเงินไปฝาก</h2>
        <p className="mb-3 text-sm text-ink-muted">บันทึกก่อนหยิบเงินออกจากร้าน ระบบกันยอดนี้ไว้จนแจ้งฝากหรือคืนเงินจริง</p>
        {status.dayAllocationsEnabled ? <DaySelection key={`${status.epoch}:${status.version}`} status={status} userName={userName} /> : <p role="alert">ยังไม่เปิดระบบเลือกวัน กรุณาให้เจ้าของตรวจการย้ายยอดก่อนนำเงินออก</p>}
      </section>
      <section className="space-y-3"><h2 className="font-bold">รายการนำฝาก</h2>
        {status.handovers.length ? status.handovers.map(item => <HandoverCard key={item.id} item={item} status={status} />) : <p className="ucom-surface p-4 text-sm text-ink-muted">ยังไม่มีรายการนำฝาก</p>}
      </section>
      <section className="ucom-surface p-4"><h2 className="mb-3 font-bold">ความเคลื่อนไหวล่าสุด</h2><div className="space-y-2">
        {status.movements.length ? status.movements.map(item => <div key={item.id} className="border-b border-line pb-2 text-sm"><p>{item.fund === "drawer" ? "เงินเก๊ะ" : "เงินรอฝาก"} · {formatMoney(item.amount)} บาท · {movementNames[item.kind] ?? "ความเคลื่อนไหวเงินสด"}</p><p className="text-xs text-ink-muted">{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · {item.reason}</p></div>) : <p className="text-sm text-ink-muted">ยังไม่มีความเคลื่อนไหว</p>}
      </div></section>
    </> : <p className="ucom-surface p-4">ยังไม่เปิดระบบสองกองเงิน เจ้าของต้องตรวจคิวและนับยอดตั้งต้นก่อน</p>}
    <OwnerControls status={status} />
  </main>;
}
