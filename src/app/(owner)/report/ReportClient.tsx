"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { PageFrame } from "@/app/_components/PageFrame";
import { toThaiError } from "@/lib/errors";
import { DailyProfit } from "./DailyProfit";
import { ReportBills } from "./ReportBills";
import { ReportSummary } from "./ReportSummary";
import { changeText } from "./summary";
import { ReportTable } from "./ReportTable";
import { GROUPING_LABEL, previousRange, sumRows, todayInBangkok, weekStartOf, type Grouping, type ReportRow } from "./types";

export type ReportView = "summary" | "bills" | "drill";

const VIEWS: [ReportView, string][] = [["summary", "สรุป"], ["bills", "รายการบิลทั้งหมด"], ["drill", "เจาะลึกรายวัน/เดือน/ปี"]];
const baht = (n: number) => `${n < 0 ? "−" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const segment = (isActive: boolean) =>
  `rounded-full px-4 py-2 text-[13px] font-semibold ${isActive ? "bg-brand-ink text-white" : "text-ink-muted hover:text-ink"}`;

export function ReportClient({ initialView }: { initialView: ReportView }) {
  const supabase = createClient();
  const today = todayInBangkok();

  const [view, setView] = useState<ReportView>(initialView);
  const [from, setFrom] = useState(() => today);
  const [to, setTo] = useState(() => today);
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [billCount, setBillCount] = useState(0);
  // sales revenue of the period just before the selected one, same length; null while unknown
  const [previousRevenue, setPreviousRevenue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // rows starts empty, so without this the screen claims the range is empty for as long
  // as the round trip takes, every time the range changes.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // a narrow range answers faster than the wide one before it — without this guard the
    // earlier, wider answer lands last and the screen shows rows the range does not contain.
    let isStale = false;
    const previous = previousRange(from, to);
    Promise.all([
      supabase.from("v_daily_report").select("*").gte("day", from).lte("day", to),
      supabase.from("v_report_entries").select("ref_id", { count: "exact", head: true }).eq("kind", "sale").gte("day", from).lte("day", to),
      supabase.from("v_daily_report").select("sale_revenue").gte("day", previous.from).lte("day", previous.to),
    ]).then(
      ([report, bills, before]) => {
        if (isStale) return;
        if (report.error) {
          setError(toThaiError(report.error));
          setRows([]);
        } else {
          setError(null);
          setRows((report.data as ReportRow[]) ?? []);
        }
        setBillCount(bills.count ?? 0);
        setPreviousRevenue(before.error ? null : sumRows((before.data ?? []) as ReportRow[]).sale_revenue);
        setIsLoading(false);
      },
      // a half-typed date makes the request itself fail rather than come back with an
      // error field; without this the screen sits on "loading" forever.
      () => {
        if (isStale) return;
        setError("โหลดรายงานไม่สำเร็จ");
        setRows([]);
        setIsLoading(false);
      },
    );
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, reloadKey]);

  // ESLint forbids setState inside the effect body, so the range setters raise the
  // loading flag instead — every path that changes the range goes through here.
  const applyRange = (nextFrom: string, nextTo: string, nextGrouping?: Grouping) => {
    setIsLoading(true);
    setFrom(nextFrom);
    setTo(nextTo);
    if (nextGrouping) setGrouping(nextGrouping);
  };

  // The view lives in the URL so a reload (or a link) opens the same tab.
  const pickView = (next: ReportView) => {
    setView(next);
    window.history.replaceState(null, "", next === "summary" ? "/report" : `/report?view=${next}`);
  };

  const quick: [string, string, string, string, Grouping][] = [
    ["today", "วันนี้", today, today, "day"],
    ["week", "สัปดาห์นี้", weekStartOf(today), today, "day"],
    ["month", "เดือนนี้", today.slice(0, 7) + "-01", today, "day"],
    ["year", "ปีนี้", today.slice(0, 4) + "-01-01", today, "month"],
  ];

  const s = sumRows(rows);
  const cards = [
    { key: "sale_revenue", label: "ยอดขาย", value: s.sale_revenue, sub: `${billCount.toLocaleString("th-TH")} บิล${billCount ? ` · เฉลี่ย ${baht(Math.round(s.sale_revenue / billCount))} / บิล` : ""}`, change: changeText(s.sale_revenue, previousRevenue, from === to) },
    { key: "sale_profit", label: "กำไรขายเครื่อง + สินค้า", value: s.sale_profit + s.sf_commission, sub: `รวมค่าคอม SF+ ที่รับแล้ว ${baht(s.sf_commission)}` },
    { key: "repair_profit", label: "กำไรงานซ่อม", value: s.repair_profit, sub: `รายได้ซ่อม ${baht(s.repair_revenue)}` },
    { key: "net_profit", label: "กำไรสุทธิ", value: s.net_profit, sub: `หักค่าใช้จ่าย ${baht(s.expense)}` },
  ];

  return (
    <PageFrame
      page="report"
      title="รายงาน"
      description={new Intl.DateTimeFormat("th-TH", { dateStyle: "full", timeZone: "Asia/Bangkok" }).format(new Date())}
      dataLoading={isLoading}
      actions={
        <div className="flex gap-1 rounded-full bg-sunken p-1">
          {quick.map(([key, label, qFrom, qTo, g]) => (
            <button key={key} type="button" onClick={() => applyRange(qFrom, qTo, g)} data-testid={`quick-${key}`} aria-pressed={from === qFrom && to === qTo} className={segment(from === qFrom && to === qTo)}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {error && <ErrorPanel message={error} onRetry={() => { setIsLoading(true); setReloadKey((value) => value + 1); }} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="มุมมองรายงาน" className="flex gap-1 rounded-full bg-sunken p-1">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => pickView(key)} data-testid={`report-tab-${key}`} className={segment(view === key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>กำหนดช่วงวันที่เอง</span>
          <input type="date" value={from} onChange={(e) => applyRange(e.target.value, to)} data-testid="report-from" aria-label="ตั้งแต่วันที่" className="ucom-field px-3.5 py-1.5 text-sm" />
          <span aria-hidden="true">–</span>
          <input type="date" value={to} onChange={(e) => applyRange(from, e.target.value)} data-testid="report-to" aria-label="ถึงวันที่" className="ucom-field px-3.5 py-1.5 text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} data-testid={`card-${card.key}`} className="ucom-surface flex flex-col gap-1.5 rounded-2xl border border-dashed border-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{card.label}</p>
            <p className={`text-[26px] font-bold leading-[30px] tabular-nums ${card.value < 0 ? "text-danger" : "text-ink"}`}>{baht(card.value)}</p>
            <p className="text-[12.5px] font-medium text-ink-muted">{card.sub}</p>
            {card.change && (
              <p data-testid="card-sale_revenue-change" className={`text-[12.5px] font-medium ${card.change.isUp ? "text-success" : "text-danger"}`}>{card.change.text}</p>
            )}
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-ink-muted">กำลังโหลด</p>
      ) : rows.length === 0 ? (
        <p data-testid="report-empty" className="ucom-info">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : view === "summary" ? (
        <ReportSummary from={from} to={to} />
      ) : view === "bills" ? (
        <div className="space-y-4">
          <DailyProfit rows={rows} />
          <ReportBills from={from} to={to} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 self-start rounded-full bg-sunken p-1 w-fit">
            {(Object.entries(GROUPING_LABEL) as [Grouping, string][]).map(([g, label]) => (
              <button key={g} type="button" onClick={() => setGrouping(g)} data-testid={`group-${g}`} aria-pressed={grouping === g} className={segment(grouping === g)}>
                {label}
              </button>
            ))}
          </div>
          <ReportTable rows={rows} grouping={grouping} />
        </div>
      )}
    </PageFrame>
  );
}
