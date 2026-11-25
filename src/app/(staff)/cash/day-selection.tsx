"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CashDayLine, CashDayPage, CashStatus } from "@/lib/cash/types";
import type { Json } from "@/lib/types/database";
import { formatMoney, moneyCents } from "@/lib/cash/money";
import { lineDayLabel, selectionAmounts } from "@/lib/cash/day-selection";
import CashForm, { Check, Field } from "./cash-form";
import { ALERT, FIELD_LABEL } from "./cash-styles";

export default function DaySelection({ status, userName, isCompact = false }: { status: CashStatus; userName?: string; isCompact?: boolean }) {
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
  let selectionProblem = "";
  try { summary = selectionAmounts(lines, keys, drawer); } catch (failure) { selectionProblem = keys.length ? (failure as Error).message : "เลือกวันที่จะนำฝากอย่างน้อย 1 วัน"; }
  // "ทุกวัน" = every dated line; unknown-day batches (opening/reconciliation) stay a deliberate manual choice.
  const datedKeys = lines.filter(line => line.receiptDay && moneyCents(line.available) > BigInt(0)).map(line => line.key);
  const isAllSelected = datedKeys.length > 0 && datedKeys.every(key => keys.includes(key));
  const canSubmit = isLoaded && Boolean(summary) && status.dayAllocationsEnabled === true;
  return <div className="space-y-3" data-testid="cash-day-selection">
    {error ? <p role="alert" className={ALERT}>{error}</p> : !isLoaded && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดเงินค้างฝากทุกวัน…</p>}
    {isCompact && isLoaded && lines.length === 0 && <p role="status" className="text-sm text-muted-foreground">ยังไม่มีเงินค้างฝากให้เลือก กรุณาตรวจยอดกับเจ้าของร้าน</p>}
    {isLoaded && datedKeys.length > 1 && <button type="button" className="ucom-secondary px-4" onClick={() => setKeys(isAllSelected ? keys.filter(key => !datedKeys.includes(key)) : [...keys, ...datedKeys.filter(key => !keys.includes(key))])}>{isAllSelected ? "ล้างวันที่เลือก" : "เลือกทุกวัน"}</button>}
    {isLoaded && lines.map(line => <label key={line.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60 ${keys.includes(line.key) ? "border-primary/40 bg-accent" : "border-transparent bg-muted"}`}>
      <input type="checkbox" className="size-5 shrink-0 accent-primary" data-testid={`cash-day-${line.key}`} checked={keys.includes(line.key)} disabled={moneyCents(line.available) <= BigInt(0)} onChange={event => setKeys(event.target.checked ? [...keys, line.key] : keys.filter(key => key !== line.key))} />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{lineDayLabel(line)}</span>{(!isCompact || moneyCents(line.reserved) > BigInt(0)) && <span className="block text-muted-foreground tabular-nums">กำลังไปฝาก ฿{formatMoney(line.reserved)}</span>}</span>
      <span className="shrink-0 text-right tabular-nums">{!isCompact && <span className="block text-muted-foreground">พร้อมนำฝาก</span>}<span className="block text-lg font-bold">฿{formatMoney(line.available)}</span></span>
    </label>)}
    <label className={FIELD_LABEL}>{isCompact ? "แยกเข้าเก๊ะ (บาท)" : "เศษเข้าเก๊ะก่อนออกจากร้าน (บาท)"}<input className="ucom-field h-12 px-4 text-base font-normal tabular-nums" inputMode="decimal" value={drawer} onChange={event => setDrawer(event.target.value)} /></label>
    {summary && <div className="space-y-1 rounded-xl bg-muted px-4 py-3 text-sm tabular-nums" data-testid="cash-bank-bound">
      <p className="flex justify-between gap-3"><span className="text-muted-foreground">เงินที่เลือก</span><span>฿{formatMoney(summary.selectedTotal)}</span></p>
      <p className="flex justify-between gap-3"><span className="text-muted-foreground">{isCompact ? "แยกเข้าเก๊ะ" : "เข้าเก๊ะก่อนออก"}</span><span>฿{formatMoney(drawer)}</span></p>
      <p className="flex items-baseline justify-between gap-3 border-t border-dashed border-border pt-2"><span className="font-semibold">นำออกไปฝาก</span><span className="text-2xl font-bold text-primary">฿{formatMoney(summary.bankBound)}</span></p>
    </div>}
    <CashForm action="handover_days" epoch={status.epoch} fields={{ version: status.version, lines: summary?.lines ?? [], drawerBeforeDeparture: drawer }} isDisabled={!canSubmit} disabledReason={isLoaded ? selectionProblem : undefined} label="ยืนยันนำเงินออกไปฝาก">
      <Field name="custodian" label="ผู้ถือเงินไปฝาก" value={userName} />
      <Check name="drawerPhysicallySeparated" label="แยกเศษเข้าเก๊ะแล้ว และตรวจเงินที่จะนำออกไปฝากตามยอดข้างต้นแล้ว" />
    </CashForm>
  </div>;
}
