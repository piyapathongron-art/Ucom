"use client";

import Link from "next/link";
import { useState } from "react";
import { LEDGER_METHOD_LABEL, LedgerAddDialog, type LedgerKind, type LedgerValues } from "@/app/_components/LedgerAddDialog";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { Button } from "@/components/ui/button";
import { useCashStatus } from "@/lib/cash/useCashStatus";
import { Panel, panelRow } from "./Panel";

export type CloseDayLedgerRow = { id: string; name: string; amount: number; method: string | null };

// Off-bill expense / income card of the close-day page. Add dialog is the shared one (no date: always today);
// owners also get a link to the full ledger page. Rows are a list, not a table, so they fit a phone.
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
  const cash = useCashStatus();
  const isExpense = kind === "expense";
  const prefix = `close-day-${kind}`;
  const methodLabel = (method: string | null) =>
    cash.isActive && method === "cash" ? (isExpense ? "เงินสด" : "เงินรอฝาก") : method ? LEDGER_METHOD_LABEL[kind][method] ?? method : "-";

  return (
    <Panel
      title={isExpense ? "รายจ่ายร้าน" : "รายรับนอกบิล"}
      action={<>
        {isOwner && <Link href="/expenses" data-testid={`${prefix}-ledger-link`} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">ดูทั้งหมดในหน้ารายรับ–รายจ่าย</Link>}
        {isToday && <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddOpen(true)} data-testid={`open-${prefix}-add`} className="bg-accent font-semibold text-accent-foreground">+ {isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับ"}</Button>}
      </>}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{isExpense ? "ไม่มีรายการรายจ่าย" : "ไม่มีรายการรายรับนอกบิล"}</p>
      ) : (
        <ul aria-label={isExpense ? "รายจ่ายร้าน" : "รายรับนอกบิล"}>
          {rows.map((row) => (
            <li key={row.id} data-testid={`${prefix}-row-${row.id}`} className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${panelRow}`}>
              <span className="min-w-0 flex-1 font-medium">{row.name}</span>
              <span className="tabular-nums">
                <span className="font-semibold">฿{fmt(row.amount)}</span>
                {row.method && <span className="text-muted-foreground"> · {isExpense ? "จ่ายจาก" : "รับเข้า"}{methodLabel(row.method)}</span>}
              </span>
              {isToday && (
                <span className="flex items-center gap-2">
                  {cash.isActive ? <Link href="/cash" className="inline-flex min-h-10 items-center text-xs font-semibold text-primary underline-offset-4 hover:underline">ให้เจ้าของแก้ไข</Link> : !cash.isReady ? <span className="text-xs text-muted-foreground">ตรวจสถานะเงินสด</span> : deleteConfirmId === row.id ? (
                    <>
                      <Button type="button" size="xs" onClick={() => void onDelete(row.id)} data-testid={`${prefix}-delete-confirm-${row.id}`} className="bg-danger font-bold text-on-accent hover:bg-danger/90">ยืนยันลบ</Button>
                      <Button type="button" size="xs" variant="outline" onClick={() => onSetDeleteConfirmId(null)}>ยกเลิก</Button>
                    </>
                  ) : (
                    <Button type="button" size="xs" variant="destructive" onClick={() => onSetDeleteConfirmId(row.id)} data-testid={`${prefix}-delete-${row.id}`}>ลบ</Button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {total > pageSize && <PaginationControls page={page} pageSize={pageSize} total={total} isLoading={isLoading} label={isExpense ? "รายจ่าย" : "รายรับนอกบิล"} testIdPrefix={`close-day-${isExpense ? "expenses" : "income"}-pagination`} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />}
      {isAddOpen && <LedgerAddDialog kind={kind} withDate={false} defaultDate="" testIdPrefix={prefix} onClose={() => setIsAddOpen(false)} onSubmit={onAdd} />}
    </Panel>
  );
}
