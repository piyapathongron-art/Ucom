"use client";

import Link from "next/link";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { PageFrame } from "@/app/_components/PageFrame";
import { Button } from "@/components/ui/button";
import BillsSection from "./BillsSection";
import ItemsSection from "./ItemsSection";
import LedgerSection from "./LedgerSection";
import ClosingSummary from "./ClosingSummary";
import ClosingForm from "./ClosingForm";
import { useCloseDayData } from "./useCloseDayData";
import CashClosing from "./CashClosing";

export default function CloseDayPage() {
  const d = useCloseDayData();
  const openedDate = d.cash.status?.openedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d.cash.status.openedAt)) : null;
  const shouldUseCash = d.cash.isActive && (d.isToday || !openedDate || d.date >= openedDate);

  return (
    <PageFrame
      page="close-day"
     
      title="ปิดร้าน / สรุปรายวัน"
      description={d.isToday ? "ตรวจยอดเงินสดและส่งมอบก่อนปิดวัน" : "ดูประวัติการปิดวันแบบอ่านอย่างเดียว"}
      dataLoading={d.isLoading}
      actions={
        d.isOwner && d.roleResolved ? (
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
            วันที่
            <input
              type="date"
              value={d.date}
              onChange={e => d.applyDate(e.target.value)}
              className="ucom-field h-11 rounded-full px-4 text-sm"
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
        <div data-testid="close-day-queue-warning" role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-bg px-5 py-4 text-sm text-warning">
          <span><b className="font-bold">ยังมีบิลค้างในคิว {d.queuedCount} ใบ</b> ยอดยังไม่ครบ กรุณาซิงก์หรือจัดการบิลที่มีปัญหาก่อนปิดร้าน</span>
          <Button asChild size="sm" className="bg-warning font-semibold text-on-accent hover:bg-warning/90"><Link href="/pos">ไปที่หน้าขาย</Link></Button>
        </div>
      )}

      {d.isLoading ? (
        <div aria-busy="true" aria-label="กำลังโหลด" className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {[18, 10].map((first, i) => (
            <div key={i} className="flex flex-col gap-4">
              {[first, 8].map((rem, j) => <div key={j} style={{ height: `${rem}rem` }} className="animate-pulse rounded-xl bg-card shadow-card motion-reduce:animate-none" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          {/* ซ้าย: กล่องปิดร้าน — ยอดระบบ, รายรับนอกบิล, รายจ่ายประจำวัน, นับเงินสด, ยืนยัน */}
          <div className="flex min-w-0 flex-col gap-4">
            {shouldUseCash ? <CashClosing key={d.date} date={d.date} isToday={d.isToday} queuedCount={d.queuedCount} /> : d.cash.isReady ? <ClosingSummary
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
            /> : <p role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{d.cash.error ?? "กำลังตรวจระบบเงินสด..."}</p>}

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

            {!shouldUseCash && d.cash.isReady && <ClosingForm
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
            />}
          </div>

          {/* ขวา: บิลวันนี้ (ขึ้นก่อน) ตามด้วยสรุปสินค้าของวันนั้น */}
          <div className="flex min-w-0 flex-col gap-4">
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
