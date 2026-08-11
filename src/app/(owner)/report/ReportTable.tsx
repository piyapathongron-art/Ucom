"use client";

import { bucketOf, sumRows, type Grouping, type ReportRow } from "./types";

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

export function ReportTable({ rows, grouping }: { rows: ReportRow[]; grouping: Grouping }) {
  if (rows.length === 0) {
    return (
      <p data-testid="report-empty" className="text-neutral-500">
        ไม่มีข้อมูลในช่วงที่เลือก
      </p>
    );
  }

  // Group rows
  const buckets = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const bucket = bucketOf(row.day, grouping);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(row);
  }

  // Sum rows and sort (newest first)
  const sortedBuckets = Array.from(buckets.entries())
    .map(([bucket, groupRows]) => {
      return {
        bucket,
        ...sumRows(groupRows),
      };
    })
    .sort((a, b) => b.bucket.localeCompare(a.bucket));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead>
          <tr>
            <th className="px-4 py-2 font-medium">ช่วง</th>
            {MONEY_COLUMNS.map(([label]) => (
              <th key={label} className="px-4 py-2 font-medium text-right">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedBuckets.map((row) => (
            <tr key={row.bucket} data-testid={`report-row-${row.bucket}`} className="border-b border-neutral-100">
              <td className="px-4 py-2">{row.bucket}</td>
              {MONEY_COLUMNS.map(([label, key]) => (
                <td
                  key={label}
                  className={`px-4 py-2 text-right ${row[key] < 0 ? "text-red-600" : ""}`}
                >
                  {row[key].toLocaleString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
