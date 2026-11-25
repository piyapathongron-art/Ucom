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
        <h2 className="text-lg font-bold">รอบันทึกค่าคอม ({total})</h2>
      </div>
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        data-testid="sf-pending-search"
        placeholder="ค้นหา IMEI / รุ่น"
        type="search" aria-label="ค้นหา IMEI หรือรุ่น" className="ucom-field h-10 w-full rounded-full px-4 text-sm md:w-80"
      />
      {pending.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">ไม่มีเครื่องที่รอบันทึก</p>
      ) : (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
            <thead>
              <tr>
                <th scope="col">IMEI</th>
                <th scope="col">รุ่น</th>
                <th scope="col">วันที่ปล่อย</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.device_unit_id}>
                  <td className="text-sm tabular-nums">{row.imei}</td>
                  <td>{row.model_name}</td>
                  <td className="text-muted-foreground">{formatDate(row.financed_at)}</td>
                  <td>
                    {recordingId === row.device_unit_id ? (
                      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
                        <div>
                          <label htmlFor={`sf-record-amount-${row.device_unit_id}`} className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                            ค่าคอม (บาท)
                          </label>
                          <input
                            id={`sf-record-amount-${row.device_unit_id}`}
                            data-testid={`sf-record-amount-${row.device_unit_id}`}
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={recordAmount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            className="ucom-field h-10 w-28 px-3 text-sm tabular-nums"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label htmlFor={`sf-record-date-${row.device_unit_id}`} className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                            วันที่รับเงิน
                          </label>
                          <input
                            id={`sf-record-date-${row.device_unit_id}`}
                            data-testid={`sf-record-date-${row.device_unit_id}`}
                            type="date"
                            required
                            max={todayInBangkok()}
                            value={recordDate}
                            onChange={(e) => onDateChange(e.target.value)}
                            className="ucom-field h-10 px-3 text-sm"
                          />
                        </div>
                        {recordError && (
                          <p role="alert" className="w-full text-sm font-semibold text-danger">{recordError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            data-testid={`sf-record-submit-${row.device_unit_id}`}
                            type="submit"
                            disabled={recordSubmitting}
                            className="ucom-primary px-4 text-sm disabled:opacity-50"
                          >
                            {recordSubmitting ? "กำลังบันทึก..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancel}
                            className="ucom-secondary px-4 text-sm"
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
                        className="ucom-secondary px-4 text-sm"
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
