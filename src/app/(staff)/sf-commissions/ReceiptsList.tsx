import type { Tables } from "@/lib/types/database";

type ReceiptRow = Tables<"v_sf_receipts">;

export function ReceiptsList({
  receipts,
  isOwner,
  roleResolved,
  correctingId,
  correctAmount,
  correctDate,
  correctReason,
  correctSubmitting,
  correctError,
  onOpen,
  onCancel,
  onAmountChange,
  onDateChange,
  onReasonChange,
  onSubmit,
  formatDate,
  fmtMoney,
  todayInBangkok,
}: {
  receipts: ReceiptRow[];
  isOwner: boolean;
  roleResolved: boolean;
  correctingId: string | null;
  correctAmount: string;
  correctDate: string;
  correctReason: string;
  correctSubmitting: boolean;
  correctError: string | null;
  onOpen: (row: ReceiptRow) => void;
  onCancel: () => void;
  onAmountChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formatDate: (iso: string | null) => string;
  fmtMoney: (n: number) => string;
  todayInBangkok: () => string;
}) {
  const showCorrectionColumn = roleResolved && isOwner;

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">ค่าคอมที่ยืนยันแล้ว ({receipts.length})</h2>
      {receipts.length === 0 ? (
        <p className="text-sm text-ink-muted">ยังไม่มีรายการ</p>
      ) : (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-2 font-medium text-ink-muted">IMEI</th>
                <th className="px-4 py-2 font-medium text-ink-muted">รุ่น</th>
                <th className="px-4 py-2 font-medium text-ink-muted">ยอด (บาท)</th>
                <th className="px-4 py-2 font-medium text-ink-muted">วันที่รับเงิน</th>
                <th className="px-4 py-2 font-medium text-ink-muted">บันทึกเมื่อ</th>
                {showCorrectionColumn && (
                  <th className="px-4 py-2 font-medium text-ink-muted"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {receipts.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{row.imei}</td>
                  <td className="px-4 py-2">{row.model_name}</td>
                  <td className="px-4 py-2 font-mono tabular-nums">
                    {fmtMoney(row.amount ?? 0)}
                  </td>
                  <td className="px-4 py-2 text-ink-muted">{row.received_on}</td>
                  <td className="px-4 py-2 text-ink-muted">{formatDate(row.recorded_at)}</td>
                  {showCorrectionColumn && (
                    <td className="px-4 py-2">
                      {correctingId === row.device_unit_id ? (
                        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="block text-xs text-ink-muted mb-0.5">
                              ค่าคอมใหม่ (บาท)
                            </label>
                            <input
                              data-testid={`sf-correct-amount-${row.device_unit_id}`}
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={correctAmount}
                              onChange={(e) => onAmountChange(e.target.value)}
                              className="w-28 rounded border border-border px-2 py-1 text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-muted mb-0.5">
                              วันที่รับเงิน
                            </label>
                            <input
                              data-testid={`sf-correct-date-${row.device_unit_id}`}
                              type="date"
                              required
                              max={todayInBangkok()}
                              value={correctDate}
                              onChange={(e) => onDateChange(e.target.value)}
                              className="rounded border border-border px-2 py-1 text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-ink-muted mb-0.5">
                              เหตุผลในการแก้ไข
                            </label>
                            <input
                              data-testid={`sf-correct-reason-${row.device_unit_id}`}
                              type="text"
                              required
                              value={correctReason}
                              onChange={(e) => onReasonChange(e.target.value)}
                              className="w-48 rounded border border-border px-2 py-1 text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
                              placeholder="เช่น บันทึกผิด"
                            />
                          </div>
                          {correctError && (
                            <p className="w-full text-xs text-danger">{correctError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              data-testid={`sf-correct-submit-${row.device_unit_id}`}
                              type="submit"
                              disabled={correctSubmitting}
                              className="rounded bg-ink px-3 py-1 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-50"
                            >
                              {correctSubmitting ? "กำลังแก้ไข..." : "ยืนยันแก้ไข"}
                            </button>
                            <button
                              type="button"
                              onClick={onCancel}
                              className="rounded border border-border px-3 py-1 text-xs text-ink-muted hover:bg-surface"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          data-testid={`sf-correct-open-${row.device_unit_id}`}
                          type="button"
                          onClick={() => onOpen(row)}
                          className="rounded border border-border bg-white px-3 py-1 text-xs hover:bg-surface"
                        >
                          แก้ไข
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
