"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { channelOf } from "./summary";

type Line = { id: string; name_snapshot: string | null; qty: number | null; unit_price: number | null; unit_cost: number | null; item_discount: number | null };
type Bill = {
  soldAt: string | null;
  channel: string;
  staff: string;
  billDiscount: number;
  lines: Line[];
};

const baht = (n: number) => `${n < 0 ? "−" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const lineTotal = (l: Line) => (l.unit_price ?? 0) * (l.qty ?? 0) - (l.item_discount ?? 0);
const lineProfit = (l: Line) => lineTotal(l) - (l.unit_cost ?? 0) * (l.qty ?? 0);

// One bill as the design board shows it: header, lines with profit, discounts, net.
// The printed receipt is this same panel (see the @media print rule in globals.css).
export function BillDetail({ saleId, netProfit }: { saleId: string; netProfit: number }) {
  const supabase = createClient();
  const [bill, setBill] = useState<Bill | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isStale = false;
    Promise.resolve().then(async () => {
      try {
        const [sale, items] = await Promise.all([
          supabase.from("sales").select("sold_at, payment_method, receiving_account, bill_discount, created_by").eq("id", saleId).single(),
          supabase.from("sale_items").select("id, name_snapshot, qty, unit_price, unit_cost, item_discount").eq("sale_id", saleId).order("id"),
        ]);
        if (sale.error || items.error) throw new Error("bill load failed");
        const person = sale.data.created_by
          ? await supabase.from("profiles").select("display_name").eq("id", sale.data.created_by).maybeSingle()
          : null;
        if (isStale) return;
        setBill({
          soldAt: sale.data.sold_at,
          channel: channelOf(sale.data.payment_method, sale.data.receiving_account),
          staff: person?.data?.display_name ?? "-",
          billDiscount: sale.data.bill_discount ?? 0,
          lines: items.data ?? [],
        });
      } catch {
        if (!isStale) setFailed(true);
      }
    });
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  if (failed) return <p className="px-5 py-4 text-sm text-danger">โหลดรายละเอียดบิลไม่สำเร็จ</p>;
  if (!bill) return <p className="px-5 py-4 text-sm text-ink-muted">กำลังโหลด</p>;

  const gross = bill.lines.reduce((sum, l) => sum + (l.unit_price ?? 0) * (l.qty ?? 0) - (l.item_discount ?? 0), 0);
  const when = bill.soldAt
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" }).format(new Date(bill.soldAt))
    : "";

  return (
    <div data-testid={`bill-detail-${saleId}`} data-print-area className="space-y-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{when}</p>
          <p className="text-xs text-ink-muted">พนักงาน: {bill.staff} · ช่องทาง: {bill.channel}</p>
        </div>
        <button type="button" onClick={() => window.print()} data-testid="bill-print" className="ucom-secondary px-4 py-2 text-sm print:hidden">
          พิมพ์ใบเสร็จ
        </button>
      </div>
      <table data-testid={`sale-lines-${saleId}`} className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-ink-muted">
            <th className="py-1 font-medium">สินค้า</th>
            <th className="py-1 text-right font-medium">จำนวน</th>
            <th className="py-1 text-right font-medium">ราคา/ชิ้น</th>
            <th className="py-1 text-right font-medium">รวม</th>
            <th className="py-1 text-right font-medium print:hidden">กำไร</th>
          </tr>
        </thead>
        <tbody>
          {bill.lines.map((l) => (
            <tr key={l.id} className="border-t border-border">
              <td className="py-1.5">{l.name_snapshot}</td>
              <td className="py-1.5 text-right tabular-nums">× {l.qty ?? 0}</td>
              <td className="py-1.5 text-right tabular-nums">{baht(l.unit_price ?? 0)}</td>
              <td className="py-1.5 text-right tabular-nums">{baht(lineTotal(l))}</td>
              <td className={`py-1.5 text-right tabular-nums print:hidden ${lineProfit(l) < 0 ? "text-danger" : "text-success"}`}>{baht(lineProfit(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-ink-muted"><dt>ยอดรวมก่อนส่วนลด</dt><dd className="tabular-nums">{baht(gross)}</dd></div>
        {bill.billDiscount > 0 && <div className="flex justify-between text-ink-muted"><dt>ส่วนลดท้ายบิล</dt><dd className="tabular-nums">−{baht(bill.billDiscount)}</dd></div>}
        <div className="flex justify-between font-semibold text-ink"><dt>ยอดชำระสุทธิ</dt><dd className="tabular-nums">{baht(gross - bill.billDiscount)}</dd></div>
        <div className="flex justify-between text-ink-muted print:hidden"><dt>กำไรสุทธิบิลนี้ (หลังหักส่วนลด)</dt><dd className={`tabular-nums ${netProfit < 0 ? "text-danger" : "text-success"}`}>{baht(netProfit)}</dd></div>
      </dl>
    </div>
  );
}
