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
    <main className="space-y-6 p-4 md:p-8">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">ตั้งค่า</h1>
        <p className="mt-1 text-sm text-ink-muted">
          จัดการและสำรองข้อมูลระบบ
        </p>
      </div>

      <section className="max-w-xl space-y-5 border border-border bg-surface p-4 shadow-sm md:p-6">
        <div className="border-b border-border pb-3">
          <h2 className="text-lg font-medium">สำรองข้อมูลระบบ</h2>
          <p className="mt-1 text-sm text-ink-muted">
            ดาวน์โหลดข้อมูลทั้งหมดในระบบในรูปแบบไฟล์ JSON สำหรับการสำรองข้อมูล
          </p>
        </div>

        <div>
          <button
            type="button"
            data-testid="export-button"
            disabled={isExporting}
            onClick={handleExport}
            className="bg-ink px-4 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? "กำลังรวบรวมข้อมูล" : "ดาวน์โหลดไฟล์สำรอง"}
          </button>
        </div>

        {error && (
          <div
            data-testid="export-error"
            className="border border-danger bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        {summary && (
          <div
            data-testid="export-summary"
            className="space-y-2 border border-border bg-background p-4 text-sm"
          >
            <p className="border-b border-border pb-2 font-medium text-ink">
              สรุปจำนวนข้อมูลที่ส่งออก:
            </p>
            {summary.map((item) => (
              <div key={item.table} className="flex justify-between gap-4 text-ink-muted">
                <span>{item.table}</span>
                <span className="font-mono text-ink">{item.count} แถว</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
