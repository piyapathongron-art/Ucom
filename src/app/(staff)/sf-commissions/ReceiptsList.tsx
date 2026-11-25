import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";

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
  search,
  onSearchChange,
  page,
  pageSize,
  total,
  isLoading,
  onPageChange,
  onPageSizeChange,
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
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const showCorrectionColumn = roleResolved && isOwner;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">ค่าคอมที่ยืนยันแล้ว ({total})</h2>
      </div>
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        data-testid="sf-receipts-search"
        placeholder="ค้นหา IMEI / รุ่น"
        type="search" aria-label="ค้นหา IMEI หรือรุ่น" className="ucom-field h-10 w-full rounded-full px-4 text-sm md:w-80"
      />
      {receipts.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">ยังไม่มีรายการ</p>
      ) : (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
            <thead>
              <tr>
                <th scope="col">IMEI</th>
                <th scope="col">รุ่น</th>
                <th scope="col" className="text-right">ยอด (บาท)</th>
                <th scope="col">วันที่รับเงิน</th>
                <th scope="col">บันทึกเมื่อ</th>
                {showCorrectionColumn && (
                  <th scope="col"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {receipts.map((row) => (
                <tr key={row.id}>
                  <td className="text-sm tabular-nums">{row.imei}</td>
                  <td>{row.model_name}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {fmtMoney(row.amount ?? 0)}
                  </td>
                  <td className="text-muted-foreground">{row.received_on}</td>
                  <td className="text-muted-foreground">{formatDate(row.recorded_at)}</td>
                  {showCorrectionColumn && (
                    <td>
                      {correctingId === row.device_unit_id ? (
                        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
                          <div>
                            <label htmlFor={`sf-correct-amount-${row.device_unit_id}`} className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                              ค่าคอมใหม่ (บาท)
                            </label>
                            <input
                              id={`sf-correct-amount-${row.device_unit_id}`}
                              data-testid={`sf-correct-amount-${row.device_unit_id}`}
                              type="number"
                              min="0"
                              step="any"
                              required
                              value={correctAmount}
                              onChange={(e) => onAmountChange(e.target.value)}
                              className="ucom-field h-10 w-28 px-3 text-sm tabular-nums"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label htmlFor={`sf-correct-date-${row.device_unit_id}`} className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                              วันที่รับเงิน
                            </label>
                            <input
                              id={`sf-correct-date-${row.device_unit_id}`}
                              data-testid={`sf-correct-date-${row.device_unit_id}`}
                              type="date"
                              required
                              max={todayInBangkok()}
                              value={correctDate}
                              onChange={(e) => onDateChange(e.target.value)}
                              className="ucom-field h-10 px-3 text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor={`sf-correct-reason-${row.device_unit_id}`} className="flex flex-col gap-1 text-xs font-semibold text-foreground">
                              เหตุผลในการแก้ไข
                            </label>
                            <input
                              id={`sf-correct-reason-${row.device_unit_id}`}
                              data-testid={`sf-correct-reason-${row.device_unit_id}`}
                              type="text"
                              required
                              value={correctReason}
                              onChange={(e) => onReasonChange(e.target.value)}
                              className="ucom-field h-10 w-48 px-3 text-sm"
                              placeholder="เช่น บันทึกผิด"
                            />
                          </div>
                          {correctError && (
                            <p role="alert" className="w-full text-sm font-semibold text-danger">{correctError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              data-testid={`sf-correct-submit-${row.device_unit_id}`}
                              type="submit"
                              disabled={correctSubmitting}
                              className="ucom-primary px-4 text-sm disabled:opacity-50"
                            >
                              {correctSubmitting ? "กำลังแก้ไข..." : "ยืนยันแก้ไข"}
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
                          data-testid={`sf-correct-open-${row.device_unit_id}`}
                          type="button"
                          onClick={() => onOpen(row)}
                          className="ucom-secondary px-4 text-sm"
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
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        pageSizeOptions={[20, 40, 80]}
        label="รายการยืนยันแล้ว"
        testIdPrefix="sf-receipts-pagination"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
