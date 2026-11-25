"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { Button } from "@/components/ui/button";
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
  onResend: () => Promise<void>;
  isSending: boolean;
  fmt: (n: number) => string;
}

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : "";

function diffText(diff: number, fmt: (n: number) => string) {
  return diff === 0 ? "ตรงพอดี" : diff > 0 ? `เกิน ฿${fmt(diff)}` : `ขาด ฿${fmt(-diff)}`;
}

// Single-drawer close (cash book off): count, see the difference, confirm. Re-close replaces the day's count.
export default function ClosingForm({ isToday, closing, toSend, countedCash, onCountedCashChange, closeNote, onCloseNoteChange, queuedCount, onSubmit, onResend, isSending, fmt }: Props) {
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
    <section className="flex flex-col gap-3" aria-labelledby="close-day-status-title">
      <h2 id="close-day-status-title" className="text-lg font-bold">สถานะการปิดร้าน</h2>
      {closing && (
        <div data-testid="close-day-closed" role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-success-bg px-5 py-4 text-sm font-semibold text-success">
          <span>
            ปิดร้านแล้ว {timeOf(closing.closed_at)} · นับได้ ฿{fmt(Number(closing.counted_cash))} · {diffText(Number(closing.counted_cash) - toSend, fmt)}
            {new Date(closing.closed_at).getTime() > new Date(closing.created_at).getTime() && <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-xs">แก้ไข</span>}
          </span>
          <span className="flex flex-wrap gap-2">
            {isToday && !isReclosing && (
              <Button type="button" variant="outline" size="sm" className="bg-card text-foreground" onClick={() => setIsReclosing(true)} data-testid="close-day-reclose">ปิดใหม่อีกครั้ง</Button>
            )}
            <Button type="button" variant="outline" size="sm" className="bg-card text-foreground" onClick={() => void onResend()} disabled={isSending} data-testid="close-day-resend-line">{isSending ? "กำลังส่ง..." : "ส่งสรุปเข้า LINE"}</Button>
          </span>
        </div>
      )}
      {!closing && !isToday && <div className="rounded-xl bg-card p-6 text-center text-muted-foreground shadow-card">ยังไม่ได้ปิดวันนี้</div>}
      {showForm && (
        <div className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-card md:p-6">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">เงินสดที่นับได้จริง (บาท)
            <input type="number" required min="0" step="any" inputMode="decimal" data-testid="close-day-counted-cash" value={countedCash} onChange={(e) => onCountedCashChange(e.target.value)} className="ucom-field h-13 w-full px-4 text-lg font-bold tabular-nums" placeholder="0.00" />
          </label>
          {isCountValid && <p className={`text-sm font-semibold ${diff === 0 ? "text-success" : diff > 0 ? "text-foreground" : "text-danger"}`}>ส่วนต่าง: {diffText(diff, fmt)}</p>}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">หมายเหตุ (ถ้ามี)
            <textarea data-testid="close-day-note" value={closeNote} onChange={(e) => onCloseNoteChange(e.target.value)} className="ucom-field w-full resize-none px-4 py-3 font-normal" rows={2} />
          </label>
          <Button type="button" size="lg" onClick={() => setIsConfirmOpen(true)} disabled={queuedCount > 0 || !isCountValid} data-testid="close-day-confirm" className="h-12 w-full font-bold">
            ปิดร้าน
          </Button>
          {queuedCount > 0 && <p className="text-sm text-muted-foreground">ส่งบิลค้างในคิวให้ครบก่อนปิดร้าน</p>}
        </div>
      )}
      <ConfirmDialog open={isConfirmOpen} title="ยืนยันปิดร้าน" confirmLabel="ยืนยันปิดร้าน" confirmTestId="close-day-confirm-submit" isBusy={isBusy} onClose={() => setIsConfirmOpen(false)} onConfirm={() => void confirm()}>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">ยอดที่ต้องส่ง</dt><dd className="tabular-nums">฿{fmt(toSend)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">นับได้จริง</dt><dd className="tabular-nums">฿{fmt(isCountValid ? counted : 0)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>ส่วนต่าง</dt><dd>{diffText(diff, fmt)}</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">ปิดแล้วยังกด “ปิดใหม่อีกครั้ง” เพื่อแก้ยอดนับได้ในวันเดียวกัน</p>
      </ConfirmDialog>
    </section>
  );
}
