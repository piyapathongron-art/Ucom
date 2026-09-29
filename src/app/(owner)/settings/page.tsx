"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "../report/types";
import { PageFrame } from "@/app/_components/PageFrame";
import type { Tables } from "@/lib/types/database";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของร้าน",
  staff: "พนักงาน",
};

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
  "topup_wallet_openings",
  "profiles",
] as const;

interface TableSummary {
  table: string;
  count: number;
}

type Carrier = Pick<Tables<"topup_carriers">, "id" | "name" | "commission_rate">;

export default function SettingsPage() {
  const supabase = createClient();
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<TableSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ display_name: string; role: string } | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingCarrier, setSavingCarrier] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setProfile(data));
    });
    supabase.from("topup_carriers").select("id, name, commission_rate").order("name")
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setRateError("โหลดอัตราค่าคอมมิชชันไม่สำเร็จ");
          return;
        }
        setCarriers(data ?? []);
        setRates(Object.fromEntries((data ?? []).map((carrier) => [
          carrier.id, (carrier.commission_rate * 100).toFixed(2),
        ])));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRate = async (carrier: Carrier) => {
    const input = rates[carrier.id]?.trim() ?? "";
    const percent = Number(input);
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(input) || !Number.isFinite(percent) || percent >= 100) {
      setRateError("กรอกอัตรา 0–99.99% ทศนิยมไม่เกิน 2 ตำแหน่ง");
      return;
    }
    setRateError(null);
    setSavingCarrier(carrier.id);
    try {
      const { data, error: saveError } = await supabase.from("topup_carriers")
        .update({ commission_rate: percent / 100 })
        .eq("id", carrier.id)
        .select("id, name, commission_rate")
        .single();
      if (saveError || !data) throw saveError ?? new Error("update returned no row");
      setCarriers((current) => current.map((item) => item.id === carrier.id ? data : item));
      setRates((current) => ({ ...current, [carrier.id]: (data.commission_rate * 100).toFixed(2) }));
      toast.success(`บันทึกอัตรา ${carrier.name} แล้ว มีผลกับรายการขายใหม่เท่านั้น`);
    } catch {
      setRateError("บันทึกอัตราไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSavingCarrier(null);
    }
  };

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
    <PageFrame
      page="settings"
     
      title="ตั้งค่า"
      description="จัดการและสำรองข้อมูลระบบโดยไม่เปลี่ยนข้อมูลต้นทาง"
      dataLoading={isExporting}
    >

      <section className="ucom-surface max-w-2xl space-y-3 p-4 md:p-6">
        <h2 className="text-lg font-medium">ข้อมูลร้าน</h2>
        <div className="flex justify-between border-b border-border py-2 text-sm">
          <span className="text-ink-muted">ผู้ใช้งาน</span>
          <span className="font-medium text-ink">{profile?.display_name ?? "—"}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span className="text-ink-muted">สิทธิ์</span>
          <span className="font-medium text-ink">
            {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : "—"}
          </span>
        </div>
      </section>

      <section className="ucom-surface mt-5 max-w-2xl space-y-4 p-4 md:p-6">
        <div>
          <h2 className="text-lg font-medium">ค่าคอมมิชชันเติมเงิน</h2>
          <p className="mt-1 text-sm text-ink-muted">กำหนดแยกตามค่าย มีผลกับยอดขายใหม่ ไม่เปลี่ยนต้นทุนรายการเดิม</p>
        </div>
        {rateError && <p role="alert" className="text-sm text-danger">{rateError}</p>}
        {carriers.map((carrier) => (
          <form key={carrier.id} className="flex flex-wrap items-end gap-3 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); void saveRate(carrier); }}>
            <label className="flex-1 space-y-1 text-sm text-ink-muted">
              <span>{carrier.name} (%)</span>
              <input className="ucom-field w-full px-3 py-2 font-mono" type="number" min="0" max="99.99" step="0.01" inputMode="decimal" value={rates[carrier.id] ?? ""} onChange={(event) => setRates((current) => ({ ...current, [carrier.id]: event.target.value }))} disabled={savingCarrier !== null} required />
            </label>
            <button className="ucom-primary px-4 py-2 text-sm disabled:opacity-50" type="submit" disabled={savingCarrier !== null || rates[carrier.id] === (carrier.commission_rate * 100).toFixed(2)}>
              {savingCarrier === carrier.id ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </form>
        ))}
      </section>

      <section className="ucom-surface mt-5 max-w-2xl space-y-5 p-4 md:p-6">
        <div className="border-b border-border pb-3">
          <h2 className="text-lg font-medium">สำรองข้อมูล</h2>
          <p className="mt-1 text-sm text-ink-muted">
            ส่งออกข้อมูลการขาย สต๊อก และรายงานทั้งหมดเป็นไฟล์เดียว ใช้แทนระบบสำรองข้อมูลอัตโนมัติ
            ควรกดทุกครั้งหลังปิดร้าน
          </p>
        </div>

        <div>
          <button
            type="button"
            data-testid="export-button"
            disabled={isExporting}
            onClick={handleExport}
            className="ucom-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? "กำลังรวบรวมข้อมูล" : "ดาวน์โหลดไฟล์สำรอง"}
          </button>
        </div>

        {error && (
          <div
            data-testid="export-error"
            className="rounded-2xl bg-danger/10 p-3 text-sm text-danger"
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
    </PageFrame>
  );
}
