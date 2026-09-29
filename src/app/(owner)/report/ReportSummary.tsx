"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAllPages } from "@/lib/supabase/pagination";
import { salesByChannel, topProducts, type Channel } from "./summary";
import { bangkokBounds } from "./types";

type SfRow = { ref_id: string | null; detail: string | null; sf_commission: number | null; day: string | null };
type SfPending = { device_unit_id: string | null; model_name: string | null; imei: string | null };
type RepairRow = { ref_id: string | null; label: string | null; detail: string | null; repair_revenue: number | null; repair_profit: number | null };

type Summary = {
  channels: { channel: Channel; amount: number }[];
  top: { name: string; qty: number }[];
  sf: SfRow[];
  pending: SfPending[];
  pendingCount: number;
  repairs: RepairRow[];
  repairCount: number;
};

const baht = (n: number) => `${n < 0 ? "−" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const shortDate = (day: string | null) =>
  day ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00`)) : "";
const LIST_LIMIT = 6;

function Panel({ title, aside, children, grow = false }: { title: string; aside?: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <section className={`ucom-surface flex flex-col gap-4 p-5 ${grow ? "flex-1" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {aside && <span className="text-xs text-ink-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Bar({ share, isLead }: { share: number; isLead: boolean }) {
  return (
    <div className="h-2 w-full rounded-full bg-sunken">
      <div className={`h-full rounded-full ${isLead ? "bg-accent" : "bg-ink-faint"}`} style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
    </div>
  );
}

export function ReportSummary({ from, to }: { from: string; to: string }) {
  const supabase = createClient();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    const { start, end } = bangkokBounds(from, to);
    const entries = () => supabase.from("v_report_entries").select("*").gte("day", from).lte("day", to);
    // ponytail: the channel split and best sellers are summed in the browser from every row in
    // range — fine for one shop's year; move into a view if a range ever runs to tens of thousands of bills.
    Promise.all([
      fetchAllPages((a, b) => entries().eq("kind", "sale").order("occurred_at").order("ref_id").range(a, b)),
      fetchAllPages((a, b) => supabase.from("sales").select("id, receiving_account").not("receiving_account", "is", null)
        .gte("sold_at", start).lte("sold_at", end).order("id").range(a, b)),
      fetchAllPages((a, b) => supabase.from("sale_items").select("product_id, name_snapshot, qty, sales!inner(sold_at)")
        .eq("kind", "product").gte("sales.sold_at", start).lte("sales.sold_at", end).order("id").range(a, b)),
      entries().eq("kind", "sf").order("occurred_at", { ascending: false }).limit(LIST_LIMIT),
      supabase.from("v_sf_pending").select("device_unit_id, model_name, imei", { count: "exact" }).order("financed_at", { ascending: false }).limit(3),
      supabase.from("v_report_entries").select("ref_id, label, detail, repair_revenue, repair_profit", { count: "exact" })
        .gte("day", from).lte("day", to).eq("kind", "repair").order("occurred_at", { ascending: false }).limit(LIST_LIMIT),
    ]).then(
      ([sales, headers, items, sf, pending, repairs]) => {
        if (isStale) return;
        if (sf.error || pending.error || repairs.error) throw new Error("summary lists failed");
        setSummary({
          channels: salesByChannel(sales, headers),
          top: topProducts(items),
          sf: sf.data ?? [],
          pending: pending.data ?? [],
          pendingCount: pending.count ?? 0,
          repairs: repairs.data ?? [],
          repairCount: repairs.count ?? 0,
        });
        setFailed(false);
      },
    ).catch(() => {
      if (isStale) return;
      setFailed(true);
    });
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, retryKey]);

  if (failed)
    return (
      <div data-testid="report-summary-error" className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
        <span>โหลดสรุปไม่สำเร็จ</span>
        <button type="button" onClick={() => { setFailed(false); setRetryKey((k) => k + 1); }} className="ucom-danger px-4 py-2 text-sm">ลองใหม่</button>
      </div>
    );
  if (!summary) return <p className="text-sm text-ink-muted">กำลังโหลดสรุป...</p>;

  const channelTotal = summary.channels.reduce((s, c) => s + c.amount, 0);
  const maxQty = summary.top[0]?.qty ?? 0;

  return (
    <div data-testid="report-summary" className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_400px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="ยอดขายตามช่องทางรับเงิน">
          <div className="flex flex-col gap-2.5">
            {summary.channels.map((c, i) => {
              const share = channelTotal > 0 ? Math.round((c.amount / channelTotal) * 100) : 0;
              return (
                <div key={c.channel} data-testid={`report-channel-${c.channel}`} className="flex flex-col gap-1">
                  <div className="flex justify-between text-[13px] font-semibold text-ink">
                    <span>{c.channel}</span>
                    <span className="tabular-nums">{baht(c.amount)} · {share}%</span>
                  </div>
                  <Bar share={share} isLead={i === 0} />
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="สินค้าขายดี" grow>
          {summary.top.length === 0 ? (
            <p className="text-sm text-ink-muted">ยังไม่มีสินค้าขายในช่วงนี้</p>
          ) : (
            <div className="flex flex-col gap-3">
              {summary.top.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-44 truncate text-[13px] font-medium text-ink" title={p.name}>{p.name}</span>
                  <Bar share={maxQty > 0 ? (p.qty / maxQty) * 100 : 0} isLead={i === 0} />
                  <span className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">{p.qty} ชิ้น</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="ค่าคอม SF+" aside={summary.pendingCount > 0 ? `${summary.pendingCount} เครื่องรอค่าคอม` : undefined}>
          <div className="flex flex-col divide-y divide-border">
            {summary.sf.map((r) => (
              <div key={`${r.ref_id}-${r.day}`} className="flex items-center justify-between py-2.5 first:pt-0">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink">IMEI ···{(r.detail ?? "").slice(-4)}</span>
                  <span className="text-[11.5px] text-ink-muted">รับเงินเข้า {shortDate(r.day)}</span>
                </div>
                <span className="text-[13.5px] font-bold tabular-nums text-success">{baht(r.sf_commission ?? 0)}</span>
              </div>
            ))}
            {summary.pending.map((p) => (
              <div key={p.device_unit_id} className="flex items-center justify-between py-2.5 first:pt-0">
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold text-ink">{p.model_name} · {(p.imei ?? "").slice(-4)}</span>
                  <span className="text-[11.5px] text-ink-faint">ยังไม่ได้รับ</span>
                </div>
                <span className="text-[13.5px] font-bold text-ink-faint">รอทราบ</span>
              </div>
            ))}
            {summary.sf.length === 0 && summary.pending.length === 0 && <p className="text-sm text-ink-muted">ไม่มีค่าคอมในช่วงนี้</p>}
          </div>
        </Panel>

        <Panel title="งานซ่อมที่ปิดช่วงนี้" aside={summary.repairCount > LIST_LIMIT ? `${summary.repairCount} งาน` : undefined} grow>
          <div className="flex flex-col divide-y divide-border">
            {summary.repairs.map((r) => {
              const profit = r.repair_profit ?? 0;
              return (
                <div key={r.ref_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0 truncate text-[13px] text-ink">
                    {r.detail || r.label} — {(r.repair_revenue ?? 0) > 0 ? "ลูกค้ารับแล้ว" : "ลูกค้าทิ้ง"}
                  </span>
                  <span className={`shrink-0 text-[13.5px] font-bold tabular-nums ${profit < 0 ? "text-warning" : "text-success"}`}>
                    {profit > 0 ? "+" : ""}{baht(profit)}
                  </span>
                </div>
              );
            })}
            {summary.repairs.length === 0 && <p className="text-sm text-ink-muted">ไม่มีงานซ่อมที่ปิดในช่วงนี้</p>}
          </div>
          <p className="mt-auto border-t border-dashed border-border pt-3 text-[11.5px] leading-4 text-ink-muted">
            กำไรงานซ่อมติดลบได้ — งานที่ลูกค้าทิ้งนับเป็นงานปิดแต่ไม่มีรายได้คู่กัน ไม่ใช่ข้อผิดพลาด
          </p>
        </Panel>
      </div>
    </div>
  );
}
