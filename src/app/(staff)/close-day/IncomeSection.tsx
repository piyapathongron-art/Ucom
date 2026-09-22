import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";

export type IncomeRow = Tables<"v_close_day_income">;

interface Props {
  income: IncomeRow[];
  isToday: boolean;
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onAddIncome: (e: React.FormEvent) => void;
  onDeleteIncome: (id: string) => Promise<void>;
  incomeName: string;
  onIncomeNameChange: (v: string) => void;
  incomeAmount: string;
  onIncomeAmountChange: (v: string) => void;
  incomeReceivedTo: "cash" | "transfer";
  onIncomeReceivedToChange: (v: "cash" | "transfer") => void;
  fmt: (n: number) => string;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function IncomeSection({
  income,
  isToday,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onAddIncome,
  onDeleteIncome,
  incomeName,
  onIncomeNameChange,
  incomeAmount,
  onIncomeAmountChange,
  incomeReceivedTo,
  onIncomeReceivedToChange,
  fmt,
  page,
  pageSize,
  total,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">รายรับนอกบิล</h2>

      {isToday && (
        <form onSubmit={onAddIncome} className="ucom-toolbar items-end">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">รายการ</label>
            <input
              type="text"
              required
              data-testid="close-day-income-name"
              value={incomeName}
              onChange={(e) => onIncomeNameChange(e.target.value)}
              className="ucom-field px-3 py-2 text-sm"
              placeholder="ชื่อรายการ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">จำนวนเงิน (บาท)</label>
            <input
              type="number"
              required
              min="0.01"
              step="any"
              data-testid="close-day-income-amount"
              value={incomeAmount}
              onChange={(e) => onIncomeAmountChange(e.target.value)}
              className="ucom-field px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">รับเข้า</label>
            <select
              data-testid="close-day-income-received-to"
              value={incomeReceivedTo}
              onChange={(e) =>
                onIncomeReceivedToChange(e.target.value as "cash" | "transfer")
              }
              className="ucom-field px-3 py-2 text-sm"
            >
              <option value="cash">เงินสดในลิ้นชัก</option>
              <option value="transfer">เงินโอน</option>
            </select>
          </div>
          <button
            type="submit"
            data-testid="close-day-income-submit"
            className="ucom-primary !rounded-full px-4 py-2 text-sm"
          >
            บันทึกรายรับ
          </button>
        </form>
      )}

      {/* ตาราง — md ขึ้นไป */}
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-ink-muted">รายการ</th>
              <th className="px-4 py-3 font-medium text-ink-muted">จำนวนเงิน</th>
              <th className="px-4 py-3 font-medium text-ink-muted">รับเข้า</th>
              {isToday && (
                <th className="px-4 py-3 font-medium text-ink-muted">จัดการ</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {income.length === 0 ? (
              <tr>
                <td
                  colSpan={isToday ? 4 : 3}
                  className="px-4 py-4 text-center text-ink-muted"
                >
                  ไม่มีรายการรายรับนอกบิล
                </td>
              </tr>
            ) : (
              income.map((row) => (
                <tr key={row.id} data-testid={`close-day-income-row-${row.id}`}>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {fmt(Number(row.amount))}
                  </td>
                  <td className="px-4 py-3">
                    {row.received_to === "cash" ? "เงินสดในลิ้นชัก" : "เงินโอน"}
                  </td>
                  {isToday && (
                    <td className="px-4 py-3">
                      {deleteConfirmId === row.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDeleteIncome(row.id!)}
                            data-testid={`close-day-income-delete-confirm-${row.id}`}
                            className="ucom-danger bg-danger px-2 py-1 text-xs text-surface"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetDeleteConfirmId(null)}
                            className="ucom-secondary !rounded-full px-2 py-1 text-xs"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetDeleteConfirmId(row.id!)}
                          data-testid={`close-day-income-delete-${row.id}`}
                          className="ucom-danger border-0 px-0 py-1 text-xs underline"
                        >
                          ลบ
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* การ์ด — ต่ำกว่า md */}
      <div className="md:hidden space-y-2">
        {income.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">ไม่มีรายการรายรับนอกบิล</p>
        )}
        {income.map((row) => (
          <div
            key={row.id}
            data-testid={`close-day-income-row-${row.id}`}
            className="ucom-surface p-3 text-sm"
          >
            <div className="flex justify-between items-start">
              <span className="font-medium text-ink">{row.name}</span>
              <span className="font-mono tabular-nums font-semibold text-ink">
                {fmt(Number(row.amount))}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-ink-muted">
                {row.received_to === "cash" ? "เงินสดในลิ้นชัก" : "เงินโอน"}
              </span>
              {isToday && (
                <div>
                  {deleteConfirmId === row.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDeleteIncome(row.id!)}
                        className="ucom-danger bg-danger px-2 py-1 text-xs text-surface"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetDeleteConfirmId(null)}
                        className="ucom-secondary !rounded-full px-2 py-1 text-xs"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetDeleteConfirmId(row.id!)}
                      className="ucom-danger border-0 px-0 py-1 text-xs underline"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        label="รายรับนอกบิล"
        testIdPrefix="close-day-income-pagination"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
