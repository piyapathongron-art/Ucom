"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { cashExecute, cashStatus, isDefiniteCashError } from "@/lib/cash/client";
import { formatMoney, parseMoney } from "@/lib/cash/money";
import type { CashStatus, CashSnapshot } from "@/lib/cash/types";
import { createClient } from "@/lib/supabase/client";
import { toThaiError } from "@/lib/errors";
import { sendCashClosing } from "./actions";
import { refreshCashOperations, withCashOperationLock } from "@/lib/cash/operations";

type CloseRequest = { id: string; epoch: string; submitted?: boolean; payload: { version: number; drawerCount: string; pendingCount: string; note: string } };

export default function CashClosing({ date, isToday, queuedCount }: { date: string; isToday: boolean; queuedCount: number }) {
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [drawerCount, setDrawerCount] = useState("");
  const [pendingCount, setPendingCount] = useState("");
  const [countVersion, setCountVersion] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<CashSnapshot[]>([]);
  const [note, setNote] = useState("");
  const [request, setRequest] = useState<CloseRequest | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = "ucom-cash-close-v1:" + date;

  useEffect(() => {
    let isCancelled = false;
    Promise.resolve().then(async () => {
      const saved = localStorage.getItem(key);
      const pending = saved ? JSON.parse(saved) as CloseRequest : null;
      const next = await cashStatus();
      const history = await createClient().rpc("rpc_cash_closing", { p_date: date });
      if (history.error || !Array.isArray(history.data)) throw new Error("โหลดประวัติการปิดร้านไม่สำเร็จ");
      if (isCancelled) return;
      setStatus(next); setSnapshots(history.data as CashSnapshot[]); setError(null);
      if (pending) {
        setRequest(pending); setDrawerCount(pending.payload.drawerCount);
        setPendingCount(pending.payload.pendingCount); setNote(pending.payload.note);
        setCountVersion(pending.payload.version);
      }
    }).catch(() => { if (!isCancelled) setError("ตรวจยอดล่าสุดไม่ได้ กรุณาเชื่อมต่อและลองใหม่"); });
    return () => { isCancelled = true; };
  }, [key, date]);

  async function refresh() {
    try {
      setStatus(await cashStatus());
      const history = await createClient().rpc("rpc_cash_closing", { p_date: date });
      if (history.error || !Array.isArray(history.data)) throw new Error("history unavailable");
      setSnapshots(history.data as CashSnapshot[]); setError(null);
    }
    catch { setError("ตรวจยอดล่าสุดไม่ได้ กรุณาเชื่อมต่อและลองใหม่"); }
  }

  async function review() {
    setIsBusy(true); setError(null);
    try {
      await withCashOperationLock(request?.id ?? null, async () => {
      if (refreshCashOperations().length) throw new Error("มีรายการเงินสดเดิมรอยืนยันผล กรุณาตรวจรายการเดิมก่อนปิดร้าน");
      if (request) { setIsConfirmOpen(true); return; }
      const next = await cashStatus();
      setStatus(next);
      if (!next.epoch) throw new Error("ระบบเงินสดยังไม่เปิดใช้งาน กรุณาโหลดหน้าใหม่");
      if (countVersion !== next.version) {
        setDrawerCount(""); setPendingCount(""); setCountVersion(null);
        throw new Error("ยอดระบบเปลี่ยนแล้ว กรุณานับเงินทั้งสองกองใหม่จากยอดล่าสุด");
      }
      if (!next.isReceivingPaused || next.ackVersion !== next.version || queuedCount > 0) throw new Error("ให้เครื่อง POS หลักส่งบิลค้างทั้งหมด แล้วกดหยุดรับเงินและยืนยันยอดล่าสุดก่อนปิดร้าน");
      const pending = { id: crypto.randomUUID(), epoch: next.epoch, payload: { version: next.version, drawerCount: parseMoney(drawerCount), pendingCount: parseMoney(pendingCount), note: note.trim() } };
      localStorage.setItem(key, JSON.stringify(pending));
      setRequest(pending); setIsConfirmOpen(true);
      });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ตรวจยอดไม่สำเร็จ"); }
    finally { setIsBusy(false); }
  }

  async function confirm() {
    if (!request) return;
    setIsBusy(true); setError(null);
    try {
      await withCashOperationLock(request.id, async () => {
      if (refreshCashOperations().length) throw new Error("มีรายการเงินสดเดิมรอยืนยันผล กรุณาตรวจรายการเดิมก่อนปิดร้าน");
      const submitted = { ...request, submitted: true };
      localStorage.setItem(key, JSON.stringify(submitted)); setRequest(submitted);
      const result = await cashExecute(request.id, request.epoch, "close", request.payload);
      if (result.error) {
        if (isDefiniteCashError(result.error)) {
          localStorage.removeItem(key); setRequest(null);
          if (result.error.code === "40001") { setDrawerCount(""); setPendingCount(""); setCountVersion(null); }
          await refresh();
        }
        setError(toThaiError(result.error));
        return;
      }
      localStorage.removeItem(key); setRequest(null); setIsConfirmOpen(false);
      setDrawerCount(""); setPendingCount(""); setCountVersion(null); setNote("");
      toast.success("บันทึกยอดนับสองกองแล้ว");
      await refresh();
      const sent = result.data?.snapshot ? await sendCashClosing(result.data.snapshot.id, request.id, result.data.snapshot.date ?? date) : false;
      if (!sent) toast.error("ปิดร้านแล้ว แต่ส่ง LINE ไม่สำเร็จ กดส่งสรุปอีกครั้งได้", { duration: Infinity });
      });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ยังตรวจผลรายการเดิมไม่ได้"); }
    finally { setIsBusy(false); }
  }

  function cancelReview() {
    setIsConfirmOpen(false);
    if (!request?.submitted) { localStorage.removeItem(key); setRequest(null); }
  }

  const latest = snapshots[0];
  return (
    <section className="ucom-surface space-y-4 p-6" data-testid="two-fund-closing">
      <h2 className="text-lg font-bold">เงินสดสองกอง</h2>
      {status && <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-ink-muted">เงินเก๊ะ</dt><dd className="font-semibold">฿{formatMoney(status.drawer)}</dd></div>
        <div><dt className="text-ink-muted">เงินรอฝาก</dt><dd className="font-semibold">฿{formatMoney(status.pending)}</dd></div>
        <div><dt className="text-ink-muted">กำลังไปฝาก</dt><dd>฿{formatMoney(status.reserved)}</dd></div>
        <div><dt className="text-ink-muted">เงินรอฝากในร้าน</dt><dd>฿{formatMoney(status.available)}</dd></div>
      </dl>}
      <p className="text-xs text-ink-muted">นับเฉพาะเงินที่อยู่ในร้าน ยอดที่ออกไปฝากแล้ว (กำลังไปฝาก) แสดงแยกต่างหาก</p>
      {isToday && <>
        <p className="text-sm text-ink-muted">{status?.isReceivingPaused && status.ackVersion === status.version ? "เครื่อง POS หยุดรับเงินและยืนยันยอดล่าสุดแล้ว" : "รอเครื่อง POS หลักส่งบิลและกดหยุดรับเงินเพื่อยืนยันยอดล่าสุด"} · <Link href="/pos" className="underline">เปิด POS</Link></p>
        <label className="block text-sm">เงินเก๊ะที่นับได้จริง<input disabled={Boolean(request) || isBusy || !status} data-testid="close-drawer-count" type="number" min="0" step="0.01" value={drawerCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setDrawerCount(event.target.value); }} className="ucom-field mt-1 w-full px-4 py-2.5" /></label>
        <label className="block text-sm">เงินรอฝากที่นับได้ในร้าน<input disabled={Boolean(request) || isBusy || !status} data-testid="close-pending-count" type="number" min="0" step="0.01" value={pendingCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setPendingCount(event.target.value); }} className="ucom-field mt-1 w-full px-4 py-2.5" /></label>
        <label className="block text-sm">หมายเหตุ<textarea disabled={Boolean(request) || isBusy} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} className="ucom-field mt-1 w-full px-4 py-2.5" /></label>
        <button type="button" data-testid="cash-close-review" disabled={isBusy || !status || queuedCount > 0} onClick={() => void review()} className="ucom-primary w-full px-4 py-3 disabled:opacity-50">{request ? "ลองยืนยันรายการเดิม" : latest ? "บันทึกยอดนับฉบับใหม่" : "ตรวจยอดและปิดร้าน"}</button>
      </>}
      {latest && <div className="space-y-2 text-sm" data-testid="cash-closing-snapshot">
        <p>ปิดร้านฉบับ {latest.revision} · {new Date(latest.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        <p>นับเงินเก๊ะ ฿{formatMoney(latest.drawerCount ?? "0")} · ส่วนต่าง ฿{formatMoney(latest.drawerVariance ?? "0")}</p>
        <p>นับเงินรอฝาก ฿{formatMoney(latest.pendingCount ?? "0")} · ส่วนต่าง ฿{formatMoney(latest.pendingVariance ?? "0")}</p>
        <button type="button" disabled={isBusy} className="ucom-secondary px-4 py-2" onClick={() => { setIsBusy(true); sendCashClosing(latest.id, undefined, date).then(sent => sent ? toast.success("ส่งสรุปเข้า LINE แล้ว") : toast.error("ส่ง LINE ไม่สำเร็จ กรุณาลองใหม่")).finally(() => setIsBusy(false)); }}>ส่งสรุปเดิมเข้า LINE</button>
      </div>}
      {!isToday && !latest && <p className="text-sm text-ink-muted">ไม่มีบันทึกเงินสดสองกองของวันนี้</p>}
      <button type="button" disabled={isBusy} onClick={() => void refresh()} className="text-xs underline">ตรวจยอดล่าสุด</button>
      {error && <p role="alert" className="ucom-error">{error}</p>}
      <ConfirmDialog open={isConfirmOpen} title="ยืนยันยอดนับสองกอง" confirmLabel="บันทึกและส่ง LINE" confirmTestId="cash-close-confirm" isBusy={isBusy} onClose={cancelReview} onConfirm={() => void confirm()}>
        {request && <p className="text-sm">เงินเก๊ะ ฿{formatMoney(request.payload.drawerCount)} · เงินรอฝาก ฿{formatMoney(request.payload.pendingCount)} · ยอดระบบรุ่น {request.payload.version}</p>}
        <p className="text-xs text-ink-muted">การบันทึกยอดนับไม่ปรับยอดเงินในระบบ หากมีส่วนต่างให้เจ้าของแก้ไขพร้อมเหตุผล</p>
      </ConfirmDialog>
    </section>
  );
}
