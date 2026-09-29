"use client";

import { ACQUISITION_LABEL, STATUS_LABEL, type StockKind, type StockRow } from "./types";

const baht = (n: number | null) => (n == null ? "-" : `฿${n.toLocaleString("th-TH")}`);

const STATUS_TONE: Record<string, string> = {
  active: "bg-success-bg text-success",
  in_stock: "bg-success-bg text-success",
  consigned_out: "bg-warning-bg text-warning",
};

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

// Read-only: editing happens in the drawer, opened by clicking the row.
export function StockTable({ rows, kind, canEditCost, costById, onOpen }: {
  rows: StockRow[];
  kind: StockKind;
  canEditCost: boolean;
  costById: Record<string, number | null>;
  onOpen: (row: StockRow) => void;
}) {
  return (
    <div className="ucom-table-wrap">
      <table className="ucom-table">
        <StockTableHead kind={kind} canEditCost={canEditCost} />
        <tbody>
          {rows.map((row) => {
            if (!row.id || !row.kind) return null;
            const status = row.status ?? "";
            return (
              <tr key={`${row.kind}-${row.id}`} data-testid={`stock-row-${row.kind}-${row.id}`} onClick={() => onOpen(row)} className="cursor-pointer hover:bg-brand-ink/40">
                <td>
                  <button type="button" onClick={() => onOpen(row)} data-testid={`stock-open-${row.id}`} className="text-left focus-visible:outline-2 focus-visible:outline-accent">
                    <span data-testid={`stock-name-${row.id}`} className="block text-[13.5px] font-semibold text-ink">{row.name}</span>
                    <span className="block text-xs text-ink-muted">{row.code}</span>
                  </button>
                </td>
                <td className="text-[13px] text-ink-muted">{row.kind === "product" ? row.category_name ?? "-" : ACQUISITION_LABEL[row.acquisition ?? ""] ?? "-"}</td>
                {canEditCost && (
                  <td className="text-right text-[13.5px] font-semibold tabular-nums">
                    {row.acquisition === "consigned_in" ? <span className="text-ink-faint">-</span> : baht(costById[row.id] ?? null)}
                  </td>
                )}
                <td className="text-right text-[13.5px] font-semibold tabular-nums">{baht(row.price)}</td>
                {kind === "product" && <td className="text-right text-[13.5px] font-semibold tabular-nums">{(row.qty ?? 0).toLocaleString("th-TH")}</td>}
                <td>
                  <span className={`inline-block rounded-full px-2.5 py-[3px] text-[11px] font-semibold ${STATUS_TONE[status] ?? "border border-border-strong bg-sunken text-ink-muted"}`}>
                    {STATUS_LABEL[status] ?? status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
