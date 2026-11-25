import type { Tables } from "@/lib/types/database";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { Panel, panelRow } from "./Panel";

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

const timeOf = (iso: string | null) =>
  new Date(iso || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

// One row per bill at every width: time, payment, item count, total (fits 375px without a table).
export default function BillsSection({ bills, fmt, page, pageSize, total, isLoading, onPageChange, onPageSizeChange }: Props) {
  const sorted = [...bills].sort((a, b) => (b.sold_at || "").localeCompare(a.sold_at || ""));

  return (
    <Panel title="บิลขาย" count={total} testId="close-day-bills">
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">ไม่มีบิล</p>
      ) : (
        <ul aria-label="บิลขาย">
          {sorted.map((b) => (
            <li key={b.sale_id} className={`grid grid-cols-[3.25rem_minmax(0,1fr)_auto_auto] items-center gap-3 ${panelRow}`}>
              <span className="tabular-nums text-muted-foreground">{timeOf(b.sold_at)}</span>
              <span>{b.payment_method === "cash" ? "เงินสด" : "เงินโอน"}</span>
              <span className="tabular-nums text-muted-foreground">{b.item_count} ชิ้น</span>
              <span className="min-w-20 text-right font-semibold tabular-nums">฿{fmt(Number(b.bill_total))}</span>
            </li>
          ))}
        </ul>
      )}
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
    </Panel>
  );
}
