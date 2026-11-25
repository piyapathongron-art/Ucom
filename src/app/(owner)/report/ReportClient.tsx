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
// ADR 0033 segmented control, the same one /stock uses: 40px pills, the active one brand blue.
// On a phone the three view tabs are wider than the screen: they scroll sideways, without a scrollbar.
export const segmentGroup = "flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-card [scrollbar-width:none]";
export const segment = (isActive: boolean) =>
  `h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;

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
        <div role="group" aria-label="ช่วงเวลา" className={segmentGroup}>
          {quick.map(([key, label, qFrom, qTo, g]) => (
            <button key={key} type="button" onClick={() => applyRange(qFrom, qTo, g)} data-testid={`quick-${key}`} aria-pressed={from === qFrom && to === qTo} className={segment(from === qFrom && to === qTo)}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      {error && <ErrorPanel message={error} onRetry={() => { setIsLoading(true); setReloadKey((value) => value + 1); }} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="มุมมองรายงาน" className={segmentGroup}>
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => pickView(key)} data-testid={`report-tab-${key}`} className={segment(view === key)}>
              {label}
            </button>
          ))}
        </div>
        <fieldset className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-end">
          <legend className="mb-1 text-sm font-semibold text-foreground">กำหนดช่วงวันที่เอง</legend>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">ตั้งแต่
            <input type="date" value={from} onChange={(e) => applyRange(e.target.value, to)} data-testid="report-from" aria-label="ตั้งแต่วันที่" className="ucom-field h-10 w-full min-w-0 rounded-full px-3 text-sm sm:px-4" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">ถึง
            <input type="date" value={to} onChange={(e) => applyRange(from, e.target.value)} data-testid="report-to" aria-label="ถึงวันที่" className="ucom-field h-10 w-full min-w-0 rounded-full px-3 text-sm sm:px-4" />
          </label>
        </fieldset>
      </div>

      {/* Sales is the hero card (brand blue), as on the canvas; the other three stay white. Full baht, never K/M. */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {cards.map((card, i) => {
          const isHero = i === 0;
          return (
            <div key={card.key} data-testid={`card-${card.key}`} className={`flex min-w-0 flex-col gap-1 rounded-xl p-4 md:p-5 ${isHero ? "bg-primary text-primary-foreground" : "bg-card shadow-card"}`}>
              <p className={`text-sm font-medium ${isHero ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{card.label}</p>
              <p className={`text-xl font-bold tabular-nums break-all md:text-3xl ${isHero ? "" : card.value < 0 ? "text-danger" : "text-foreground"}`}>{baht(card.value)}</p>
              <p className={`text-xs md:text-sm ${isHero ? "text-primary-foreground/85" : "text-muted-foreground"}`}>{card.sub}</p>
              {card.change && (
                <p data-testid="card-sale_revenue-change" className="mt-1">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold md:text-sm ${isHero ? "bg-primary-foreground/20 text-primary-foreground" : card.change.isUp ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{card.change.text}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div aria-busy="true" aria-label="กำลังโหลด" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {[16, 16].map((rem, i) => <div key={i} style={{ height: `${rem}rem` }} className="animate-pulse rounded-xl bg-card shadow-card motion-reduce:animate-none" />)}
        </div>
      ) : rows.length === 0 ? (
        <p data-testid="report-empty" className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : view === "summary" ? (
        <ReportSummary from={from} to={to} />
      ) : view === "bills" ? (
        <div className="space-y-4">
          <DailyProfit rows={rows} />
          <ReportBills from={from} to={to} />
        </div>
      ) : (
        <div className="space-y-3">
          <div role="group" aria-label="จัดกลุ่ม" className={segmentGroup}>
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
