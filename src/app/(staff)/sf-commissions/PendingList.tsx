import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";

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
  search,
  onSearchChange,
  page,
  pageSize,
  total,
  isLoading,
  onPageChange,
  onPageSizeChange,
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
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <section data-testid="sf-pending-section" className="space-y-4">
      <div>
        <h2 className="mt-1 text-xl font-semibold">รอบันทึกค่าคอม ({total})</h2>
      </div>
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        data-testid="sf-pending-search"
        placeholder="ค้นหา IMEI / รุ่น"
        className="ucom-field w-full px-3 py-2 text-sm md:w-80"
      />
      {pending.length === 0 ? (
        <p className="text-sm text-ink-muted">ไม่มีเครื่องที่รอบันทึก</p>
      ) : (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
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
                            className="ucom-field w-28 px-2 py-1.5 text-sm"
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
                            className="ucom-field px-2 py-1.5 text-sm"
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
                            className="ucom-primary px-3 py-1 text-xs disabled:opacity-50"
                          >
                            {recordSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancel}
                            className="ucom-secondary px-3 py-1 text-xs"
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
                        className="ucom-secondary px-3 py-1 text-xs"
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
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        pageSizeOptions={[20, 40, 80]}
        label="รายการรอบันทึก"
        testIdPrefix="sf-pending-pagination"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
