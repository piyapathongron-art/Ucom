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

function Head({ methodLabel }: { methodLabel: string }) {
  return <thead><tr><th>วันที่</th><th>รายการ</th><th>{methodLabel}</th><th className="text-right">จำนวนเงิน</th><th /></tr></thead>;
}

export default function LedgerPage() {
  const l = useLedgerPage();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const isExpense = l.tab === "expense";
  const methodLabel = isExpense ? "จ่ายจาก" : "รับเข้า";
  const total = isExpense ? l.expenseTotal : l.incomeTotal;
  const net = l.incomeTotal - l.expenseTotal;
  const isFiltered = l.search !== "";
  const filterCls = "ucom-field px-4 py-2 text-sm";

  return (
    <PageFrame
      page="expenses"
      title="รายรับ–รายจ่ายนอกบิล"
      description="เฉพาะรายการที่ไม่ผ่านบิลขาย — ยอดขายไม่รวมอยู่ในหน้านี้"
      actions={
        <>
          <Link href="/close-day" className="ucom-secondary px-[18px] py-2.5">ไปหน้าปิดร้าน</Link>
          <button type="button" onClick={() => setIsAddOpen(true)} data-testid="open-ledger-add" className="ucom-primary px-[18px] py-2.5">
            + {isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับ"}
          </button>
        </>
      }
    >
      {l.error && <div data-testid="expenses-error"><ErrorPanel message={l.error} onRetry={l.reload} /></div>}

      <div className="ucom-toolbar">
        <div role="tablist" className="flex gap-1 rounded-full bg-sunken p-1">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" type="button" aria-selected={l.tab === key} data-testid={`ledger-tab-${key}`} onClick={() => l.setTab(key)} className={`rounded-full px-5 py-1.5 text-sm ${l.tab === key ? "bg-brand-ink font-semibold text-white" : "text-ink-muted"}`}>{label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">ตั้งแต่<input type="date" value={l.filterFrom} onChange={(e) => { l.setFilterFrom(e.target.value); l.setPage(1); }} data-testid="expense-filter-from" className={filterCls} /></label>
        <label className="flex items-center gap-2 text-xs text-ink-muted">ถึง<input type="date" value={l.filterTo} onChange={(e) => { l.setFilterTo(e.target.value); l.setPage(1); }} data-testid="expense-filter-to" className={filterCls} /></label>
        <input value={l.search} onChange={(e) => { l.setSearch(e.target.value); l.setPage(1); }} data-testid="expense-filter-search" placeholder="ค้นหาชื่อรายการ" className={`${filterCls} ml-auto w-full md:w-72`} />
      </div>

      {l.isLoading && l.rows.length === 0 ? <SkeletonRows cols={5} head={<Head methodLabel={methodLabel} />} /> : l.rows.length > 0 ? (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
            <Head methodLabel={methodLabel} />
            <tbody>
              {l.rows.map((row) => (
                <tr key={row.id} data-testid={`expense-row-${row.id}`}>
                  <td className="text-[13px] text-ink-muted">{row.day}</td>
                  <td className="text-[13.5px] font-semibold">{row.name}</td>
                  <td className="text-[13px] text-ink-muted">{row.method ? LEDGER_METHOD_LABEL[l.tab][row.method] ?? row.method : "-"}</td>
                  <td className="text-right text-[13.5px] font-semibold tabular-nums">{money(row.amount)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {l.deleteConfirmId === row.id ? (
                        <>
                          <button type="button" onClick={() => void l.deleteEntry(row.id)} data-testid={`expense-delete-confirm-${row.id}`} className="rounded-full bg-danger px-3.5 py-1.5 text-xs font-bold text-on-accent">ยืนยันลบ</button>
                          <button type="button" onClick={() => l.setDeleteConfirmId(null)} className="ucom-secondary px-3.5 py-1.5 text-xs">ยกเลิก</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => l.setDeleteConfirmId(row.id)} data-testid={`expense-delete-${row.id}`} className="ucom-danger px-3.5 py-1.5 text-xs">ลบ</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !l.error && (isFiltered
        ? <EmptyState title="ไม่พบรายการตามตัวกรอง" onClearFilter={() => { l.setSearch(""); l.setPage(1); }} />
        : <EmptyState title={isExpense ? "ไม่มีรายจ่ายในช่วงนี้" : "ไม่มีรายรับนอกบิลในช่วงนี้"} hint="กดปุ่มมุมขวาบนเพื่อบันทึกรายการ" />)}

      <PaginationControls page={l.page} pageSize={l.pageSize} total={l.totalCount} isLoading={l.isLoading} label={isExpense ? "รายจ่าย" : "รายรับ"} testIdPrefix="expense-pagination" onPageChange={l.setPage} onPageSizeChange={(v) => { l.setPageSize(v); l.setPage(1); }} />

      <div className="ucom-surface flex flex-wrap items-center justify-end gap-x-8 gap-y-1 px-6 py-4 text-sm">
        <p data-testid="expense-total">รวม{isExpense ? "รายจ่าย" : "รายรับ"}: <span className="font-semibold tabular-nums">{money(total)}</span> บาท</p>
        <p data-testid="ledger-net" className={net < 0 ? "text-danger" : "text-success"}>สุทธิ (รับ − จ่าย): <span className="font-semibold tabular-nums">{money(net)}</span> บาท</p>
      </div>

      {isAddOpen && <LedgerAddDialog kind={l.tab} withDate={isExpense} defaultDate={l.today} testIdPrefix={isExpense ? "expense" : "income"} onClose={() => setIsAddOpen(false)} onSubmit={l.addEntry} />}
    </PageFrame>
  );
}
