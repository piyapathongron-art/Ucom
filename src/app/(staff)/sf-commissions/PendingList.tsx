import type { Tables } from "@/lib/types/database";

type PendingRow = Tables<"v_sf_pending">;

export function PendingList({
  pending,
  recordingId,
  recordAmount,
  recordDate,
  recordSubmitting,
  recordError,
  onOpen,
  onCancel,
  onAmountChange,
  onDateChange,
  onSubmit,
  formatDate,
  todayInBangkok,
}: {
  pending: PendingRow[];
  recordingId: string | null;
  recordAmount: string;
  recordDate: string;
  recordSubmitting: boolean;
  recordError: string | null;
  onOpen: (deviceUnitId: string) => void;
  onCancel: () => void;
  onAmountChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  formatDate: (iso: string | null) => string;
  todayInBangkok: () => string;
}) {
  return (
    <section data-testid="sf-pending-section">
      <h2 className="text-xl font-semibold mb-4">รอบันทึกค่าคอม ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-muted">ไม่มีเครื่องที่รอบันทึก</p>
      ) : (
        <div className="rounded border border-border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface">
              <tr>
                <th className="px-4 py-2 font-medium text-ink-muted">IMEI</th>
                <th className="px-4 py-2 font-medium text-ink-muted">รุ่น</th>
                <th className="px-4 py-2 font-medium text-ink-muted">วันที่ปล่อย</th>
                <th className="px-4 py-2 font-medium text-ink-muted"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.device_unit_id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{row.imei}</td>
                  <td className="px-4 py-2">{row.model_name}</td>
                  <td className="px-4 py-2 text-ink-muted">{formatDate(row.financed_at)}</td>
                  <td className="px-4 py-2">
                    {recordingId === row.device_unit_id ? (
                      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-xs text-ink-muted mb-0.5">
                            ค่าคอม (บาท)
                          </label>
                          <input
                            data-testid={`sf-record-amount-${row.device_unit_id}`}
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={recordAmount}
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
                            data-testid={`sf-record-date-${row.device_unit_id}`}
                            type="date"
                            required
                            max={todayInBangkok()}
                            value={recordDate}
                            onChange={(e) => onDateChange(e.target.value)}
                            className="rounded border border-border px-2 py-1 text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-ink"
                          />
                        </div>
                        {recordError && (
                          <p className="w-full text-xs text-danger">{recordError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            data-testid={`sf-record-submit-${row.device_unit_id}`}
                            type="submit"
                            disabled={recordSubmitting}
                            className="rounded bg-ink px-3 py-1 text-xs font-medium text-surface hover:opacity-90 disabled:opacity-50"
                          >
                            {recordSubmitting ? "กำลังบันทึก..." : "บันทึก"}
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
                        data-testid={`sf-record-open-${row.device_unit_id}`}
                        type="button"
                        onClick={() => onOpen(row.device_unit_id ?? "")}
                        className="rounded border border-border bg-white px-3 py-1 text-xs hover:bg-surface"
                      >
                        บันทึกค่าคอม
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
