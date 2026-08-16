"use client";

import { PageFrame } from "@/app/_components/PageFrame";
import BillsSection from "./BillsSection";
import ItemsSection from "./ItemsSection";
import ExpensesSection from "./ExpensesSection";
import IncomeSection from "./IncomeSection";
import ClosingSummary from "./ClosingSummary";
import ClosingForm from "./ClosingForm";
import { useCloseDayData } from "./useCloseDayData";

export default function CloseDayPage() {
  const d = useCloseDayData();

  return (
    <PageFrame
      page="close-day"
      eyebrow="CASH HANDOVER / DAILY LEDGER"
      title="ปิดร้าน / สรุปรายวัน"
      description={d.isToday ? "ตรวจยอดเงินสดและส่งมอบก่อนปิดวัน" : "ดูประวัติการปิดวันแบบอ่านอย่างเดียว"}
      dataLoading={d.isLoading}
      actions={
        d.isOwner && d.roleResolved ? (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <span>วันที่</span>
            <input
              type="date"
              value={d.date}
              onChange={e => d.applyDate(e.target.value)}
              className="ucom-field px-3 py-1.5 text-sm"
            />
          </label>
        ) : (
          <span className="font-mono text-xs tracking-wide text-ink-muted">TODAY / STAFF</span>
        )
      }
    >

      {d.error && (
        <div data-testid="close-day-error" className="flex flex-wrap items-center justify-between gap-3 rounded border border-danger bg-danger/10 p-4 text-sm text-danger">
          <span>{d.error}</span>
          <button
            type="button"
            onClick={() => {
              d.setIsLoading(true);
              void d.refetch();
            }}
            className="ucom-danger px-3 py-1.5 text-sm"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {d.queuedCount > 0 && d.isToday && (
        <div data-testid="close-day-queue-warning" className="rounded border border-warning bg-warning/10 p-4 text-sm text-warning">
          ยังมีบิลค้างในคิว {d.queuedCount} ใบ ยอดยังไม่ครบ กรุณาซิงก์ก่อนปิดร้าน
        </div>
      )}

      {d.isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ซ้าย: กล่องปิดร้าน — ยอดระบบ, รายรับนอกบิล, รายจ่ายประจำวัน, นับเงินสด, ยืนยัน */}
          <div className="space-y-8">
            <ClosingSummary
              cashTotal={d.cashTotal}
              transferTotal={d.transferTotal}
              cashIncomeTotal={d.cashIncomeTotal}
              cashExpenseTotal={d.cashExpenseTotal}
              toSend={d.toSend}
              sfCount={d.sfCount}
              fmt={d.fmt}
            />

            <IncomeSection
              income={d.income}
              isToday={d.isToday}
              deleteConfirmId={d.incomeDeleteConfirmId}
              onSetDeleteConfirmId={d.setIncomeDeleteConfirmId}
              onAddIncome={d.handleAddIncome}
              onDeleteIncome={d.handleDeleteIncome}
              incomeName={d.incomeName}
              onIncomeNameChange={d.setIncomeName}
              incomeAmount={d.incomeAmount}
              onIncomeAmountChange={d.setIncomeAmount}
              incomeReceivedTo={d.incomeReceivedTo}
              onIncomeReceivedToChange={d.setIncomeReceivedTo}
              fmt={d.fmt}
              page={d.incomePage}
              pageSize={d.incomePageSize}
              total={d.incomeTotal}
              isLoading={d.isLoading}
              onPageChange={d.setIncomePage}
              onPageSizeChange={d.setIncomePageSize}
            />

            <ExpensesSection
              expenses={d.expenses}
              isToday={d.isToday}
              deleteConfirmId={d.deleteConfirmId}
              onSetDeleteConfirmId={d.setDeleteConfirmId}
              onAddExpense={d.handleAddExpense}
              onDeleteExpense={d.handleDeleteExpense}
              expenseName={d.expenseName}
              onExpenseNameChange={d.setExpenseName}
              expenseAmount={d.expenseAmount}
              onExpenseAmountChange={d.setExpenseAmount}
              expensePaidFrom={d.expensePaidFrom}
              onExpensePaidFromChange={d.setExpensePaidFrom}
              fmt={d.fmt}
              page={d.expensePage}
              pageSize={d.expensePageSize}
              total={d.expenseTotal}
              isLoading={d.isLoading}
              onPageChange={d.setExpensePage}
              onPageSizeChange={d.setExpensePageSize}
            />

            <ClosingForm
              isToday={d.isToday}
              isClosingSuccess={d.isClosingSuccess}
              closing={d.closing}
              toSend={d.toSend}
              countedCash={d.countedCash}
              onCountedCashChange={d.setCountedCash}
              closeNote={d.closeNote}
              onCloseNoteChange={d.setCloseNote}
              queuedCount={d.queuedCount}
              onSubmit={d.handleCloseDay}
              fmt={d.fmt}
            />
          </div>

          {/* ขวา: บิลวันนี้ (ขึ้นก่อน) ตามด้วยสรุปสินค้าของวันนั้น */}
          <div className="space-y-8">
            <BillsSection
              bills={d.bills}
              fmt={d.fmt}
              page={d.billPage}
              pageSize={d.billPageSize}
              total={d.billTotal}
              isLoading={d.isLoading}
              onPageChange={d.setBillPage}
              onPageSizeChange={d.setBillPageSize}
            />
            <ItemsSection
              items={d.items}
              fmt={d.fmt}
              page={d.itemPage}
              pageSize={d.itemPageSize}
              total={d.itemTotal}
              isLoading={d.isLoading}
              onPageChange={d.setItemPage}
              onPageSizeChange={d.setItemPageSize}
            />
          </div>
        </div>
      )}
    </PageFrame>
  );
}
