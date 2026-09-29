import { sumRows, type ReportRow } from "./types";

const baht = (n: number) => `${n < 0 ? "−" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const dayLabel = (day: string) => new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00`));
const MAX_DAYS = 14;

// Net profit per day for the selected range — the bills tab's strip in the design board.
// A single day has nothing to compare, so it shows the day and points at the wider presets.
export function DailyProfit({ rows }: { rows: ReportRow[] }) {
  const days = [...rows].sort((a, b) => b.day.localeCompare(a.day));
  const shown = days.slice(0, MAX_DAYS);
  const peak = Math.max(1, ...shown.map((r) => Math.abs(r.net_profit)));
  const total = sumRows(rows).net_profit;

  return (
    <section data-testid="report-daily-profit" className="ucom-surface space-y-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">กำไรรายวัน</h2>
        <span className="text-xs text-ink-muted">รวม {baht(total)}{days.length > MAX_DAYS ? ` · แสดง ${MAX_DAYS} วันล่าสุด` : ""}</span>
      </div>
      {days.length <= 1 && <p className="text-xs text-ink-muted">เลือก “สัปดาห์นี้” หรือ “เดือนนี้” เพื่อดูกำไรแยกตามวันย้อนหลัง</p>}
      <div className="flex flex-col gap-2">
        {shown.map((r) => (
          <div key={r.day} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs text-ink-muted">{dayLabel(r.day)}</span>
            <div className="h-2 flex-1 rounded-full bg-sunken">
              <div className={`h-full rounded-full ${r.net_profit < 0 ? "bg-danger" : "bg-accent"}`} style={{ width: `${(Math.abs(r.net_profit) / peak) * 100}%` }} />
            </div>
            <span className={`w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums ${r.net_profit < 0 ? "text-danger" : "text-ink"}`}>{baht(r.net_profit)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
