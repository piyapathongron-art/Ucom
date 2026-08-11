"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ReportTable } from "./ReportTable";
import { GROUPING_LABEL, sumRows, todayInBangkok, type Grouping, type ReportRow } from "./types";

export default function ReportPage() {
  const supabase = createClient();

  const [from, setFrom] = useState(() => todayInBangkok().slice(0, 7) + "-01");
  const [to, setTo] = useState(() => todayInBangkok());
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
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
  }, [from, to]);

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
    <main className="space-y-4 p-4" data-loading={isLoading}>
      <h1 className="text-2xl font-semibold">รายงาน</h1>

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={setToday}
            data-testid="quick-today"
            className="px-3 py-1 rounded border border-neutral-300 bg-white text-sm"
          >
            วันนี้
          </button>
          <button
            type="button"
            onClick={setThisMonth}
            data-testid="quick-month"
            className="px-3 py-1 rounded border border-neutral-300 bg-white text-sm"
          >
            เดือนนี้
          </button>
          <button
            type="button"
            onClick={setThisYear}
            data-testid="quick-year"
            className="px-3 py-1 rounded border border-neutral-300 bg-white text-sm"
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
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          />
          <span className="text-neutral-500">-</span>
          <input
            type="date"
            value={to}
            onChange={(e) => applyRange(from, e.target.value)}
            data-testid="report-to"
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>

        <div className="flex rounded border border-neutral-300 p-1 bg-neutral-100">
          {(Object.entries(GROUPING_LABEL) as [Grouping, string][]).map(([g, label]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrouping(g)}
              data-testid={`group-${g}`}
              className={`px-3 py-1 text-sm rounded ${
                grouping === g ? "bg-white shadow-sm font-medium" : "text-neutral-600"
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
            className="rounded border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-neutral-500">{card.label}</p>
            <p className={`text-xl font-semibold mt-1 ${card.value < 0 ? "text-red-600" : ""}`}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <p className="text-neutral-500">กำลังโหลด</p>
      ) : (
        <ReportTable rows={rows} grouping={grouping} />
      )}
    </main>
  );
}
