"use client";

import type { Tables } from "@/lib/types/database";

type TopupSale = Tables<"v_pos_topup_history">;

export const HISTORY_PAGE_SIZE = 20;

const baht = (value: number | null) => `฿${(value ?? 0).toLocaleString("th-TH")}`;
const soldAt = (value: string | null) =>
  value ? new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—";

function ImportedChip() {
  return <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-sm text-muted-foreground">นำเข้า</span>;
}

// Commission is owner-only: staff never get the column or the card line.
export function TopupHistory({ rows, total, page, isOwner, isLoading, onPageChange }: {
  rows: TopupSale[];
  total: number;
  page: number;
  isOwner: boolean;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <section className="rounded-xl bg-card shadow-card">
      <h2 className="px-5 pt-5 pb-2 text-lg font-bold">รายการเติมเงินล่าสุด</h2>
      <div className="ucom-table-wrap hidden rounded-none shadow-none md:block">
        <table className="ucom-table">
          <thead><tr><th>วันเวลา</th><th>ค่าย</th><th className="text-right">ยอดลูกค้า</th>{isOwner && <th className="text-right">ค่าคอม</th>}<th>พนักงาน</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.sale_item_id}>
                <td className="text-muted-foreground tabular-nums">{soldAt(row.sold_at)}</td>
                <td>{row.carrier_name}{row.is_imported && <ImportedChip />}</td>
                <td className="text-right font-semibold tabular-nums">{baht(row.amount)}</td>
                {isOwner && <td className="text-right text-success tabular-nums">{baht(row.commission)}</td>}
                <td className="text-muted-foreground">{row.cashier_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.sale_item_id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="font-semibold">{row.carrier_name}{row.is_imported && <ImportedChip />}</div>
              <div className="text-sm text-muted-foreground tabular-nums">{soldAt(row.sold_at)} · {row.cashier_name ?? "—"}</div>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <div className="font-semibold">{baht(row.amount)}</div>
              {isOwner && <div className="text-sm text-success">ค่าคอม {baht(row.commission)}</div>}
            </div>
          </li>
        ))}
      </ul>
      {!isLoading && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีรายการเติมเงิน</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums">หน้า {page} · {total.toLocaleString("th-TH")} รายการ</span>
        <div className="flex gap-2">
          <button type="button" className="ucom-secondary px-4 disabled:opacity-40" disabled={page === 1} onClick={() => onPageChange(page - 1)}>ก่อนหน้า</button>
          <button type="button" className="ucom-secondary px-4 disabled:opacity-40" disabled={page * HISTORY_PAGE_SIZE >= total} onClick={() => onPageChange(page + 1)}>ถัดไป</button>
        </div>
      </div>
    </section>
  );
}
