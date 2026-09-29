"use client";

import { Fragment, useEffect, useState } from "react";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { createClient } from "@/lib/supabase/client";
import { pageRange } from "@/lib/supabase/pagination";
import { BillDetail } from "./BillDetail";
import { billLabel, channelOf } from "./summary";

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
      <div data-testid="report-bills-error" className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
        <span>โหลดรายการบิลไม่สำเร็จ</span>
        <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="ucom-danger px-4 py-2 text-sm">ลองใหม่</button>
      </div>
    );
  if (!bills) return <p className="text-sm text-ink-muted">กำลังโหลดรายการบิล...</p>;
  if (bills.length === 0) return <p data-testid="report-bills-empty" className="ucom-info">ไม่มีบิลขายในช่วงที่เลือก</p>;

  return (
    <div className="space-y-3">
      <div className="ucom-table-wrap">
        <table data-testid="report-bills" className="ucom-table whitespace-nowrap">
          <thead>
            <tr>
              <th>เลขที่บิล</th>
              <th>เวลา</th>
              <th>ช่องทาง</th>
              <th>พนักงาน</th>
              <th className="text-right">ยอดรวม</th>
              <th className="text-right">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => {
              const isOpen = openId === bill.id;
              return (
                <Fragment key={bill.id}>
                  <tr
                    data-testid={`report-bill-${bill.id}`}
                    onClick={() => setOpenId(isOpen ? null : bill.id)}
                    aria-expanded={isOpen}
                    className="cursor-pointer hover:bg-brand-ink/40"
                  >
                    <td data-testid="bill-no" className="font-semibold tabular-nums">{billLabel(bill.billNo)}</td>
                    <td className="tabular-nums text-ink-muted">{when(bill.occurredAt)}</td>
                    <td>{bill.channel}</td>
                    <td className="text-ink-muted">{bill.staff}</td>
                    <td className="text-right font-semibold tabular-nums">{baht(bill.revenue)}</td>
                    <td className={`text-right font-semibold tabular-nums ${bill.profit < 0 ? "text-danger" : "text-success"}`}>{baht(bill.profit)}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} className="bg-sunken !p-0">
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
      <p className="text-xs text-ink-muted">คลิกแถวเพื่อดูรายการสินค้าในบิล</p>
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
