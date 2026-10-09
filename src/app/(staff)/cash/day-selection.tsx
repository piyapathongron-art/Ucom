"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashDayLine, CashDayPage, CashStatus } from "@/lib/cash/types";
import type { Json } from "@/lib/types/database";
import { formatMoney, moneyCents } from "@/lib/cash/money";
import { selectionAmounts } from "@/lib/cash/day-selection";
import CashForm, { Check, Field } from "./cash-form";

export default function DaySelection({ status }: { status: CashStatus }) {
  const [lines, setLines] = useState<CashDayLine[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [drawer, setDrawer] = useState("0");
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let isCancelled = false;
    Promise.resolve().then(() => { if (!isCancelled) { setIsLoaded(false); setKeys([]); setLines([]); setError(""); } });
    const load = async () => {
      const all: CashDayLine[] = []; let cursor: Json | null = null; const seen = new Set<string>(); const cursors = new Set<string>();
      do {
        const { data, error: failure } = await createClient().rpc("rpc_cash_pending_days", { p_version: status.version, p_after: cursor, p_limit: 100 });
        if (failure) throw new Error("ยอดเปลี่ยนหรือโหลดรายการวันไม่ได้ กรุณารีเฟรชและเลือกใหม่");
        const page = data as unknown as CashDayPage;
        if (!page || page.epoch !== status.epoch || page.version !== status.version || !Array.isArray(page.lines)) throw new Error("รายการวันไม่ตรงกับยอดล่าสุด กรุณารีเฟรช");
        for (const line of page.lines) {
          if (typeof line.key !== "string" || seen.has(line.key) || !["date", "opening", "reconciliation"].includes(line.kind) || (line.receiptDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(line.receiptDay)) || typeof line.available !== "string" || typeof line.reserved !== "string" || moneyCents(line.available) < BigInt(0) || moneyCents(line.reserved) < BigInt(0)) throw new Error("รายการวันไม่ถูกต้อง กรุณารีเฟรช");
          seen.add(line.key); all.push(line);
        }
        cursor = page.nextCursor;
        if (cursor !== null) {
          const signature = JSON.stringify(cursor);
          if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || cursor.epoch !== status.epoch || cursor.version !== status.version || typeof cursor.key !== "string" || cursors.has(signature)) throw new Error("อ่านหน้ารายการวันต่อไม่ได้ กรุณารีเฟรช");
          cursors.add(signature);
        }
      } while (cursor !== null);
      return all;
    };
    load().then(all => { if (!isCancelled) { setLines(all); setIsLoaded(true); } }).catch(failure => { if (!isCancelled) setError(failure.message); });
    return () => { isCancelled = true; };
  }, [status.epoch, status.version]);
  let summary: ReturnType<typeof selectionAmounts> | null = null;
  try { summary = selectionAmounts(lines, keys, drawer); } catch { /* Empty/invalid selection cannot dispatch. */ }
  const canSubmit = isLoaded && Boolean(summary) && status.isReceivingPaused && status.ackVersion === status.version && status.dayAllocationsEnabled === true;
  return <div className="space-y-3" data-testid="cash-day-selection">
    {error ? <p role="alert">{error}</p> : !isLoaded && <p role="status">กำลังโหลดเงินค้างฝากทุกวัน…</p>}
    {isLoaded && lines.map(line => <label key={line.key} className="flex items-start gap-2 rounded border border-line p-3 text-sm">
      <input type="checkbox" data-testid={`cash-day-${line.key}`} checked={keys.includes(line.key)} disabled={moneyCents(line.available) <= BigInt(0)} onChange={event => setKeys(event.target.checked ? [...keys, line.key] : keys.filter(key => key !== line.key))} />
      <span>{line.receiptDay ?? (line.kind === "opening" ? "ยอดตั้งต้นไม่ทราบวัน" : "ยอดปรับจากการนับไม่ทราบวัน")} · พร้อมนำฝาก ฿{formatMoney(line.available)} · อยู่กับผู้นำฝาก ฿{formatMoney(line.reserved)}</span>
    </label>)}
    <label className="flex flex-col gap-1 text-sm">เศษเข้าเก๊ะก่อนออกจากร้าน (บาท)<input className="ucom-field p-2" inputMode="decimal" value={drawer} onChange={event => setDrawer(event.target.value)} /></label>
    {summary && <p data-testid="cash-bank-bound" className="text-sm font-semibold">เงินที่เลือก ฿{formatMoney(summary.selectedTotal)} · เข้าเก๊ะก่อนออก ฿{formatMoney(drawer)} · นำออกไปฝาก ฿{formatMoney(summary.bankBound)}</p>}
    <CashForm key={`${keys.join(",")}:${drawer}`} action="handover_days" epoch={status.epoch} fields={{ version: status.version, lines: summary?.lines ?? [], drawerBeforeDeparture: drawer }} isDisabled={!canSubmit} label="ยืนยันนำเงินออกไปฝาก">
      <Field name="custodian" label="ผู้ถือเงินไปฝาก" />
      <Check name="drawerPhysicallySeparated" label="แยกเศษเข้าเก๊ะแล้ว และตรวจเงินที่จะนำออกไปฝากตามยอดข้างต้นแล้ว" />
    </CashForm>
  </div>;
}
