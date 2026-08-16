import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";

export type ItemRow = Tables<"v_close_day_items">;

interface Props {
  items: ItemRow[];
  fmt: (n: number) => string;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function ItemsSection({ items, fmt, page, pageSize, total, isLoading, onPageChange, onPageSizeChange }: Props) {
  const sorted = [...items].sort(
    (a, b) => Number(b.revenue) - Number(a.revenue)
  );

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">สินค้าที่ขายได้</h2>

      {/* ตาราง — md ขึ้นไป */}
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <thead className="bg-background border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-ink-muted">สินค้า</th>
              <th className="px-4 py-3 font-medium text-ink-muted">ประเภท</th>
              <th className="px-4 py-3 font-medium text-ink-muted">จำนวน</th>
              <th className="px-4 py-3 font-medium text-ink-muted">ยอดขาย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3">{item.name_snapshot}</td>
                <td className="px-4 py-3">{item.kind}</td>
                <td className="px-4 py-3">{item.qty}</td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {fmt(Number(item.revenue))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* การ์ด — ต่ำกว่า md */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-4">ไม่มีรายการสินค้า</p>
        )}
        {sorted.map((item, i) => (
          <div
            key={i}
            className="ucom-surface p-3 text-sm"
          >
            <div className="flex justify-between items-start">
              <span className="font-medium text-ink">{item.name_snapshot}</span>
              <span className="font-mono tabular-nums font-semibold text-ink">
                {fmt(Number(item.revenue))}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-ink-muted">{item.kind}</span>
              <span className="text-ink-muted">{item.qty} ชิ้น</span>
            </div>
          </div>
        ))}
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        label="สินค้า"
        testIdPrefix="close-day-items-pagination"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </section>
  );
}
