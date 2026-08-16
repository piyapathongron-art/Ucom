import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";

export type BillRow = Tables<"v_close_day_bills">;

interface Props {
  bills: BillRow[];
  fmt: (n: number) => string;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function BillsSection({ bills, fmt, page, pageSize, total, isLoading, onPageChange, onPageSizeChange }: Props) {
  const sorted = [...bills].sort(
    (a, b) => (b.sold_at || "").localeCompare(a.sold_at || "")
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">บิลขาย</h2>

      {/* ตาราง — md ขึ้นไป */}
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-ink-muted">เวลา</th>
              <th className="px-4 py-3 font-medium text-ink-muted">ชำระด้วย</th>
              <th className="px-4 py-3 font-medium text-ink-muted">จำนวนชิ้น</th>
              <th className="px-4 py-3 font-medium text-ink-muted">ยอดบิล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((b) => (
              <tr key={b.sale_id}>
                <td className="px-4 py-3">
                  {new Date(b.sold_at || "").toLocaleTimeString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-3">
                  {b.payment_method === "cash" ? "เงินสด" : "เงินโอน"}
                </td>
                <td className="px-4 py-3">{b.item_count}</td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {fmt(Number(b.bill_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* การ์ด — ต่ำกว่า md */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">ไม่มีบิล</p>
        )}
        {sorted.map((b) => (
          <div
            key={b.sale_id}
            className="ucom-surface p-3 text-sm"
          >
            <div className="flex justify-between items-start">
              <span className="text-ink-muted">
                {new Date(b.sold_at || "").toLocaleTimeString("th-TH", {
                  timeZone: "Asia/Bangkok",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="font-mono tabular-nums font-semibold text-ink">
                {fmt(Number(b.bill_total))}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-ink-muted">
                {b.payment_method === "cash" ? "เงินสด" : "เงินโอน"}
              </span>
              <span className="text-ink-muted">{b.item_count} ชิ้น</span>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        label="บิล"
        testIdPrefix="close-day-bills-pagination"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
