"use client";

import { ExpenseTable } from "./ExpenseTable";
import { useExpensesPage } from "./useExpensesPage";
import { PageFrame } from "@/app/_components/PageFrame";
import { PaginationControls } from "@/app/_components/PaginationControls";

export default function ExpensesPage() {
  const {
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenses,
    filterFrom,
    setFilterFrom,
    filterTo,
    setFilterTo,
    expenseSearch,
    setExpenseSearch,
    expensePage,
    setExpensePage,
    expensePageSize,
    setExpensePageSize,
    expenseTotalCount,
    isExpensesLoading,
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
    retry,
  } = useExpensesPage();

  return (
    <PageFrame
      page="expenses"
      eyebrow="OWNER / CASH LEDGER"
      title="รายจ่าย & เติมเงินวอลเล็ต"
      description="บันทึกรายจ่าย ตรวจยอดรวม และเติมเงินคงเหลือของแต่ละค่าย"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">OWNER ONLY</span>}
    >

      {error && (
        <div
          data-testid="expenses-error"
          className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-4 text-sm text-danger"
        >
          <span>{error}</span>
          <button type="button" onClick={retry} className="ucom-danger px-3 py-1.5 text-sm">
            ลองใหม่
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <>
          {/* Section 1: Expenses */}
          <section className="space-y-5">
            <h2 className="text-xl font-semibold text-ink">รายจ่าย</h2>

            <form onSubmit={handleAddExpense} className="ucom-toolbar items-end">
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
                  className="ucom-field px-3 py-2 text-sm"
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
                  className="ucom-field px-3 py-2 text-sm"
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
                  className="ucom-field px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                data-testid="expense-submit"
                className="ucom-primary px-4 py-2 text-sm"
              >
                บันทึกรายจ่าย
              </button>
            </form>

            <div className="ucom-toolbar items-end">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(event) => {
                    setFilterFrom(event.target.value);
                    setExpensePage(1);
                  }}
                  data-testid="expense-filter-from"
                  className="ucom-field px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(event) => {
                    setFilterTo(event.target.value);
                    setExpensePage(1);
                  }}
                  data-testid="expense-filter-to"
                  className="ucom-field px-3 py-2 text-sm"
                />
              </div>
              <input
                value={expenseSearch}
                onChange={(event) => {
                  setExpenseSearch(event.target.value);
                  setExpensePage(1);
                }}
                data-testid="expense-filter-search"
                placeholder="ค้นหาชื่อรายการ"
                className="ucom-field w-full px-3 py-2 text-sm md:w-72"
              />
            </div>

            {isExpensesLoading ? (
              <p className="text-sm text-ink-muted">กำลังโหลดรายการรายจ่าย...</p>
            ) : (
              <ExpenseTable
                expenses={expenses}
                deleteConfirmId={deleteConfirmId}
                onSetDeleteConfirmId={setDeleteConfirmId}
                onDeleteExpense={handleDeleteExpense}
              />
            )}

            <PaginationControls
              page={expensePage}
              pageSize={expensePageSize}
              total={expenseTotalCount}
              isLoading={isExpensesLoading}
              label="รายจ่าย"
              testIdPrefix="expense-pagination"
              onPageChange={setExpensePage}
              onPageSizeChange={(value) => {
                setExpensePageSize(value);
                setExpensePage(1);
              }}
            />

            <div data-testid="expense-total" className="border-t border-border pt-3 text-right font-medium text-ink">
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
          <section className="space-y-5">
            <h2 className="text-xl font-semibold text-ink">เติมเงินวอลเล็ต</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletBalances.map((wb) => (
                <div
                  key={wb.carrier_id ?? wb.name}
                  data-testid={`wallet-balance-${wb.carrier_id}`}
                  className="ucom-surface space-y-2 p-4"
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

            <form onSubmit={handleAddTopup} className="ucom-toolbar items-end">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-1">
                  ผู้ให้บริการ
                </label>
                <select
                  data-testid="topup-carrier"
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="ucom-field px-3 py-2 text-sm"
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
                  className="ucom-field px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>

              <button
                type="submit"
                data-testid="topup-submit"
                className="ucom-primary px-4 py-2 text-sm"
              >
                บันทึกเติมเงิน
              </button>
            </form>
          </section>
        </>
      )}
    </PageFrame>
  );
}
