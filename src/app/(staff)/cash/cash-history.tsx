"use client";

import { useState } from "react";
import type { CashHandover, CashMovement } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";

const PAGE = 20;
const movementNames: Record<string, string> = { posting: "รับ/จ่ายเงิน", opening: "ยอดตั้งต้น", handover: "นำเงินออกไปฝาก", settle: "ฝากธนาคาร", return: "คืนเงินเข้าร้าน", reconciliation: "ปรับยอดจากการนับ", refund: "คืนเงินจริง", correction: "แก้รายการ" };
const doneStates: Record<string, string> = { confirmed: "เจ้าของยืนยันแล้ว", returned: "คืนเงินเข้าร้านแล้ว" };
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Shows the movements the status RPC already returns (latest 50), 20 at a time.
export default function CashHistory({ movements, handovers }: { movements: CashMovement[]; handovers: CashHandover[] }) {
  const [count, setCount] = useState(PAGE);
  const finished = handovers.filter(item => item.state in doneStates);
  return <details className="ucom-surface p-4">
    <summary className="cursor-pointer font-bold">ประวัติเงินสด</summary>
    <div className="mt-3 space-y-4">
      {finished.length > 0 && <div className="space-y-1">
        <h3 className="text-sm font-semibold">นำฝากที่เสร็จแล้ว</h3>
        {finished.map(item => <p key={item.id} className="text-sm text-ink-muted">{when(item.createdAt)} · {item.custodian} · ฿{formatMoney(item.amount)} · {doneStates[item.state]}</p>)}
      </div>}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">ความเคลื่อนไหว</h3>
        {movements.length ? movements.slice(0, count).map(item => {
          // "posting" is the generic kind for sales/expenses; its reason is the meaningful name.
          const title = item.kind === "posting" && item.reason ? item.reason : movementNames[item.kind] ?? "ความเคลื่อนไหวเงินสด";
          return <div key={item.id} className="border-b border-border pb-2 text-sm">
            <p className="flex justify-between gap-3"><span>{title} · {item.fund === "drawer" ? "เงินเก๊ะ" : "เงินรอฝาก"}</span><span className="font-semibold">{Number(item.amount) > 0 ? "+" : ""}{formatMoney(item.amount)}</span></p>
            <p className="text-xs text-ink-muted">{when(item.createdAt)}{item.reason && item.reason !== title ? ` · ${item.reason}` : ""}</p>
          </div>;
        }) : <p className="text-sm text-ink-muted">ยังไม่มีความเคลื่อนไหว</p>}
        {movements.length > count && <button type="button" className="ucom-secondary px-4 py-2 text-sm" onClick={() => setCount(count + PAGE)}>ดูเพิ่ม</button>}
      </div>
    </div>
  </details>;
}
