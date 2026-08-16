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
      <p data-testid="report-empty" className="text-ink-muted">
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
              className="cursor-pointer border-b border-border hover:bg-background"
            >
              <td className="px-4 py-2" style={{ paddingLeft: `${depth * 1.5 + 1}rem` }}>
                <span className="mr-2 inline-block w-3 text-ink-muted">
                  {isOpen ? "▾" : "▸"}
                </span>
                {row.bucket}
              </td>
              {MONEY_COLUMNS.map(([label, key]) => (
                <td
                  key={label}
                  className={`px-4 py-2 text-right font-mono ${
                    key !== "net_profit" ? "hidden md:table-cell" : ""
                  } ${row[key] < 0 ? "text-danger" : ""}`}
                >
                  {row[key].toLocaleString()}
                </td>
              ))}
            </tr>
            {isOpen &&
              (below ? (
                renderLevel(row.bucketRows, below, depth + 1)
              ) : (
                <tr data-testid={`report-detail-${row.bucket}`} className="bg-background">
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
          <tr className="border-b border-border">
            <th className="px-4 py-2 font-medium">ช่วง</th>
            {MONEY_COLUMNS.map(([label, key]) => (
              <th
                key={label}
                className={`px-4 py-2 font-medium text-right ${
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
