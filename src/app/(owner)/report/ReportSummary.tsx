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

export function Panel({ title, aside, children, grow = false, testId }: { title: string; aside?: string; children: React.ReactNode; grow?: boolean; testId?: string }) {
  return (
    <section data-testid={testId} className={`flex flex-col gap-4 rounded-xl bg-card p-5 shadow-card ${grow ? "flex-1" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {aside && <span className="text-sm text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

// Decorative: every bar sits next to its value in text, so the bar itself carries no information alone.
export function Bar({ share, isLead, isNegative = false }: { share: number; isLead: boolean; isNegative?: boolean }) {
  return (
    <div aria-hidden="true" className="h-2.5 w-full rounded-full bg-muted">
      <div className={`h-full rounded-full ${isNegative ? "bg-danger" : isLead ? "bg-primary" : "bg-primary/45"}`} style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
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
      <div data-testid="report-summary-error" role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-bg p-4 text-sm font-semibold text-danger">
        <span>โหลดสรุปไม่สำเร็จ</span>
        <button type="button" onClick={() => { setFailed(false); setRetryKey((k) => k + 1); }} className="ucom-danger bg-card px-4 text-sm">ลองใหม่</button>
      </div>
    );
  if (!summary)
    return (
      <div aria-busy="true" aria-label="กำลังโหลดสรุป" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {[0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-card shadow-card motion-reduce:animate-none" />)}
      </div>
    );

  const channelTotal = summary.channels.reduce((s, c) => s + c.amount, 0);
  const maxQty = summary.top[0]?.qty ?? 0;

  return (
    <div data-testid="report-summary" className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="ยอดขายตามช่องทางรับเงิน">
          <div className="flex flex-col gap-3">
            {summary.channels.map((c, i) => {
              const share = channelTotal > 0 ? Math.round((c.amount / channelTotal) * 100) : 0;
              return (
                <div key={c.channel} data-testid={`report-channel-${c.channel}`} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap justify-between gap-x-3 text-sm font-semibold text-foreground">
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
            <p className="text-sm text-muted-foreground">ยังไม่มีสินค้าขายในช่วงนี้</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {summary.top.map((p, i) => (
                <li key={p.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
                  <span className="truncate text-sm font-medium text-foreground" title={p.name}>{p.name}</span>
                  <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"><Bar share={maxQty > 0 ? (p.qty / maxQty) * 100 : 0} isLead={i === 0} /></span>
                  <span className="text-right text-sm font-semibold tabular-nums text-foreground">{p.qty} ชิ้น</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel title="ค่าคอม SF+" aside={summary.pendingCount > 0 ? `${summary.pendingCount} เครื่องรอค่าคอม` : undefined}>
          <ul className="flex flex-col divide-y divide-border">
            {summary.sf.map((r) => (
              <li key={`${r.ref_id}-${r.day}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">IMEI ···{(r.detail ?? "").slice(-4)}</span>
                  <span className="text-xs text-muted-foreground">รับเงินเข้า {shortDate(r.day)}</span>
                </div>
                <span className="text-sm font-bold tabular-nums text-success">{baht(r.sf_commission ?? 0)}</span>
              </li>
            ))}
            {summary.pending.map((p) => (
              <li key={p.device_unit_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{p.model_name} · {(p.imei ?? "").slice(-4)}</span>
                  <span className="text-xs text-muted-foreground">ยังไม่ได้รับ</span>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">รอทราบ</span>
              </li>
            ))}
            {summary.sf.length === 0 && summary.pending.length === 0 && <li className="text-sm text-muted-foreground">ไม่มีค่าคอมในช่วงนี้</li>}
          </ul>
        </Panel>

        <Panel title="งานซ่อมที่ปิดช่วงนี้" aside={summary.repairCount > LIST_LIMIT ? `${summary.repairCount} งาน` : undefined} grow>
          <ul className="flex flex-col divide-y divide-border">
            {summary.repairs.map((r) => {
              const profit = r.repair_profit ?? 0;
              return (
                <li key={r.ref_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0 truncate text-sm text-foreground">
                    {r.detail || r.label} — {(r.repair_revenue ?? 0) > 0 ? "ลูกค้ารับแล้ว" : "ลูกค้าทิ้ง"}
                  </span>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${profit < 0 ? "text-warning" : "text-success"}`}>
                    {profit > 0 ? "+" : ""}{baht(profit)}
                  </span>
                </li>
              );
            })}
            {summary.repairs.length === 0 && <li className="text-sm text-muted-foreground">ไม่มีงานซ่อมที่ปิดในช่วงนี้</li>}
          </ul>
          <p className="mt-auto border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
            กำไรงานซ่อมติดลบได้ — งานที่ลูกค้าทิ้งนับเป็นงานปิดแต่ไม่มีรายได้คู่กัน ไม่ใช่ข้อผิดพลาด
          </p>
        </Panel>
      </div>
    </div>
  );
}
