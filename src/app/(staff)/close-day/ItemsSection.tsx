import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { Panel, panelRow } from "./Panel";

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

// sale_items.kind values (pos_core_schema check constraint).
const KIND_LABEL: Record<string, string> = { product: "สินค้า", device: "เครื่อง", service: "บริการ", topup: "เติมเงิน" };

export default function ItemsSection({ items, fmt, page, pageSize, total, isLoading, onPageChange, onPageSizeChange }: Props) {
  const sorted = [...items].sort((a, b) => Number(b.revenue) - Number(a.revenue));

  return (
    <Panel title="สินค้าที่ขายได้" testId="close-day-items">
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีรายการสินค้า</p>
      ) : (
        <ul aria-label="สินค้าที่ขายได้">
          {sorted.map((item, i) => (
            <li key={i} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 ${panelRow}`}>
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name_snapshot}</span>
                <span className="block text-xs text-muted-foreground">{KIND_LABEL[item.kind ?? ""] ?? item.kind}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">× {item.qty}</span>
              <span className="min-w-20 text-right font-semibold tabular-nums">฿{fmt(Number(item.revenue))}</span>
            </li>
          ))}
        </ul>
      )}
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
    </Panel>
  );
}
