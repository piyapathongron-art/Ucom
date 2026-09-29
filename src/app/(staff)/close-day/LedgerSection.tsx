"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/app/_components/EmptyState";
import { LEDGER_METHOD_LABEL, LedgerAddDialog, type LedgerKind, type LedgerValues } from "@/app/_components/LedgerAddDialog";
import { PaginationControls } from "@/app/_components/PaginationControls";

export type CloseDayLedgerRow = { id: string; name: string; amount: number; method: string | null };

// Off-bill expense / income card of the close-day page. Add dialog is the shared one (no date: always today);
// owners also get a link to the full ledger page.
export default function LedgerSection({ kind, rows, isToday, isOwner, deleteConfirmId, onSetDeleteConfirmId, onAdd, onDelete, fmt, page, pageSize, total, isLoading, onPageChange, onPageSizeChange }: {
  kind: LedgerKind;
  rows: CloseDayLedgerRow[];
  isToday: boolean;
  isOwner: boolean;
  deleteConfirmId: string | null;
  onSetDeleteConfirmId: (id: string | null) => void;
  onAdd: (values: LedgerValues) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
  fmt: (n: number) => string;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const isExpense = kind === "expense";
  const prefix = `close-day-${kind}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{isExpense ? "รายจ่ายร้าน" : "รายรับนอกบิล"}</h2>
        <div className="flex items-center gap-2">
          {isOwner && <Link href="/expenses" data-testid={`${prefix}-ledger-link`} className="text-xs font-semibold text-accent underline">ดูทั้งหมดในหน้ารายรับ–รายจ่าย</Link>}
          {isToday && <button type="button" onClick={() => setIsAddOpen(true)} data-testid={`open-${prefix}-add`} className="ucom-secondary px-4 py-2 text-sm">+ {isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับ"}</button>}
        </div>
      </div>

      {rows.length === 0 ? <EmptyState title={isExpense ? "ไม่มีรายการรายจ่าย" : "ไม่มีรายการรายรับนอกบิล"} /> : (
        <div className="ucom-table-wrap">
          <table className="ucom-table">
            <thead><tr><th>รายการ</th><th className="text-right">จำนวนเงิน</th><th>{isExpense ? "จ่ายจาก" : "รับเข้า"}</th>{isToday && <th />}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid={`${prefix}-row-${row.id}`}>
                  <td className="text-[13.5px] font-semibold">{row.name}</td>
                  <td className="text-right text-[13.5px] font-semibold tabular-nums">{fmt(row.amount)}</td>
                  <td className="text-[13px] text-ink-muted">{row.method ? LEDGER_METHOD_LABEL[kind][row.method] ?? row.method : "-"}</td>
                  {isToday && (
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {deleteConfirmId === row.id ? (
                          <>
                            <button type="button" onClick={() => void onDelete(row.id)} data-testid={`${prefix}-delete-confirm-${row.id}`} className="rounded-full bg-danger px-3.5 py-1.5 text-xs font-bold text-on-accent">ยืนยันลบ</button>
                            <button type="button" onClick={() => onSetDeleteConfirmId(null)} className="ucom-secondary px-3.5 py-1.5 text-xs">ยกเลิก</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => onSetDeleteConfirmId(row.id)} data-testid={`${prefix}-delete-${row.id}`} className="ucom-danger px-3.5 py-1.5 text-xs">ลบ</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationControls page={page} pageSize={pageSize} total={total} isLoading={isLoading} label={isExpense ? "รายจ่าย" : "รายรับนอกบิล"} testIdPrefix={`close-day-${isExpense ? "expenses" : "income"}-pagination`} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
      {isAddOpen && <LedgerAddDialog kind={kind} withDate={false} defaultDate="" testIdPrefix={prefix} onClose={() => setIsAddOpen(false)} onSubmit={onAdd} />}
    </section>
  );
}
