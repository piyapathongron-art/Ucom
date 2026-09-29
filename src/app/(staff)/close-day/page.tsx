"use client";

import Link from "next/link";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { PageFrame } from "@/app/_components/PageFrame";
import BillsSection from "./BillsSection";
import ItemsSection from "./ItemsSection";
import LedgerSection from "./LedgerSection";
import ClosingSummary from "./ClosingSummary";
import ClosingForm from "./ClosingForm";
import { useCloseDayData } from "./useCloseDayData";

export default function CloseDayPage() {
  const d = useCloseDayData();

  return (
    <PageFrame
      page="close-day"
     
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
        ) : undefined
      }
    >

      {d.error && (
        <div data-testid="close-day-error">
          <ErrorPanel message={d.error} onRetry={() => { d.setIsLoading(true); void d.refetch(); }} />
        </div>
      )}

      {d.queuedCount > 0 && d.isToday && (
        <div data-testid="close-day-queue-warning" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          <span>ยังมีบิลค้างในคิว {d.queuedCount} ใบ ยอดยังไม่ครบ กรุณาซิงก์หรือจัดการบิลที่มีปัญหาก่อนปิดร้าน</span>
          <Link href="/pos" className="ucom-secondary px-4 py-1.5 text-xs text-ink">ไปที่หน้าขาย</Link>
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
              cashConsignmentPayoutTotal={d.cashConsignmentPayoutTotal}
              cashPartTotal={d.cashPartTotal}
              parts={d.parts}
              toSend={d.toSend}
              sfCount={d.sfCount}
              fmt={d.fmt}
            />

            <LedgerSection
              kind="income"
              rows={d.income.map((r) => ({ id: r.id!, name: r.name ?? "", amount: Number(r.amount), method: r.received_to }))}
              isToday={d.isToday}
              isOwner={d.isOwner}
              deleteConfirmId={d.incomeDeleteConfirmId}
              onSetDeleteConfirmId={d.setIncomeDeleteConfirmId}
              onAdd={d.handleAddIncome}
              onDelete={d.handleDeleteIncome}
              fmt={d.fmt}
              page={d.incomePage}
              pageSize={d.incomePageSize}
              total={d.incomeTotal}
              isLoading={d.isLoading}
              onPageChange={d.setIncomePage}
              onPageSizeChange={d.setIncomePageSize}
            />

            <LedgerSection
              kind="expense"
              rows={d.expenses.map((r) => ({ id: r.id!, name: r.name ?? "", amount: Number(r.amount), method: r.paid_from }))}
              isToday={d.isToday}
              isOwner={d.isOwner}
              deleteConfirmId={d.deleteConfirmId}
              onSetDeleteConfirmId={d.setDeleteConfirmId}
              onAdd={d.handleAddExpense}
              onDelete={d.handleDeleteExpense}
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
              closing={d.closing}
              toSend={d.toSend}
              countedCash={d.countedCash}
              onCountedCashChange={d.setCountedCash}
              closeNote={d.closeNote}
              onCloseNoteChange={d.setCloseNote}
              queuedCount={d.queuedCount}
              onSubmit={d.handleCloseDay}
              onResend={d.handleResend}
              isSending={d.isSending}
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
