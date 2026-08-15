"use client";

import type { Tables } from "@/lib/types/database";

export type ExpenseRow = Tables<"expenses">;

interface ExpenseTableProps {
  expenses: ExpenseRow[];
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onDeleteExpense: (id: string) => Promise<void>;
}

export function ExpenseTable({
  expenses,
  deleteConfirmId,
  onSetDeleteConfirmId,
  onDeleteExpense,
}: ExpenseTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden rounded border border-border bg-surface overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="px-4 py-3 font-medium text-ink-muted">รายการ</th>
              <th className="px-4 py-3 font-medium text-ink-muted">จำนวนเงิน</th>
              <th className="px-4 py-3 font-medium text-ink-muted">วันที่</th>
              <th className="px-4 py-3 font-medium text-ink-muted">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-ink-muted">
                  ไม่มีรายการรายจ่ายในเดือนนี้
                </td>
              </tr>
            ) : (
              expenses.map((row) => (
                <tr key={row.id} data-testid={`expense-row-${row.id}`}>
                  <td className="px-4 py-3 text-ink">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {Number(row.amount).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.spent_at}</td>
                  <td className="px-4 py-3">
                    {deleteConfirmId === row.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(row.id)}
                          data-testid={`expense-delete-confirm-${row.id}`}
                          className="rounded bg-danger px-2 py-1 text-xs text-white hover:opacity-90"
                        >
                          ยืนยันลบ
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetDeleteConfirmId(null)}
                          className="text-xs text-ink-muted hover:text-ink"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetDeleteConfirmId(row.id)}
                        data-testid={`expense-delete-${row.id}`}
                        className="text-xs text-danger underline hover:opacity-80"
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className="space-y-3 md:hidden">
        {expenses.length === 0 ? (
          <div className="rounded border border-border bg-surface p-4 text-center text-sm text-ink-muted">
            ไม่มีรายการรายจ่ายในเดือนนี้
          </div>
        ) : (
          expenses.map((row) => (
            <div
              key={row.id}
              data-testid={`expense-row-${row.id}`}
              className="rounded border border-border bg-surface p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-ink text-base">{row.name}</span>
                <span className="font-mono font-semibold text-ink text-base">
                  {Number(row.amount).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-ink-muted pt-2 border-t border-border">
                <span>{row.spent_at}</span>
                <div>
                  {deleteConfirmId === row.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(row.id)}
                        className="rounded bg-danger px-2 py-1 text-xs text-white hover:opacity-90"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetDeleteConfirmId(null)}
                        className="text-xs text-ink-muted hover:text-ink"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetDeleteConfirmId(row.id)}
                      className="text-xs text-danger underline hover:opacity-80"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
