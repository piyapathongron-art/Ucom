"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KIND_LABEL, entryProfit, entryRevenue, type ReportEntry } from "./types";

type SaleLine = {
  id: string;
  name_snapshot: string | null;
  qty: number | null;
  unit_price: number | null;
  item_discount: number | null;
};

function timeInBangkok(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function money(n: number): string {
  return n.toLocaleString();
}

// The line items of one bill. Only sale entries open — a repair job's money is its quote
// and its part cost, which the entry row already shows in full.
// ponytail: fetched per bill on open, no cache — a bill is opened once and has a handful
// of lines. Cache it if the owner starts opening dozens in a row.
function SaleLines({ saleId }: { saleId: string }) {
  const supabase = createClient();
  const [lines, setLines] = useState<SaleLine[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isStale = false;
    supabase
      .from("sale_items")
      .select("id,name_snapshot,qty,unit_price,item_discount")
      .eq("sale_id", saleId)
      .then(
        ({ data, error }) => {
          if (isStale) return;
          if (error) {
            console.error(error);
            setFailed(true);
          } else {
            setLines(data ?? []);
          }
        },
        () => {
          if (isStale) return;
          setFailed(true);
        },
      );
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  if (failed) return <p className="px-4 py-2 text-sm text-red-600">โหลดรายการสินค้าไม่สำเร็จ</p>;
  if (!lines) return <p className="px-4 py-2 text-sm text-neutral-500">กำลังโหลด</p>;
  if (lines.length === 0)
    return <p className="px-4 py-2 text-sm text-neutral-500">บิลนี้ไม่มีรายการสินค้า</p>;

  return (
    <table
      data-testid={`sale-lines-${saleId}`}
      className="w-full text-left text-sm whitespace-nowrap"
    >
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-neutral-100">
            <td className="px-4 py-1">{line.name_snapshot}</td>
            <td className="px-4 py-1 text-right">× {line.qty ?? 0}</td>
            <td className="px-4 py-1 text-right">{money(line.unit_price ?? 0)}</td>
            <td className="px-4 py-1 text-right text-neutral-500">
              {(line.item_discount ?? 0) > 0 ? `ลด ${money(line.item_discount ?? 0)}` : ""}
            </td>
            <td className="px-4 py-1 text-right">
              {money((line.unit_price ?? 0) * (line.qty ?? 0) - (line.item_discount ?? 0))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DayEntries({ day }: { day: string }) {
  const supabase = createClient();
  const [entries, setEntries] = useState<ReportEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openSale, setOpenSale] = useState<string | null>(null);

  useEffect(() => {
    let isStale = false;
    supabase
      .from("v_report_entries")
      .select("*")
      .eq("day", day)
      .order("occurred_at", { ascending: true })
      .then(
        ({ data, error }) => {
          if (isStale) return;
          if (error) {
            console.error(error);
            setFailed(true);
          } else {
            setEntries(data ?? []);
          }
        },
        () => {
          if (isStale) return;
          setFailed(true);
        },
      );
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  if (failed)
    return (
      <p data-testid="entries-error" className="px-4 py-2 text-sm text-red-600">
        โหลดรายละเอียดไม่สำเร็จ
      </p>
    );
  if (!entries) return <p className="px-4 py-2 text-sm text-neutral-500">กำลังโหลด</p>;
  if (entries.length === 0)
    return <p className="px-4 py-2 text-sm text-neutral-500">ไม่มีรายการในวันนี้</p>;

  return (
    <table
      data-testid={`day-entries-${day}`}
      className="w-full text-left text-sm whitespace-nowrap"
    >
      <tbody>
        {entries.map((entry) => {
          const isSale = entry.kind === "sale" && entry.ref_id;
          const isOpen = isSale && openSale === entry.ref_id;
          const profit = entryProfit(entry);
          return (
            <tr key={`${entry.kind}-${entry.ref_id}`} className="border-b border-neutral-100">
              <td className="px-4 py-1 align-top" colSpan={7}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-neutral-500">{timeInBangkok(entry.occurred_at)}</span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                    {KIND_LABEL[entry.kind ?? ""] ?? entry.kind}
                  </span>
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-neutral-500">{entry.detail}</span>
                  <span className="ml-auto">รายได้ {money(entryRevenue(entry))}</span>
                  <span
                    data-testid="entry-profit"
                    className={`w-32 text-right ${profit < 0 ? "text-red-600" : ""}`}
                  >
                    กำไร {money(profit)}
                  </span>
                  {isSale && (
                    <button
                      type="button"
                      data-testid={`open-sale-${entry.ref_id}`}
                      onClick={() => setOpenSale(isOpen ? null : entry.ref_id)}
                      className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs"
                    >
                      {isOpen ? "ปิดรายการ" : "ดูรายการ"}
                    </button>
                  )}
                </div>
                {isOpen && entry.ref_id && <SaleLines saleId={entry.ref_id} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
