"use client";

import { ACQUISITION_LABEL, STATUS_LABEL, type StockKind, type StockRow } from "./types";

const baht = (n: number | null) => (n == null ? "-" : `฿${n.toLocaleString("th-TH")}`);

// Status chips on the ADR 0033 status pairs (text on tint). Not-for-sale states are muted.
const STATUS_TONE: Record<string, string> = {
  active: "bg-success-bg text-success",
  in_stock: "bg-success-bg text-success",
  consigned_out: "bg-warning-bg text-warning",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_TONE[status] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function StockTableHead({ kind, canEditCost }: { kind: StockKind; canEditCost: boolean }) {
  const isProduct = kind === "product";
  return (
    <thead>
      <tr>
        <th>{isProduct ? "สินค้า" : "เครื่อง"}</th>
        <th>{isProduct ? "หมวด" : "ที่มา"}</th>
        {canEditCost && <th className="text-right" data-testid="cost-column-header">ต้นทุน</th>}
        <th className="text-right">ราคาขาย</th>
        {isProduct && <th className="text-right">คงเหลือ</th>}
        <th>สถานะ</th>
      </tr>
    </thead>
  );
}

// Read-only: editing happens in the drawer, opened by clicking the row. From md up this is a table;
// below md each row is a card (ADR 0015's narrow-screen rule, kept by ADR 0033).
export function StockTable({ rows, kind, canEditCost, costById, onOpen }: {
  rows: StockRow[];
  kind: StockKind;
  canEditCost: boolean;
  costById: Record<string, number | null>;
  onOpen: (row: StockRow) => void;
}) {
  const costOf = (row: StockRow) => (row.acquisition === "consigned_in" ? null : costById[row.id ?? ""] ?? null);
  const groupOf = (row: StockRow) => (row.kind === "product" ? row.category_name ?? "-" : ACQUISITION_LABEL[row.acquisition ?? ""] ?? "-");

  return (
    <>
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <StockTableHead kind={kind} canEditCost={canEditCost} />
          <tbody>
            {rows.map((row) => {
              if (!row.id || !row.kind) return null;
              return (
                <tr key={`${row.kind}-${row.id}`} data-testid={`stock-row-${row.kind}-${row.id}`} onClick={() => onOpen(row)} className="cursor-pointer hover:bg-muted">
                  <td>
                    <button type="button" onClick={() => onOpen(row)} data-testid={`stock-open-${row.id}`} className="min-h-10 text-left focus-visible:outline-2 focus-visible:outline-primary">
                      <span data-testid={`stock-name-${row.id}`} className="block text-sm font-semibold text-foreground">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">{row.code}</span>
                    </button>
                  </td>
                  <td className="text-sm text-muted-foreground">{groupOf(row)}</td>
                  {canEditCost && (
                    <td className="text-right text-sm font-semibold tabular-nums">
                      {row.acquisition === "consigned_in" ? <span className="text-muted-foreground">-</span> : baht(costOf(row))}
                    </td>
                  )}
                  <td className="text-right text-sm font-semibold tabular-nums">{baht(row.price)}</td>
                  {kind === "product" && <td className="text-right text-sm font-semibold tabular-nums">{(row.qty ?? 0).toLocaleString("th-TH")}</td>}
                  <td><StatusChip status={row.status ?? ""} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden" aria-label={kind === "product" ? "รายการสินค้า" : "รายการเครื่อง"}>
        {rows.map((row) => {
          if (!row.id || !row.kind) return null;
          return (
            <li key={`card-${row.kind}-${row.id}`}>
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex w-full flex-col gap-2 rounded-xl bg-card p-4 text-left shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.code} · {groupOf(row)}</p>
                  </div>
                  <StatusChip status={row.status ?? ""} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">ราคาขาย</dt><dd className="font-semibold tabular-nums">{baht(row.price)}</dd></div>
                  {canEditCost && <div><dt className="text-xs text-muted-foreground">ต้นทุน</dt><dd className="font-semibold tabular-nums">{baht(costOf(row))}</dd></div>}
                  {kind === "product" && <div><dt className="text-xs text-muted-foreground">คงเหลือ</dt><dd className="font-semibold tabular-nums">{(row.qty ?? 0).toLocaleString("th-TH")}</dd></div>}
                </dl>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
