import { Bar, Panel } from "./ReportSummary";
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
    <Panel testId="report-daily-profit" title="กำไรรายวัน" aside={`รวม ${baht(total)}${days.length > MAX_DAYS ? ` · แสดง ${MAX_DAYS} วันล่าสุด` : ""}`}>
      {days.length <= 1 && <p className="text-sm text-muted-foreground">เลือก “สัปดาห์นี้” หรือ “เดือนนี้” เพื่อดูกำไรแยกตามวันย้อนหลัง</p>}
      <ul className="flex flex-col gap-2.5">
        {shown.map((r) => (
          <li key={r.day} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-sm text-muted-foreground">{dayLabel(r.day)}</span>
            <Bar share={(Math.abs(r.net_profit) / peak) * 100} isLead isNegative={r.net_profit < 0} />
            <span className={`min-w-20 text-right text-sm font-semibold tabular-nums ${r.net_profit < 0 ? "text-danger" : "text-foreground"}`}>{baht(r.net_profit)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
