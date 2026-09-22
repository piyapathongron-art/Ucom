import type { Tables } from "@/lib/types/database";

type ClosingRow = Tables<"day_closings">;

interface Props {
  isToday: boolean;
  isClosingSuccess: boolean;
  closing: ClosingRow | null;
  toSend: number;
  countedCash: string;
  onCountedCashChange: (v: string) => void;
  closeNote: string;
  onCloseNoteChange: (v: string) => void;
  queuedCount: number;
  onSubmit: (e: React.FormEvent) => void;
  fmt: (n: number) => string;
}

export default function ClosingForm({
  isToday,
  isClosingSuccess,
  closing,
  toSend,
  countedCash,
  onCountedCashChange,
  closeNote,
  onCloseNoteChange,
  queuedCount,
  onSubmit,
  fmt,
}: Props) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">สถานะการปิดร้าน</h2>
      {isToday ? (
        isClosingSuccess && !closing ? (
          <div className="rounded border border-success bg-success/10 p-4 text-success font-medium">ปิดร้านสำเร็จ</div>
        ) : (
          <div className="ucom-surface space-y-4 bg-background p-6">
            {closing && (
              <div className="text-sm text-ink font-medium">
                ปิดล่าสุดเวลา {closing.closed_at ? new Date(closing.closed_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : ""} — นับได้ {fmt(Number(closing.counted_cash))} บาท
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">เงินสดที่นับได้จริง</label>
                <input type="number" required min="0" step="any" data-testid="close-day-counted-cash" value={countedCash} onChange={e => onCountedCashChange(e.target.value)} className="ucom-field w-full px-3 py-2 text-sm" placeholder="0.00" />
                {countedCash && !isNaN(parseFloat(countedCash)) && (
                  <div className={`text-sm mt-1 font-medium ${(parseFloat(countedCash) - toSend) === 0 ? "text-success" : (parseFloat(countedCash) - toSend) > 0 ? "text-ink" : "text-danger"}`}>
                    ส่วนต่าง: {(parseFloat(countedCash) - toSend) === 0 ? "ตรงพอดี" : (parseFloat(countedCash) - toSend) > 0 ? `เกิน ${fmt(parseFloat(countedCash) - toSend)} บาท` : `ขาด ${fmt(toSend - parseFloat(countedCash))} บาท`}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">หมายเหตุ (ถ้ามี)</label>
                <textarea data-testid="close-day-note" value={closeNote} onChange={e => onCloseNoteChange(e.target.value)} className="ucom-field w-full px-3 py-2 text-sm" rows={2} />
              </div>
              <button type="submit" disabled={queuedCount > 0} data-testid="close-day-confirm" className="ucom-primary w-full !rounded-full px-4 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
                ยืนยันปิดร้าน
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="ucom-surface bg-background p-6 text-center text-ink-muted">
          {closing ? (
            <span>ปิดเมื่อ {closing.closed_at ? new Date(closing.closed_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : ""} — เงินสดที่นับได้ {fmt(Number(closing.counted_cash))} บาท</span>
          ) : (
            <span>ยังไม่ได้ปิดวันนี้</span>
          )}
        </div>
      )}
    </section>
  );
}
