"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/app/_components/EmptyState";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { LEDGER_METHOD_LABEL, LedgerAddDialog } from "@/app/_components/LedgerAddDialog";
import { PageFrame } from "@/app/_components/PageFrame";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { useLedgerPage, type LedgerTab } from "./useLedgerPage";

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TABS: [LedgerTab, string][] = [["expense", "รายจ่าย"], ["income", "รายรับนอกบิล"]];
const FILTER = "ucom-field h-10 px-3 text-sm font-normal";

type Ledger = ReturnType<typeof useLedgerPage>;
type Row = Ledger["rows"][number];

function Head({ methodLabel }: { methodLabel: string }) {
  return <thead><tr><th>วันที่</th><th>รายการ</th><th>{methodLabel}</th><th className="text-right">จำนวนเงิน</th><th><span className="sr-only">จัดการ</span></th></tr></thead>;
}

function methodText(l: Ledger, row: Row) {
  if (l.cash.isActive && row.method === "cash") return l.tab === "income" ? "เงินรอฝาก" : "เงินสด";
  return row.method ? LEDGER_METHOD_LABEL[l.tab][row.method] ?? row.method : "-";
}

// The phone card renders this without test IDs, so each ID stays unique on the page.
function RowAction({ l, row, withTestIds }: { l: Ledger; row: Row; withTestIds: boolean }) {
  if (l.cash.isActive) return <Link href="/cash" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-2">แก้ไขพร้อมเหตุผล</Link>;
  if (!l.cash.isReady) return <span className="text-sm text-muted-foreground">กำลังตรวจสถานะเงินสด</span>;
  if (l.deleteConfirmId === row.id) return <>
    <button type="button" onClick={() => void l.deleteEntry(row.id)} data-testid={withTestIds ? `expense-delete-confirm-${row.id}` : undefined} className="h-10 rounded-full bg-danger px-4 text-sm font-bold text-on-accent">ยืนยันลบ</button>
    <button type="button" onClick={() => l.setDeleteConfirmId(null)} className="ucom-secondary px-4">ยกเลิก</button>
  </>;
  return <button type="button" onClick={() => l.setDeleteConfirmId(row.id)} data-testid={withTestIds ? `expense-delete-${row.id}` : undefined} className="ucom-danger px-4">ลบ</button>;
}

export default function LedgerPage() {
  const l = useLedgerPage();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const isExpense = l.tab === "expense";
  const methodLabel = isExpense ? "จ่ายจาก" : "รับเข้า";
  const total = isExpense ? l.expenseTotal : l.incomeTotal;
  const net = l.incomeTotal - l.expenseTotal;
  const isFiltered = l.search !== "";

  return (
    <PageFrame
      page="expenses"
      title="รายรับ–รายจ่ายนอกบิล"
      description="เฉพาะรายการที่ไม่ผ่านบิลขาย — ยอดขายไม่รวมอยู่ในหน้านี้"
      actions={
        <>
          <Link href="/close-day" className="ucom-secondary h-11 px-5">ไปหน้าปิดร้าน</Link>
          <button type="button" onClick={() => setIsAddOpen(true)} data-testid="open-ledger-add" className="ucom-primary h-11 px-5">
            + {isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับ"}
          </button>
        </>
      }
    >
      {l.error && <div data-testid="expenses-error"><ErrorPanel message={l.error} onRetry={l.reload} /></div>}

      <div className="ucom-toolbar items-end">
        <div role="tablist" aria-label="ประเภท" className="flex gap-1 rounded-full bg-muted p-1">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" type="button" aria-selected={l.tab === key} data-testid={`ledger-tab-${key}`} onClick={() => l.setTab(key)} className={`h-10 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${l.tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">ตั้งแต่<input type="date" value={l.filterFrom} onChange={(e) => { l.setFilterFrom(e.target.value); l.setPage(1); }} data-testid="expense-filter-from" className={FILTER} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">ถึง<input type="date" value={l.filterTo} onChange={(e) => { l.setFilterTo(e.target.value); l.setPage(1); }} data-testid="expense-filter-to" className={FILTER} /></label>
        </div>
        <label className="ml-auto flex w-full items-center gap-2 rounded-xl border border-input bg-card px-3.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25 md:w-72">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <span className="sr-only">ค้นหาชื่อรายการ</span>
          <input value={l.search} onChange={(e) => { l.setSearch(e.target.value); l.setPage(1); }} data-testid="expense-filter-search" placeholder="ค้นหาชื่อรายการ" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
      </div>

      {l.isLoading && l.rows.length === 0 ? <SkeletonRows cols={5} head={<Head methodLabel={methodLabel} />} /> : l.rows.length > 0 ? (<>
        <div className="ucom-table-wrap hidden md:block">
          <table className="ucom-table">
            <Head methodLabel={methodLabel} />
            <tbody>
              {l.rows.map((row) => (
                <tr key={row.id} data-testid={`expense-row-${row.id}`}>
                  <td className="text-sm text-muted-foreground tabular-nums">{row.day}</td>
                  <td className="text-sm font-semibold">{row.name}</td>
                  <td><span className="rounded-full bg-muted px-3 py-1 text-sm">{methodText(l, row)}</span></td>
                  <td className="text-right text-sm font-semibold tabular-nums">{money(row.amount)}</td>
                  <td><div className="flex items-center justify-end gap-2"><RowAction l={l} row={row} withTestIds /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="space-y-3 md:hidden">
          {l.rows.map((row) => (
            <li key={row.id} className="rounded-xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{row.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">{row.day}<span className="rounded-full bg-muted px-3 py-0.5">{methodText(l, row)}</span></div>
                </div>
                <div className="shrink-0 font-bold tabular-nums">{money(row.amount)}</div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-2"><RowAction l={l} row={row} withTestIds={false} /></div>
            </li>
          ))}
        </ul>
      </>) : !l.error && (isFiltered
        ? <EmptyState title="ไม่พบรายการตามตัวกรอง" onClearFilter={() => { l.setSearch(""); l.setPage(1); }} />
        : <EmptyState title={isExpense ? "ไม่มีรายจ่ายในช่วงนี้" : "ไม่มีรายรับนอกบิลในช่วงนี้"} hint="กดปุ่มมุมขวาบนเพื่อบันทึกรายการ" />)}

      <PaginationControls page={l.page} pageSize={l.pageSize} total={l.totalCount} isLoading={l.isLoading} label={isExpense ? "รายจ่าย" : "รายรับ"} testIdPrefix="expense-pagination" onPageChange={l.setPage} onPageSizeChange={(v) => { l.setPageSize(v); l.setPage(1); }} />

      <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 rounded-xl bg-card px-5 py-4 shadow-card">
        <p data-testid="expense-total">รวม{isExpense ? "รายจ่าย" : "รายรับ"}: <span className="text-lg font-bold tabular-nums">{money(total)}</span> บาท</p>
        <p data-testid="ledger-net" className={net < 0 ? "text-danger" : "text-success"}>สุทธิ (รับ − จ่าย): <span className="text-lg font-bold tabular-nums">{money(net)}</span> บาท</p>
      </div>

      {isAddOpen && <LedgerAddDialog kind={l.tab} withDate={isExpense} defaultDate={l.today} testIdPrefix={isExpense ? "expense" : "income"} onClose={() => setIsAddOpen(false)} onSubmit={l.addEntry} />}
    </PageFrame>
  );
}
