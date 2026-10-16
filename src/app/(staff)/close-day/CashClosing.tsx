"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { cashExecute, cashStatus, isDefiniteCashError } from "@/lib/cash/client";
import { formatMoney, moneyCents, parseMoney } from "@/lib/cash/money";
import type { CashStatus, CashSnapshot } from "@/lib/cash/types";
import { createClient } from "@/lib/supabase/client";
import { toThaiError } from "@/lib/errors";
import { sendCashClosing } from "./actions";
import { refreshCashOperations, withCashOperationLock } from "@/lib/cash/operations";

function differenceText(cents: bigint) {
  if (cents === BigInt(0)) return "ตรง";
  const abs = cents < BigInt(0) ? -cents : cents;
  return `${cents < BigInt(0) ? "ขาด" : "เกิน"} ฿${formatMoney(`${abs / BigInt(100)}.${String(abs % BigInt(100)).padStart(2, "0")}`)}`;
}

function Step({ n, title, isDone = false, children }: { n: number; title: string; isDone?: boolean; children: ReactNode }) {
  return <div className="flex gap-3">
    <span aria-hidden="true" className={`ucom-surface flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold ${isDone ? "text-success" : ""}`}>{isDone ? "✓" : n}</span>
    <div className="min-w-0 flex-1 space-y-3"><h3 className="font-bold">{title}</h3>{children}</div>
  </div>;
}

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

  // Staff pause the POS in another tab/page; re-check as soon as they come back here.
  useEffect(() => {
    const recheck = () => { if (document.visibilityState === "visible") cashStatus().then(next => setStatus(next), () => undefined); };
    window.addEventListener("focus", recheck); document.addEventListener("visibilitychange", recheck);
    return () => { window.removeEventListener("focus", recheck); document.removeEventListener("visibilitychange", recheck); };
  }, []);

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
      // The note is entered in the confirmation popup; it is locked into the stored payload once submitted.
      const payload = request.submitted ? request.payload : { ...request.payload, note: note.trim() };
      const submitted = { ...request, payload, submitted: true };
      localStorage.setItem(key, JSON.stringify(submitted)); setRequest(submitted);
      const result = await cashExecute(request.id, request.epoch, "close", payload);
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
  const isOwner = Boolean(status?.isOwner);
  const isReady = Boolean(status?.isReceivingPaused && status.ackVersion === status.version) && queuedCount === 0;
  // Same definitions as the close action: drawer vs drawer balance, pending count vs in-shop (available) balance.
  const diff = request && status && status.version === request.payload.version
    ? { drawer: moneyCents(request.payload.drawerCount) - moneyCents(status.drawer), pending: moneyCents(request.payload.pendingCount) - moneyCents(status.available) } : null;
  const hasDiff = Boolean(diff && (diff.drawer !== BigInt(0) || diff.pending !== BigInt(0)));
  const canReview = isReady && Boolean(status) && drawerCount !== "" && pendingCount !== "";
  const countProps = { disabled: !isReady || Boolean(request) || isBusy || !status, type: "number", min: "0", step: "0.01", className: "ucom-field mt-1 w-full px-4 py-2.5" } as const;
  return (
    <section className="ucom-surface space-y-5 p-6" data-testid="two-fund-closing">
      <h2 className="text-lg font-bold">นับเงินสดปิดร้าน</h2>
      {isOwner && status && <div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-ink-muted">เงินเก๊ะ</dt><dd className="font-semibold">฿{formatMoney(status.drawer)}</dd></div>
          <div><dt className="text-ink-muted">เงินรอฝากในร้าน</dt><dd className="font-semibold">฿{formatMoney(status.available)}</dd></div>
          <div><dt className="text-ink-muted">กำลังไปฝาก</dt><dd>฿{formatMoney(status.reserved)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-ink-muted">ยอดในระบบ เห็นเฉพาะเจ้าของ พนักงานนับโดยไม่เห็นยอดนี้ นับเฉพาะเงินที่อยู่ในร้าน</p>
      </div>}
      {isToday && <>
        <Step n={1} title="ให้ POS หยุดรับเงิน" isDone={isReady}>
          <p className="text-sm text-ink-muted">{isReady ? "POS หยุดรับเงินและยืนยันยอดล่าสุดแล้ว" : queuedCount > 0 ? `ยังมีบิลค้างในคิว ${queuedCount} ใบ ส่งให้ครบก่อน` : "ที่เครื่อง POS หลัก ส่งบิลค้างให้ครบ แล้วกดหยุดรับเงิน จากนั้นกลับมาหน้านี้"}</p>
          <div className="flex gap-3">
            <Link href="/pos" className="ucom-secondary px-4 py-2 text-sm">เปิด POS</Link>
            <button type="button" disabled={isBusy} onClick={() => void refresh()} className="ucom-secondary px-4 py-2 text-sm">ตรวจอีกครั้ง</button>
          </div>
        </Step>
        <Step n={2} title="นับเงินในร้าน">
          {!isReady && <p className="text-sm text-ink-muted">ทำขั้นที่ 1 ให้เสร็จก่อน</p>}
          <label className="block text-sm">เงินเก๊ะที่นับได้จริง<input {...countProps} data-testid="close-drawer-count" value={drawerCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setDrawerCount(event.target.value); }} /></label>
          <label className="block text-sm">เงินรอฝากที่นับได้ในร้าน<input {...countProps} data-testid="close-pending-count" value={pendingCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setPendingCount(event.target.value); }} /></label>
        </Step>
        <Step n={3} title="ตรวจส่วนต่างและยืนยัน">
          <button type="button" data-testid="cash-close-review" disabled={isBusy || (!request && !canReview)} onClick={() => void review()} className="ucom-primary w-full px-4 py-3">{request ? "ลองยืนยันรายการเดิม" : latest ? "บันทึกยอดนับฉบับใหม่" : "ตรวจยอดและปิดร้าน"}</button>
          {!request && !canReview && <p className="text-xs text-ink-muted">{isReady ? "กรอกยอดนับให้ครบทั้งสองกองก่อน" : "ทำขั้นที่ 1 และ 2 ให้เสร็จก่อน"}</p>}
        </Step>
      </>}
      {latest && <div className="space-y-2 text-sm" data-testid="cash-closing-snapshot">
        <p>ปิดร้านฉบับ {latest.revision} · {new Date(latest.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
        <p>นับเงินเก๊ะ ฿{formatMoney(latest.drawerCount ?? "0")} · ส่วนต่าง ฿{formatMoney(latest.drawerVariance ?? "0")}</p>
        <p>นับเงินรอฝาก ฿{formatMoney(latest.pendingCount ?? "0")} · ส่วนต่าง ฿{formatMoney(latest.pendingVariance ?? "0")}</p>
        {latest.note && <p className="text-ink-muted">หมายเหตุ: {latest.note}</p>}
        <button type="button" disabled={isBusy} className="ucom-secondary px-4 py-2" onClick={() => { setIsBusy(true); sendCashClosing(latest.id, undefined, date).then(sent => sent ? toast.success("ส่งสรุปเข้า LINE แล้ว") : toast.error("ส่ง LINE ไม่สำเร็จ กรุณาลองใหม่")).finally(() => setIsBusy(false)); }}>ส่งสรุปเดิมเข้า LINE</button>
      </div>}
      {!isToday && !latest && <p className="text-sm text-ink-muted">ไม่มีบันทึกเงินสดสองกองของวันนี้</p>}
      {error && <p role="alert" className="ucom-error">{error}</p>}
      <ConfirmDialog open={isConfirmOpen} title="ยืนยันยอดนับ" confirmLabel="บันทึกและส่ง LINE" confirmTestId="cash-close-confirm" isBusy={isBusy} canConfirm={!hasDiff || note.trim().length > 0} onClose={cancelReview} onConfirm={() => void confirm()}>
        {request && <div className="space-y-3 text-sm">
          {([["เงินเก๊ะ", request.payload.drawerCount, status?.drawer, diff?.drawer], ["เงินรอฝากในร้าน", request.payload.pendingCount, status?.available, diff?.pending]] as const).map(([label, counted, system, difference]) =>
            <p key={label}><span className="font-semibold">{label}</span> · นับได้ ฿{formatMoney(counted)}{isOwner && system ? ` · ระบบ ฿${formatMoney(system)}` : ""}{difference !== undefined ? ` · ${differenceText(difference)}` : ""}</p>)}
          <label className="block">{hasDiff ? "ยอดไม่ตรง กรุณาบอกสาเหตุ (จำเป็น)" : "หมายเหตุ (ไม่บังคับ)"}<textarea disabled={Boolean(request.submitted) || isBusy} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} className="ucom-field mt-1 w-full px-4 py-2.5" /></label>
        </div>}
        <p className="text-xs text-ink-muted">การบันทึกยอดนับไม่ปรับยอดเงินในระบบ หากมีส่วนต่างให้เจ้าของแก้ไขพร้อมเหตุผล</p>
      </ConfirmDialog>
    </section>
  );
}
