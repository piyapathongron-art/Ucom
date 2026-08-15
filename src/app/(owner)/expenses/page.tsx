"use client";

import { ExpenseTable } from "./ExpenseTable";
import { useExpensesPage } from "./useExpensesPage";

export default function ExpensesPage() {
  const {
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenses,
    walletBalances,
    carriers,
    selectedCarrier,
    setSelectedCarrier,
    topupAmount,
    setTopupAmount,
    error,
    isLoading,
    deleteConfirmId,
    setDeleteConfirmId,
    handleAddExpense,
    handleDeleteExpense,
    handleAddTopup,
    totalExpense,
  } = useExpensesPage();

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold text-ink">รายจ่าย & เติมเงินวอลเล็ต</h1>

      {error && (
        <div
          data-testid="expenses-error"
          className="rounded border border-danger/20 bg-danger/10 p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <>
          {/* Section 1: Expenses */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-ink">รายจ่าย</h2>

            <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  รายการ
                </label>
                <input
                  type="text"
                  required
                  data-testid="expense-name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="rounded border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface text-ink"
                  placeholder="ชื่อรายการ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  data-testid="expense-amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="rounded border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface text-ink"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  วันที่
                </label>
                <input
                  type="date"
                  required
                  data-testid="expense-date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="rounded border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface text-ink"
                />
              </div>

              <button
                type="submit"
                data-testid="expense-submit"
                className="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                บันทึกรายจ่าย
              </button>
            </form>

            <ExpenseTable
              expenses={expenses}
              deleteConfirmId={deleteConfirmId}
              onSetDeleteConfirmId={setDeleteConfirmId}
              onDeleteExpense={handleDeleteExpense}
            />

            <div data-testid="expense-total" className="text-right font-medium text-ink">
              รวม:{" "}
              <span className="font-mono">
                {totalExpense.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>{" "}
              บาท
            </div>
          </section>

          <hr className="border-border" />

          {/* Section 2: Wallet top-up */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-ink">เติมเงินวอลเล็ต</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletBalances.map((wb) => (
                <div
                  key={wb.carrier_id ?? wb.name}
                  data-testid={`wallet-balance-${wb.carrier_id}`}
                  className="rounded border border-border bg-surface p-4 space-y-2"
                >
                  <div className="font-semibold text-lg text-ink">{wb.name}</div>
                  <div className="text-sm text-ink-muted flex justify-between">
                    <span>ยอดเติมสะสม:</span>
                    <span className="font-mono">
                      {Number(wb.topped_up ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <div className="text-sm text-ink-muted flex justify-between">
                    <span>ยอดใช้ไป:</span>
                    <span className="font-mono">
                      {Number(wb.spent ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-ink flex justify-between pt-2 border-t border-border">
                    <span>คงเหลือ:</span>
                    <span className="font-mono">
                      {Number(wb.balance ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddTopup} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  ผู้ให้บริการ
                </label>
                <select
                  data-testid="topup-carrier"
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="rounded border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface text-ink"
                >
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  จำนวนเงินเติม (บาท)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  data-testid="topup-amount"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="rounded border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ink bg-surface text-ink"
                  placeholder="0.00"
                />
              </div>

              <button
                type="submit"
                data-testid="topup-submit"
                className="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                บันทึกเติมเงิน
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
