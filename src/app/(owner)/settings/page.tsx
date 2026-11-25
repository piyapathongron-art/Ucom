"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "../report/types";
import { PageFrame } from "@/app/_components/PageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="max-w-3xl space-y-4">
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-card">
          <h2 className="text-lg font-bold">ข้อมูลร้าน</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted p-3.5">
              <dt className="text-sm text-muted-foreground">ผู้ใช้งาน</dt>
              <dd className="font-semibold">{profile?.display_name ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-muted p-3.5">
              <dt className="text-sm text-muted-foreground">สิทธิ์</dt>
              <dd className="font-semibold">
                {profile ? (ROLE_LABEL[profile.role] ?? profile.role) : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 rounded-xl bg-card p-5 shadow-card">
          <div>
            <h2 className="text-lg font-bold">ค่าคอมมิชชันเติมเงิน</h2>
            <p className="mt-1 text-sm text-muted-foreground">กำหนดแยกตามค่าย มีผลกับยอดขายใหม่ ไม่เปลี่ยนต้นทุนรายการเดิม</p>
          </div>
          {rateError && (
            <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{rateError}</p>
          )}
          {carriers.map((carrier) => {
            const inputId = `rate-${carrier.id}`;
            return (
              <form key={carrier.id} className="flex flex-wrap items-center gap-3 border-t border-border pt-3" onSubmit={(event) => { event.preventDefault(); void saveRate(carrier); }}>
                <label htmlFor={inputId} className="min-w-32 flex-1 font-semibold">{carrier.name} (%)</label>
                <Input id={inputId} className="h-11 w-32 text-right tabular-nums" type="number" min="0" max="99.99" step="0.01" inputMode="decimal" value={rates[carrier.id] ?? ""} onChange={(event) => setRates((current) => ({ ...current, [carrier.id]: event.target.value }))} disabled={savingCarrier !== null} required />
                <Button size="lg" type="submit" disabled={savingCarrier !== null || rates[carrier.id] === (carrier.commission_rate * 100).toFixed(2)}>
                  {savingCarrier === carrier.id ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </form>
            );
          })}
        </section>

        <section className="space-y-4 rounded-xl bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">สำรองข้อมูล</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ส่งออกข้อมูลการขาย สต๊อก และรายงานทั้งหมดเป็นไฟล์เดียว ใช้แทนระบบสำรองข้อมูลอัตโนมัติ
                ควรกดทุกครั้งหลังปิดร้าน
              </p>
            </div>
            <Button
              type="button"
              data-testid="export-button"
              disabled={isExporting}
              onClick={handleExport}
              className="h-12 px-6 font-bold"
            >
              {isExporting ? "กำลังรวบรวมข้อมูล" : "ดาวน์โหลดไฟล์สำรอง"}
            </Button>
          </div>

          {error && (
            <div
              data-testid="export-error"
              role="alert"
              className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger"
            >
              {error}
            </div>
          )}

          {summary && (
            <div
              data-testid="export-summary"
              className="space-y-2 rounded-xl bg-success-bg p-4 text-sm text-success"
            >
              <p className="font-semibold">สรุปจำนวนข้อมูลที่ส่งออก:</p>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {summary.map((item) => (
                  <li key={item.table} className="flex min-w-0 justify-between gap-3">
                    <span className="truncate">{item.table}</span>
                    <span className="tabular-nums">{item.count} แถว</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
