"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "../report/types";

const EXPORT_TABLES = [
  "categories",
  "products",
  "device_units",
  "sf_orders",
  "sales",
  "sale_items",
  "repair_jobs",
  "expenses",
  "topup_carriers",
  "topup_wallet_entries",
  "profiles",
] as const;

interface TableSummary {
  table: string;
  count: number;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<TableSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSummary(null);

    try {
      const tablesData: Record<string, unknown[]> = {};
      const summaryList: TableSummary[] = [];

      for (const table of EXPORT_TABLES) {
        const rows: unknown[] = [];
        const PAGE = 1000;
        for (let from = 0; ; from += PAGE) {
          const { data, error: fetchError } = await supabase
            .from(table)
            .select("*")
            .range(from, from + PAGE - 1);

          if (fetchError) {
            throw new Error(`${table}: ${fetchError.message}`);
          }

          rows.push(...(data ?? []));
          if ((data?.length ?? 0) < PAGE) {
            break;
          }
        }

        tablesData[table] = rows;
        summaryList.push({ table, count: rows.length });
      }

      const payload = {
        exported_at: new Date().toISOString(),
        tables: tablesData,
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ucom-backup-${todayInBangkok()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSummary(summaryList);
    } catch (err) {
      console.error("Export backup failed:", err);
      setError("เกิดข้อผิดพลาดในการส่งออกข้อมูลสำรอง");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ตั้งค่า</h1>
        <p className="mt-1 text-sm text-neutral-500">
          จัดการและสำรองข้อมูลระบบ
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm space-y-4 max-w-xl">
        <h2 className="text-lg font-medium">สำรองข้อมูลระบบ</h2>
        <p className="text-sm text-neutral-500">
          ดาวน์โหลดข้อมูลทั้งหมดในระบบในรูปแบบไฟล์ JSON สำหรับการสำรองข้อมูล
        </p>

        <div>
          <button
            type="button"
            data-testid="export-button"
            disabled={isExporting}
            onClick={handleExport}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "กำลังรวบรวมข้อมูล" : "ดาวน์โหลดไฟล์สำรอง"}
          </button>
        </div>

        {error && (
          <div
            data-testid="export-error"
            className="rounded bg-red-50 p-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {summary && (
          <div
            data-testid="export-summary"
            className="rounded bg-neutral-50 p-4 border border-neutral-200 text-sm space-y-1"
          >
            <p className="font-medium text-neutral-700 mb-2">
              สรุปจำนวนข้อมูลที่ส่งออก:
            </p>
            {summary.map((item) => (
              <div key={item.table} className="text-neutral-600">
                {item.table} — {item.count} แถว
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
