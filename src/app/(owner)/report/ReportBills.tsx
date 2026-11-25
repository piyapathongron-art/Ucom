"use client";

import { Fragment, useEffect, useState } from "react";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { createClient } from "@/lib/supabase/client";
import { pageRange } from "@/lib/supabase/pagination";
import { BillDetail } from "./BillDetail";
import { THAI_AID_ACCOUNT, billLabel, channelOf } from "./summary";

type BillRow = {
  id: string;
  billNo: number | null;
  occurredAt: string | null;
  channel: string;
  staff: string;
  revenue: number;
  profit: number;
};

const baht = (n: number) => `${n < 0 ? "−" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
    : "";

// Channel chips: cash neutral, transfer brand tint, the Thai-aid account amber (text-on-tint pairs).
const CHANNEL_TONE: Record<string, string> = {
  เงินสด: "bg-muted text-foreground",
  โอนเงิน: "bg-accent text-accent-foreground",
  [THAI_AID_ACCOUNT]: "bg-warning-bg text-warning",
};

// Every sale bill in the range, newest first. A row opens its line items in place.
export function ReportBills({ from, to }: { from: string; to: string }) {
  const supabase = createClient();
  const [bills, setBills] = useState<BillRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    const { from: a, to: b } = pageRange(page, pageSize);
    Promise.resolve().then(async () => {
      if (isStale) return;
      setBills(null);
      setFailed(false);
      try {
        const entries = await supabase.from("v_report_entries")
          .select("ref_id, occurred_at, detail, sale_revenue, sale_profit", { count: "exact" })
          .eq("kind", "sale").gte("day", from).lte("day", to)
          .order("occurred_at", { ascending: false }).order("ref_id").range(a, b);
        if (entries.error) throw entries.error;
        const ids = (entries.data ?? []).map((e) => e.ref_id!).filter(Boolean);
        const headers = ids.length ? await supabase.from("sales").select("id, bill_no, receiving_account, created_by").in("id", ids) : { data: [], error: null };
        if (headers.error) throw headers.error;
        // Staff names are a nicety: if profiles are not readable the column shows "-".
        const staffIds = [...new Set((headers.data ?? []).map((h) => h.created_by).filter(Boolean))] as string[];
        const people = staffIds.length ? await supabase.from("profiles").select("id, display_name").in("id", staffIds) : { data: [] };
        if (isStale) return;
        const header = new Map((headers.data ?? []).map((h) => [h.id, h]));
        const name = new Map((people.data ?? []).map((p) => [p.id, p.display_name]));
        setBills((entries.data ?? []).map((e) => {
          const h = header.get(e.ref_id ?? "");
          return {
            id: e.ref_id ?? "",
            billNo: h?.bill_no ?? null,
            occurredAt: e.occurred_at,
            channel: channelOf(e.detail, h?.receiving_account ?? null),
            staff: name.get(h?.created_by ?? "") ?? "-",
            revenue: e.sale_revenue ?? 0,
            profit: e.sale_profit ?? 0,
          };
        }));
        setTotal(entries.count ?? 0);
      } catch {
        if (!isStale) setFailed(true);
      }
    });
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, page, pageSize, retryKey]);

  if (failed)
    return (
      <div data-testid="report-bills-error" role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-bg p-4 text-sm font-semibold text-danger">
        <span>โหลดรายการบิลไม่สำเร็จ</span>
        <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="ucom-danger bg-card px-4 text-sm">ลองใหม่</button>
      </div>
    );
  if (!bills) return <div aria-busy="true" aria-label="กำลังโหลดรายการบิล" className="h-72 animate-pulse rounded-xl bg-card shadow-card motion-reduce:animate-none" />;
  if (bills.length === 0) return <p data-testid="report-bills-empty" className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card">ไม่มีบิลขายในช่วงที่เลือก</p>;

  return (
    <div className="space-y-3">
      <div className="ucom-table-wrap">
        <p className="px-5 pt-4 pb-1 text-sm text-muted-foreground">กดเลขที่บิลหรือแถวเพื่อดูรายการสินค้าในบิล</p>
        <table data-testid="report-bills" className="ucom-table whitespace-nowrap">
          <thead>
            <tr>
              <th scope="col">เลขที่บิล</th>
              <th scope="col">เวลา</th>
              <th scope="col">ช่องทาง</th>
              <th scope="col">พนักงาน</th>
              <th scope="col" className="text-right">ยอดรวม</th>
              <th scope="col" className="text-right">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const isOpen = openId === bill.id;
              const toggle = () => setOpenId(isOpen ? null : bill.id);
              return (
                <Fragment key={bill.id}>
                  <tr
                    data-testid={`report-bill-${bill.id}`}
                    onClick={toggle}
                    aria-expanded={isOpen}
                    className={`cursor-pointer ${isOpen ? "bg-accent shadow-[inset_3px_0_0_var(--primary)]" : "hover:bg-muted"}`}
                  >
                    <td data-testid="bill-no" className="font-semibold tabular-nums">
                      <button type="button" aria-expanded={isOpen} onClick={(event) => { event.stopPropagation(); toggle(); }} className="min-h-10 rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary">
                        {billLabel(bill.billNo)}
                      </button>
                    </td>
                    <td className="tabular-nums text-muted-foreground">{when(bill.occurredAt)}</td>
                    <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHANNEL_TONE[bill.channel] ?? "bg-muted text-foreground"}`}>{bill.channel}</span></td>
                    <td className="text-muted-foreground">{bill.staff}</td>
                    <td className="text-right font-semibold tabular-nums">{baht(bill.revenue)}</td>
                    <td className={`text-right font-semibold tabular-nums ${bill.profit < 0 ? "text-danger" : "text-success"}`}>{baht(bill.profit)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="bg-muted !p-0">
                        <BillDetail saleId={bill.id} netProfit={bill.profit} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        label="บิล"
        testIdPrefix="report-bills-pagination"
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}
