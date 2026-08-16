import type { Tables } from "@/lib/types/database";

export type ExpenseRow = Tables<"v_close_day_expenses">;

interface Props {
  expenses: ExpenseRow[];
  isToday: boolean;
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onAddExpense: (e: React.FormEvent) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  expenseName: string;
  onExpenseNameChange: (v: string) => void;
  expenseAmount: string;
  onExpenseAmountChange: (v: string) => void;
  expensePaidFrom: "cash" | "transfer";
  onExpensePaidFromChange: (v: "cash" | "transfer") => void;
  fmt: (n: number) => string;
}

export default function ExpensesSection({
  expenses,
  isToday,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onAddExpense,
  onDeleteExpense,
  expenseName,
  onExpenseNameChange,
  expenseAmount,
  onExpenseAmountChange,
  expensePaidFrom,
  onExpensePaidFromChange,
  fmt,
}: Props) {
  return (
    <section className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-semibold">รายจ่ายร้าน</h2>

      {isToday && (
        <form onSubmit={onAddExpense} className="ucom-toolbar items-end">
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">รายการ</label>
            <input
              type="text"
              required
              data-testid="close-day-expense-name"
              value={expenseName}
              onChange={(e) => onExpenseNameChange(e.target.value)}
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
              data-testid="close-day-expense-amount"
              value={expenseAmount}
              onChange={(e) => onExpenseAmountChange(e.target.value)}
              className="ucom-field px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-muted mb-1">จ่ายจาก</label>
            <select
              data-testid="close-day-expense-paid-from"
              value={expensePaidFrom}
              onChange={(e) =>
                onExpensePaidFromChange(e.target.value as "cash" | "transfer")
              }
              className="ucom-field px-3 py-2 text-sm"
            >
              <option value="cash">เงินสดในลิ้นชัก</option>
              <option value="transfer">เงินโอน/ส่วนตัว</option>
            </select>
          </div>
          <button
            type="submit"
            data-testid="close-day-expense-submit"
            className="ucom-primary px-4 py-2 text-sm"
          >
            บันทึกรายจ่าย
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
              <th className="px-4 py-3 font-medium text-ink-muted">จ่ายจาก</th>
              {isToday && (
                <th className="px-4 py-3 font-medium text-ink-muted">จัดการ</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expenses.length === 0 ? (
              <tr>
                <td
                  colSpan={isToday ? 4 : 3}
                  className="px-4 py-4 text-center text-ink-muted"
                >
                  ไม่มีรายการรายจ่าย
                </td>
              </tr>
            ) : (
              expenses.map((row) => (
                <tr key={row.id} data-testid={`close-day-expense-row-${row.id}`}>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {fmt(Number(row.amount))}
                  </td>
                  <td className="px-4 py-3">
                    {row.paid_from === "cash" ? "เงินสดในลิ้นชัก" : "เงินโอน/ส่วนตัว"}
                  </td>
                  {isToday && (
                    <td className="px-4 py-3">
                      {deleteConfirmId === row.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(row.id!)}
                            data-testid={`close-day-expense-delete-confirm-${row.id}`}
                            className="ucom-danger bg-danger px-2 py-1 text-xs text-surface"
                          >
                            ยืนยันลบ
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetDeleteConfirmId(null)}
                            className="ucom-secondary px-2 py-1 text-xs"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetDeleteConfirmId(row.id!)}
                          data-testid={`close-day-expense-delete-${row.id}`}
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
        {expenses.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">ไม่มีรายการรายจ่าย</p>
        )}
        {expenses.map((row) => (
          <div
            key={row.id}
            data-testid={`close-day-expense-row-${row.id}`}
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
                {row.paid_from === "cash" ? "เงินสดในลิ้นชัก" : "เงินโอน/ส่วนตัว"}
              </span>
              {isToday && (
                <div>
                  {deleteConfirmId === row.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(row.id!)}
                        className="ucom-danger bg-danger px-2 py-1 text-xs text-surface"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetDeleteConfirmId(null)}
                        className="ucom-secondary px-2 py-1 text-xs"
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

    </section>
  );
}
