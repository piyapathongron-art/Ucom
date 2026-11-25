"use client";

import { Fragment, useState, type ReactNode } from "react";
import { DayEntries } from "./DayEntries";
import { bucketOf, drillInto, sumRows, type Grouping, type ReportRow } from "./types";

// every money column can go negative, not just the repair one: a month of write-offs
// with no sales drags net_profit under too (ADR 0011). Red is the only signal — a
// negative number here is a real result, never an error.
const MONEY_COLUMNS = [
  ["ยอดขาย", "sale_revenue"],
  ["กำไรขาย", "sale_profit"],
  ["รายได้ซ่อม", "repair_revenue"],
  ["กำไรงานซ่อม", "repair_profit"],
  ["ค่าคอม SF", "sf_commission"],
  ["ค่าใช้จ่าย", "expense"],
  ["กำไรสุทธิ", "net_profit"],
] as const satisfies readonly (readonly [string, keyof Omit<ReportRow, "day">])[];

const COLUMN_COUNT = MONEY_COLUMNS.length + 1;

// Buckets are ISO prefixes ("2026", "2026-11", "2026-11-24"); show them as Thai dates (Buddhist year).
const BUCKET_FORMAT: Record<Grouping, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { month: "long", year: "numeric" },
  day: { weekday: "short", day: "numeric", month: "short", year: "numeric" },
};
function bucketLabel(bucket: string, level: Grouping): string {
  const iso = level === "year" ? `${bucket}-01-01` : level === "month" ? `${bucket}-01` : bucket;
  return new Intl.DateTimeFormat("th-TH", { ...BUCKET_FORMAT[level], timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function ReportTable({ rows, grouping }: { rows: ReportRow[]; grouping: Grouping }) {
  // one flat set for every level: buckets are date prefixes, so "2026", "2026-08" and
  // "2026-08-11" can never collide.
  const [openBuckets, setOpenBuckets] = useState<ReadonlySet<string>>(new Set());

  const toggle = (bucket: string) =>
    setOpenBuckets((prev) => {
      const next = new Set(prev);
      if (!next.delete(bucket)) next.add(bucket);
      return next;
    });

  if (rows.length === 0) {
    return (
      <p data-testid="report-empty" className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
        ไม่มีข้อมูลในช่วงที่เลือก
      </p>
    );
  }

  // A bucket row carries the same seven sums whatever level it sits at; opening it swaps
  // in the level below (year → month → day) and, at the bottom, the day's own entries.
  function renderLevel(levelRows: ReportRow[], level: Grouping, depth: number): ReactNode[] {
    const buckets = new Map<string, ReportRow[]>();
    for (const row of levelRows) {
      const bucket = bucketOf(row.day, level);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(row);
    }

    return Array.from(buckets.entries())
      .map(([bucket, bucketRows]) => ({ bucket, bucketRows, ...sumRows(bucketRows) }))
      .sort((a, b) => b.bucket.localeCompare(a.bucket))
      .map((row) => {
        const isOpen = openBuckets.has(row.bucket);
        const below = drillInto(level);
        return (
          <Fragment key={row.bucket}>
            <tr
              data-testid={`report-row-${row.bucket}`}
              onClick={() => toggle(row.bucket)}
              className={`cursor-pointer ${isOpen && !below ? "bg-accent" : "hover:bg-muted"}`}
            >
              <td className="py-2" style={{ paddingLeft: `${depth * 1.25 + 1}rem` }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={(event) => { event.stopPropagation(); toggle(row.bucket); }}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary ${depth === 0 ? "font-bold" : "font-semibold"}`}
                >
                  <span aria-hidden="true" className="inline-block w-3 text-muted-foreground">{isOpen ? "▾" : "▸"}</span>
                  {bucketLabel(row.bucket, level)}
                </button>
              </td>
              {MONEY_COLUMNS.map(([label, key]) => (
                <td
                  key={label}
                  className={`text-right tabular-nums ${
                    key !== "net_profit" ? "hidden md:table-cell" : "font-bold"
                  } ${row[key] < 0 ? "text-danger" : key === "net_profit" ? "text-success" : ""}`}
                >
                  {row[key].toLocaleString("th-TH")}
                </td>
              ))}
            </tr>
            {isOpen &&
              (below ? (
                renderLevel(row.bucketRows, below, depth + 1)
              ) : (
                <tr data-testid={`report-detail-${row.bucket}`} className="bg-muted">
                  <td colSpan={COLUMN_COUNT} className="p-0" onClick={(event) => event.stopPropagation()}>
                    <DayEntries day={row.bucket} />
                  </td>
                </tr>
              ))}
          </Fragment>
        );
      });
  }

  return (
    <div className="ucom-table-wrap">
      <table className="ucom-table whitespace-nowrap">
        <thead>
          <tr>
            <th scope="col">ช่วง</th>
            {MONEY_COLUMNS.map(([label, key]) => (
              <th
                key={label}
                scope="col"
                className={`text-right ${
                  key !== "net_profit" ? "hidden md:table-cell" : ""
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{renderLevel(rows, grouping, 0)}</tbody>
      </table>
    </div>
  );
}
