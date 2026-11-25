"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { Button } from "@/components/ui/button";
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

// Unknown (the book moved on since the count) stays neutral rather than claiming a match.
const differenceTone = (cents: bigint | undefined) =>
  cents === undefined ? "bg-muted text-foreground" : cents === BigInt(0) ? "bg-success-bg text-success" : "bg-danger-bg text-danger";

type StepState = "done" | "active" | "locked";

// ADR 0032's three ordered steps. Done is green with a tick, the current step is outlined, later steps are muted.
function Step({ n, title, state, children }: { n: number; title: string; state: StepState; children: ReactNode }) {
  const tone = state === "done" ? "bg-success-bg" : state === "active" ? "bg-muted ring-2 ring-primary" : "bg-muted";
  const badge = state === "done" ? "bg-success text-on-accent" : state === "active" ? "bg-primary text-primary-foreground" : "bg-border-strong text-foreground";
  return (
    <li className={`flex gap-3 rounded-2xl p-4 ${tone}`} aria-current={state === "active" ? "step" : undefined}>
      <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${badge}`}>{state === "done" ? "✓" : n}</span>
      <div className="min-w-0 flex-1 space-y-3">
        <h3 className={`font-bold ${state === "done" ? "text-success" : "text-foreground"}`}>
          {n} · {title}
          {state === "done" && <span className="sr-only"> (เสร็จแล้ว)</span>}
        </h3>
        {children}
      </div>
    </li>
  );
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
  const countProps = {
    disabled: !isReady || Boolean(request) || isBusy || !status,
    type: "number", min: "0", step: "0.01", inputMode: "decimal",
    className: "ucom-field h-13 w-full px-4 text-lg font-bold tabular-nums disabled:bg-muted disabled:text-muted-foreground",
  } as const;
  const step2: StepState = request ? "done" : isReady ? "active" : "locked";
  const step3: StepState = request || canReview ? "active" : "locked";

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-card md:p-6" data-testid="two-fund-closing" aria-labelledby="cash-closing-title">
      <div>
        <h2 id="cash-closing-title" className="text-lg font-bold">นับเงินสดปิดร้าน</h2>
        {isToday && <p className="mt-1 text-sm text-muted-foreground">
          {isOwner ? "ยอดในระบบเห็นเฉพาะเจ้าของ พนักงานนับโดยไม่เห็นยอดนี้" : "นับเงินจริงโดยไม่เห็นยอดในระบบ ระบบจะเทียบให้หลังกดตรวจยอด"}
        </p>}
      </div>

      {isOwner && status && <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([["เงินเก๊ะ", status.drawer], ["เงินรอฝากในร้าน", status.available], ["กำลังไปฝาก", status.reserved]] as const).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">฿{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>}

      {latest && <div role="status" data-testid="cash-closing-snapshot" className="flex flex-col gap-3 rounded-2xl bg-success-bg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-lg font-bold text-on-accent">✓</span>
            <div>
              <p className="font-bold text-success">ปิดร้านฉบับ {latest.revision} · {new Date(latest.asOf).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-sm text-success">{new Date(latest.asOf).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium" })}</p>
            </div>
          </div>
          <Button type="button" variant="outline" disabled={isBusy} className="bg-card" onClick={() => { setIsBusy(true); sendCashClosing(latest.id, undefined, date).then(sent => sent ? toast.success("ส่งสรุปเข้า LINE แล้ว") : toast.error("ส่ง LINE ไม่สำเร็จ กรุณาลองใหม่")).finally(() => setIsBusy(false)); }}>ส่งสรุปเดิมเข้า LINE</Button>
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([["เงินเก๊ะ", latest.drawerCount, latest.drawerVariance], ["เงินรอฝากในร้าน", latest.pendingCount, latest.pendingVariance]] as const).map(([label, counted, variance]) => {
            const cents = moneyCents(variance ?? "0");
            return (
              <div key={label} className="rounded-xl bg-card px-4 py-3">
                <dt className="text-sm text-muted-foreground">{label} · นับได้</dt>
                <dd className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-lg font-bold tabular-nums">฿{formatMoney(counted ?? "0")}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${differenceTone(cents)}`}>{differenceText(cents)}</span>
                </dd>
              </div>
            );
          })}
        </dl>
        {latest.note && <p className="text-sm text-foreground"><span className="font-semibold">หมายเหตุ:</span> {latest.note}</p>}
      </div>}

      {isToday && <>
        {latest && <p className="text-sm text-muted-foreground">นับใหม่ได้ ระบบจะเก็บเป็นฉบับใหม่และส่งเข้า LINE ทุกครั้ง</p>}
        <ol className="flex flex-col gap-3" aria-label="ขั้นตอนปิดร้าน">
          <Step n={1} title="ให้ POS หยุดรับเงิน" state={isReady ? "done" : "active"}>
            <p className={`text-sm ${isReady ? "text-success" : "text-muted-foreground"}`}>{isReady ? "POS หยุดรับเงินและยืนยันยอดล่าสุดแล้ว" : queuedCount > 0 ? `ยังมีบิลค้างในคิว ${queuedCount} ใบ ส่งให้ครบก่อน` : "ที่เครื่อง POS หลัก ส่งบิลค้างให้ครบ แล้วกดหยุดรับเงิน จากนั้นกลับมาหน้านี้"}</p>
            <div className="flex flex-wrap gap-2">
              {!isReady && <Button asChild variant="outline" size="sm" className="bg-card"><Link href="/pos">เปิด POS</Link></Button>}
              <Button type="button" variant="outline" size="sm" className="bg-card" disabled={isBusy} onClick={() => void refresh()}>ตรวจอีกครั้ง</Button>
            </div>
          </Step>
          <Step n={2} title="นับเงินในร้าน" state={step2}>
            {step2 === "locked" && <p className="text-sm text-muted-foreground">ทำขั้นที่ 1 ให้เสร็จก่อน</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">เงินเก๊ะที่นับได้จริง (บาท)
                <input {...countProps} data-testid="close-drawer-count" value={drawerCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setDrawerCount(event.target.value); }} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">เงินรอฝากที่นับได้ในร้าน (บาท)
                <input {...countProps} data-testid="close-pending-count" value={pendingCount} onChange={event => { if (countVersion === null && status) setCountVersion(status.version); setPendingCount(event.target.value); }} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">เงินเก๊ะ = เงินทอนในลิ้นชัก · เงินรอฝาก = เงินขายที่ต้องนำไปฝากธนาคาร นับเฉพาะเงินที่อยู่ในร้าน</p>
          </Step>
          <Step n={3} title="ตรวจส่วนต่างและยืนยัน" state={step3}>
            <Button type="button" size="lg" data-testid="cash-close-review" disabled={isBusy || (!request && !canReview)} onClick={() => void review()} className="h-12 w-full font-bold">
              {request ? "ลองยืนยันรายการเดิม" : latest ? "บันทึกยอดนับฉบับใหม่" : "ตรวจยอดและปิดร้าน"}
            </Button>
            {!request && !canReview && <p className="text-sm text-muted-foreground">{isReady ? "กรอกยอดนับให้ครบทั้งสองกองก่อน" : "ทำขั้นที่ 1 และ 2 ให้เสร็จก่อน"}</p>}
          </Step>
        </ol>
      </>}
      {!isToday && !latest && <p className="text-sm text-muted-foreground">ไม่มีบันทึกเงินสดสองกองของวันนี้</p>}
      {error && <p role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <ConfirmDialog open={isConfirmOpen} title="ยืนยันยอดนับ" confirmLabel="บันทึกและส่ง LINE" cancelLabel={request?.submitted ? "ปิด" : "กลับไปนับใหม่"} confirmTestId="cash-close-confirm" isBusy={isBusy} canConfirm={!hasDiff || note.trim().length > 0} onClose={cancelReview} onConfirm={() => void confirm()}>
        {request && <div className="space-y-3 text-sm">
          {([["เงินเก๊ะ", request.payload.drawerCount, status?.drawer, diff?.drawer], ["เงินรอฝากในร้าน", request.payload.pendingCount, status?.available, diff?.pending]] as const).map(([label, counted, system, difference]) =>
            <div key={label} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 ${differenceTone(difference)}`}>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="tabular-nums">นับได้ ฿{formatMoney(counted)}{isOwner && system ? ` · ระบบ ฿${formatMoney(system)}` : ""}</p>
              </div>
              {difference !== undefined && <span className="font-bold tabular-nums">{differenceText(difference)}</span>}
            </div>)}
          <label className="flex flex-col gap-1.5 font-semibold">{hasDiff ? "ยอดไม่ตรง กรุณาบอกสาเหตุ (จำเป็น)" : "หมายเหตุ (ไม่บังคับ)"}
            <textarea disabled={Boolean(request.submitted) || isBusy} maxLength={1000} rows={3} value={note} onChange={event => setNote(event.target.value)} className="ucom-field w-full resize-none px-4 py-3 font-normal" />
          </label>
        </div>}
        <p className="text-sm text-muted-foreground">การบันทึกยอดนับไม่ปรับยอดเงินในระบบ หากมีส่วนต่างให้เจ้าของแก้ไขพร้อมเหตุผล</p>
      </ConfirmDialog>
    </section>
  );
}
