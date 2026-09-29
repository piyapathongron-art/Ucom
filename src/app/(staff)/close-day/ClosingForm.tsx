"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import type { Tables } from "@/lib/types/database";

type ClosingRow = Tables<"day_closings">;

interface Props {
  isToday: boolean;
  closing: ClosingRow | null;
  toSend: number;
  countedCash: string;
  onCountedCashChange: (v: string) => void;
  closeNote: string;
  onCloseNoteChange: (v: string) => void;
  queuedCount: number;
  onSubmit: () => Promise<boolean>;
  fmt: (n: number) => string;
}

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : "";

function diffText(diff: number, fmt: (n: number) => string) {
  return diff === 0 ? "ตรงพอดี" : diff > 0 ? `เกิน ฿${fmt(diff)}` : `ขาด ฿${fmt(-diff)}`;
}

export default function ClosingForm({ isToday, closing, toSend, countedCash, onCountedCashChange, closeNote, onCloseNoteChange, queuedCount, onSubmit, fmt }: Props) {
  const [isReclosing, setIsReclosing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const counted = parseFloat(countedCash);
  const isCountValid = Number.isFinite(counted) && counted >= 0;
  const diff = isCountValid ? counted - toSend : 0;

  async function confirm() {
    setIsBusy(true);
    const ok = await onSubmit();
    setIsBusy(false);
    setIsConfirmOpen(false);
    if (ok) setIsReclosing(false);
  }

  const showForm = isToday && (!closing || isReclosing);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">สถานะการปิดร้าน</h2>
      {closing && (
        <div data-testid="close-day-closed" className="rounded-2xl bg-success-bg px-5 py-4 text-sm font-semibold text-success">
          ปิดร้านแล้ว {timeOf(closing.closed_at)} · นับได้ ฿{fmt(Number(closing.counted_cash))} · {diffText(Number(closing.counted_cash) - toSend, fmt)}
          {isToday && !isReclosing && (
            <button type="button" onClick={() => setIsReclosing(true)} data-testid="close-day-reclose" className="ucom-secondary ml-4 px-4 py-1.5 text-xs text-ink">ปิดใหม่อีกครั้ง</button>
          )}
        </div>
      )}
      {!closing && !isToday && <div className="ucom-surface p-6 text-center text-ink-muted">ยังไม่ได้ปิดวันนี้</div>}
      {showForm && (
        <div className="ucom-surface space-y-4 p-6">
          <label className="block text-xs font-semibold text-ink-muted">เงินสดที่นับได้จริง
            <input type="number" required min="0" step="any" data-testid="close-day-counted-cash" value={countedCash} onChange={(e) => onCountedCashChange(e.target.value)} className="ucom-field mt-1 w-full px-4 py-2.5 text-sm" placeholder="0.00" />
          </label>
          {isCountValid && <p className={`text-sm font-semibold ${diff === 0 ? "text-success" : diff > 0 ? "text-ink" : "text-danger"}`}>ส่วนต่าง: {diffText(diff, fmt)}</p>}
          <label className="block text-xs font-semibold text-ink-muted">หมายเหตุ (ถ้ามี)
            <textarea data-testid="close-day-note" value={closeNote} onChange={(e) => onCloseNoteChange(e.target.value)} className="ucom-field mt-1 w-full rounded-2xl px-4 py-2.5 text-sm" rows={2} />
          </label>
          <button type="button" onClick={() => setIsConfirmOpen(true)} disabled={queuedCount > 0 || !isCountValid} data-testid="close-day-confirm" className="ucom-primary w-full px-4 py-3.5 disabled:cursor-not-allowed disabled:opacity-50">
            ปิดร้าน
          </button>
        </div>
      )}
      <ConfirmDialog open={isConfirmOpen} title="ยืนยันปิดร้าน" confirmLabel="ยืนยันปิดร้าน" confirmTestId="close-day-confirm-submit" isBusy={isBusy} onClose={() => setIsConfirmOpen(false)} onConfirm={() => void confirm()}>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">ยอดที่ต้องส่ง</dt><dd className="tabular-nums">฿{fmt(toSend)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-muted">นับได้จริง</dt><dd className="tabular-nums">฿{fmt(isCountValid ? counted : 0)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>ส่วนต่าง</dt><dd>{diffText(diff, fmt)}</dd></div>
        </dl>
        <p className="text-xs text-ink-muted">ปิดแล้วยังกด “ปิดใหม่อีกครั้ง” เพื่อแก้ยอดนับได้ในวันเดียวกัน</p>
      </ConfirmDialog>
    </section>
  );
}
