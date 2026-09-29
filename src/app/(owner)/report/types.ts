import type { Tables } from "@/lib/types/database";

// every view column comes back `| null` from the generator; a v_daily_report row is a
// group-by aggregate, so all eight are always present.
export type ReportRow = { [K in keyof Tables<"v_daily_report">]: NonNullable<Tables<"v_daily_report">[K]> };

export type Grouping = "day" | "month" | "year";

// one money event: a bill, a closed repair job, a financed device, an expense. The view
// it comes from is what v_daily_report sums, so a drilled-open day always adds up to the
// row above it.
export type ReportEntry = Tables<"v_report_entries">;

// a day is the smallest bucket the report has; below it there are entries, not buckets.
export function drillInto(grouping: Grouping): Grouping | null {
  if (grouping === "year") return "month";
  if (grouping === "month") return "day";
  return null;
}

export function entryRevenue(e: ReportEntry): number {
  return (e.sale_revenue ?? 0) + (e.repair_revenue ?? 0) + (e.sf_commission ?? 0);
}

export function entryProfit(e: ReportEntry): number {
  return (e.sale_profit ?? 0) + (e.repair_profit ?? 0) + (e.sf_commission ?? 0) - (e.expense ?? 0);
}

export const KIND_LABEL: Record<string, string> = {
  sale: "ขาย",
  repair: "งานซ่อม",
  sf: "ค่าคอม SF",
  expense: "รายจ่าย",
};

export const GROUPING_LABEL: Record<Grouping, string> = { day: "รายวัน", month: "รายเดือน", year: "รายปี" };

export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// Weeks start on Monday, as the shop counts them.
export function weekStartOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// The stretch of days of equal length that ends the day before `from` (for a day-over-day change).
export function previousRange(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00Z`);
  const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - start.getTime()) / 86_400_000) + 1;
  const shift = (offset: number) => new Date(start.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return { from: shift(-days), to: shift(-1) };
}

// A range of Bangkok calendar days as timestamps, for tables filtered on a timestamptz column.
export function bangkokBounds(from: string, to: string): { start: string; end: string } {
  return { start: `${from}T00:00:00+07:00`, end: `${to}T23:59:59.999+07:00` };
}

export function bucketOf(day: string, grouping: Grouping): string {
  if (grouping === "month") return day.slice(0, 7);
  if (grouping === "year") return day.slice(0, 4);
  return day;
}

export function sumRows(rows: ReportRow[]): Omit<ReportRow, "day"> {
  return rows.reduce(
    (acc, row) => ({
      sale_revenue: acc.sale_revenue + row.sale_revenue,
      sale_profit: acc.sale_profit + row.sale_profit,
      repair_revenue: acc.repair_revenue + row.repair_revenue,
      repair_profit: acc.repair_profit + row.repair_profit,
      sf_commission: acc.sf_commission + row.sf_commission,
      expense: acc.expense + row.expense,
      net_profit: acc.net_profit + row.net_profit,
    }),
    {
      sale_revenue: 0,
      sale_profit: 0,
      repair_revenue: 0,
      repair_profit: 0,
      sf_commission: 0,
      expense: 0,
      net_profit: 0,
    }
  );
}
