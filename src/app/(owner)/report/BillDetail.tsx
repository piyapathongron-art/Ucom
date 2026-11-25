"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { billLabel, channelOf } from "./summary";

type Line = { id: string; name_snapshot: string | null; qty: number | null; unit_price: number | null; unit_cost: number | null; item_discount: number | null };
type Bill = {
  billNo: number | null;
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
          supabase.from("sales").select("bill_no, sold_at, payment_method, receiving_account, bill_discount, created_by").eq("id", saleId).single(),
          supabase.from("sale_items").select("id, name_snapshot, qty, unit_price, unit_cost, item_discount").eq("sale_id", saleId).order("id"),
        ]);
        if (sale.error || items.error) throw new Error("bill load failed");
        const person = sale.data.created_by
          ? await supabase.from("profiles").select("display_name").eq("id", sale.data.created_by).maybeSingle()
          : null;
        if (isStale) return;
        setBill({
          billNo: sale.data.bill_no,
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

  if (failed) return <p role="alert" className="px-5 py-4 text-sm font-semibold text-danger">โหลดรายละเอียดบิลไม่สำเร็จ</p>;
  if (!bill) return <p aria-busy="true" className="px-5 py-4 text-sm text-muted-foreground">กำลังโหลด</p>;

  const gross = bill.lines.reduce((sum, l) => sum + (l.unit_price ?? 0) * (l.qty ?? 0) - (l.item_discount ?? 0), 0);
  const when = bill.soldAt
    ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "long", timeStyle: "short" }).format(new Date(bill.soldAt))
    : "";

  return (
    <div data-testid={`bill-detail-${saleId}`} data-print-area className="m-3 space-y-4 rounded-xl bg-card p-5 whitespace-normal shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p data-testid="bill-detail-no" className="text-base font-bold text-foreground">บิล {billLabel(bill.billNo)} · {when}</p>
          <p className="text-sm text-muted-foreground">พนักงาน: {bill.staff} · ช่องทาง: {bill.channel}</p>
        </div>
        <button type="button" onClick={() => window.print()} data-testid="bill-print" className="ucom-secondary px-4 text-sm print:hidden">
          พิมพ์ใบเสร็จ
        </button>
      </div>
      <div className="overflow-x-auto">
        <table data-testid={`sale-lines-${saleId}`} className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 font-semibold">สินค้า</th>
              <th scope="col" className="py-1.5 text-right font-semibold">จำนวน</th>
              <th scope="col" className="py-1.5 text-right font-semibold">ราคา/ชิ้น</th>
              <th scope="col" className="py-1.5 text-right font-semibold">รวม</th>
              <th scope="col" className="py-1.5 text-right font-semibold print:hidden">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-2 pr-3">{l.name_snapshot}</td>
                <td className="py-2 text-right tabular-nums">× {l.qty ?? 0}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{baht(l.unit_price ?? 0)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{baht(lineTotal(l))}</td>
                <td className={`py-2 pl-3 text-right tabular-nums print:hidden ${lineProfit(l) < 0 ? "text-danger" : "text-success"}`}>{baht(lineProfit(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-sm space-y-1.5 border-t border-dashed border-border pt-3 text-sm">
        <div className="flex justify-between gap-3 text-muted-foreground"><dt>ยอดรวมก่อนส่วนลด</dt><dd className="tabular-nums">{baht(gross)}</dd></div>
        {bill.billDiscount > 0 && <div className="flex justify-between gap-3 text-muted-foreground"><dt>ส่วนลดท้ายบิล</dt><dd className="tabular-nums text-danger">−{baht(bill.billDiscount)}</dd></div>}
        <div className="flex items-baseline justify-between gap-3 font-semibold text-foreground"><dt>ยอดชำระสุทธิ</dt><dd className="text-xl font-bold tabular-nums text-primary">{baht(gross - bill.billDiscount)}</dd></div>
        <div className="flex justify-between gap-3 text-muted-foreground print:hidden"><dt>กำไรสุทธิบิลนี้ (หลังหักส่วนลด)</dt><dd className={`font-semibold tabular-nums ${netProfit < 0 ? "text-danger" : "text-success"}`}>{baht(netProfit)}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground print:hidden">ตอนพิมพ์จะซ่อนคอลัมน์กำไร</p>
    </div>
  );
}
