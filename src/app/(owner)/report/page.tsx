"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
import { ReportTable } from "./ReportTable";
import { GROUPING_LABEL, sumRows, todayInBangkok, type Grouping, type ReportRow } from "./types";

export default function ReportPage() {
  const supabase = createClient();

  const [from, setFrom] = useState(() => todayInBangkok().slice(0, 7) + "-01");
  const [to, setTo] = useState(() => todayInBangkok());
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // rows starts empty, so without this the screen claims the range is empty for as long
  // as the round trip takes, every time the range changes.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // typing a date fires one request per keystroke-completed field, and a narrow range
    // answers faster than the wide one before it — without this guard the earlier, wider
    // answer lands last and the screen shows rows the chosen range does not contain.
    let isStale = false;
    supabase
      .from("v_daily_report")
      .select("*")
      .gte("day", from)
      .lte("day", to)
      .then(
        ({ data, error: fetchError }) => {
          if (isStale) return;
          if (fetchError) {
            setError(fetchError.message);
            setRows([]);
          } else {
            setError(null);
            setRows((data as ReportRow[]) ?? []);
          }
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

  const setToday = () => {
    const today = todayInBangkok();
    applyRange(today, today, "day");
  };

  const setThisMonth = () => {
    const today = todayInBangkok();
    applyRange(today.slice(0, 7) + "-01", today, "day");
  };

  const setThisYear = () => {
    const today = todayInBangkok();
    applyRange(today.slice(0, 4) + "-01-01", today, "month");
  };

  const summary = sumRows(rows);

  return (
    <PageFrame
      page="report"
      eyebrow="OWNER / REPORTING"
      title="รายงาน"
      description="ดูผลประกอบการตามช่วงเวลา และเจาะจากปี → เดือน → วัน → รายละเอียดบิล"
      dataLoading={isLoading}
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">OWNER ONLY</span>}
    >

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3 text-sm text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setReloadKey((value) => value + 1);
            }}
            className="ucom-danger px-3 py-1.5 text-sm"
          >
            ลองใหม่
          </button>
        </div>
      )}

      <div className="ucom-toolbar">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={setToday}
            data-testid="quick-today"
            className="ucom-secondary px-3 py-1.5 text-sm"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={setThisMonth}
            data-testid="quick-month"
            className="ucom-secondary px-3 py-1.5 text-sm"
          >
            เดือนนี้
          </button>
          <button
            type="button"
            onClick={setThisYear}
            data-testid="quick-year"
            className="ucom-secondary px-3 py-1.5 text-sm"
          >
            ปีนี้
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={from}
            onChange={(e) => applyRange(e.target.value, to)}
            data-testid="report-from"
            className="ucom-field px-2 py-1.5 text-sm"
          />
          <span className="text-ink-muted">-</span>
          <input
            type="date"
            value={to}
            onChange={(e) => applyRange(from, e.target.value)}
            data-testid="report-to"
            className="ucom-field px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex rounded border border-border bg-background p-1">
          {(Object.entries(GROUPING_LABEL) as [Grouping, string][]).map(([g, label]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrouping(g)}
              data-testid={`group-${g}`}
              className={`px-3 py-1 text-sm rounded ${
                grouping === g ? "bg-surface font-medium shadow-sm" : "text-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "net_profit", label: "กำไรสุทธิ", value: summary.net_profit },
          { key: "sale_profit", label: "กำไรขาย", value: summary.sale_profit },
          { key: "repair_profit", label: "กำไรงานซ่อม", value: summary.repair_profit },
          { key: "expense", label: "ค่าใช้จ่าย", value: summary.expense },
        ].map((card) => (
          <div
            key={card.key}
            data-testid={`card-${card.key}`}
            className="ucom-surface p-4"
          >
            <p className="text-sm text-ink-muted">{card.label}</p>
            <p className={`mt-1 font-mono text-xl font-semibold ${card.value < 0 ? "text-danger" : ""}`}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-ink-muted">กำลังโหลด</p>
      ) : (
        <ReportTable rows={rows} grouping={grouping} />
      )}
    </PageFrame>
  );
}
