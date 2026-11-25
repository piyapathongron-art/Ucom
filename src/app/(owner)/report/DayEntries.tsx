"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
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
  return n.toLocaleString("th-TH");
}

// Kind chips on the ADR 0033 text-on-tint pairs; SF uses brand blue, not purple (owner decision 6 pending).
const KIND_TONE: Record<string, string> = {
  sale: "bg-accent text-accent-foreground",
  repair: "bg-success-bg text-success",
  sf: "bg-secondary text-foreground",
  expense: "bg-danger-bg text-danger",
};

// The line items of one bill. Only sale entries open — a repair job's money is its quote
// and its part cost, which the entry row already shows in full.
// ponytail: fetched per bill on open, no cache — a bill is opened once and has a handful
// of lines. Cache it if the owner starts opening dozens in a row.
export function SaleLines({ saleId }: { saleId: string }) {
  const supabase = createClient();
  const [lines, setLines] = useState<SaleLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let isStale = false;
    const { from, to } = pageRange(page, pageSize);
    Promise.resolve().then(() => {
      if (isStale) return;
      setLines(null);
      setFailed(false);
      return supabase
        .from("sale_items")
        .select("id,name_snapshot,qty,unit_price,item_discount", { count: "exact" })
        .eq("sale_id", saleId)
        .order("id", { ascending: true })
        .range(from, to)
        .then(
          ({ data, count, error }) => {
            if (isStale) return;
            if (error) {
              console.error(error);
              setFailed(true);
            } else {
              const nextLines = data ?? [];
              const nextTotal = count ?? nextLines.length;
              if (nextLines.length === 0 && nextTotal > 0 && page > 1) {
                setPage((current) => Math.max(1, current - 1));
              } else {
                setLines(nextLines);
              }
              setTotal(nextTotal);
            }
          },
          () => {
            if (isStale) return;
            setFailed(true);
          },
        );
    });
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, page, pageSize]);

  if (failed) return <p className="px-4 py-2 text-sm text-danger">โหลดรายการสินค้าไม่สำเร็จ</p>;
  if (!lines) return <p className="px-4 py-2 text-sm text-muted-foreground">กำลังโหลด</p>;
  if (lines.length === 0)
    return <p className="px-4 py-2 text-sm text-muted-foreground">บิลนี้ไม่มีรายการสินค้า</p>;

  return (
    <div>
      <table
        data-testid={`sale-lines-${saleId}`}
        className="w-full text-left text-sm whitespace-nowrap"
      >
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-border">
              <td className="px-4 py-1">{line.name_snapshot}</td>
              <td className="px-4 py-1 text-right">× {line.qty ?? 0}</td>
              <td className="px-4 py-1 text-right">{money(line.unit_price ?? 0)}</td>
              <td className="px-4 py-1 text-right text-muted-foreground">
                {(line.item_discount ?? 0) > 0 ? `ลด ${money(line.item_discount ?? 0)}` : ""}
              </td>
              <td className="px-4 py-1 text-right">
                {money((line.unit_price ?? 0) * (line.qty ?? 0) - (line.item_discount ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        label="รายการในบิล"
        testIdPrefix={`sale-lines-${saleId}-pagination`}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}

export function DayEntries({ day }: { day: string }) {
  const supabase = createClient();
  const [entries, setEntries] = useState<ReportEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [kindFilter, setKindFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isLoading, setIsLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let isStale = false;
    const { from, to } = pageRange(page, pageSize);
    Promise.resolve().then(() => {
      if (isStale) return;
      setIsLoading(true);
      setFailed(false);
      let query = supabase
        .from("v_report_entries")
        .select("*", { count: "exact" })
        .eq("day", day);
      if (kindFilter !== "all") query = query.eq("kind", kindFilter);
      const searchFilter = orIlike(["label", "detail"], deferredSearch);
      if (searchFilter) query = query.or(searchFilter);
      return query
        .order("occurred_at", { ascending: true })
        .order("ref_id", { ascending: true })
        .order("kind", { ascending: true })
        .order("label", { ascending: true })
        .order("detail", { ascending: true })
        .range(from, to)
        .then(
          ({ data, count, error }) => {
            if (isStale) return;
            if (error) {
              console.error(error);
              setFailed(true);
              setEntries([]);
            } else {
              setFailed(false);
              setEntries(data ?? []);
              setTotal(count ?? data?.length ?? 0);
            }
            setIsLoading(false);
          },
          () => {
            if (isStale) return;
            setFailed(true);
            setEntries([]);
            setIsLoading(false);
          },
        );
    });
    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, page, pageSize, kindFilter, deferredSearch, retryKey]);

  if (failed)
    return (
      <div data-testid="entries-error" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-danger">
        <span>โหลดรายละเอียดไม่สำเร็จ</span>
        <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="ucom-danger px-3 py-1.5 text-sm">
          ลองใหม่
        </button>
      </div>
    );
  if (isLoading || !entries) return <p className="px-4 py-2 text-sm text-muted-foreground">กำลังโหลด</p>;
  if (entries.length === 0)
    return (
      <div className="space-y-3 px-4 py-3">
        <DetailFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          kindFilter={kindFilter}
          onKindChange={(value) => {
            setKindFilter(value);
            setPage(1);
          }}
        />
        <p className="text-sm text-muted-foreground">ไม่มีรายการในวันนี้</p>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          label="รายการรายวัน"
          testIdPrefix={`report-detail-${day}-pagination`}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
        />
      </div>
    );

  return (
    <div className="space-y-3 px-4 py-3">
      <DetailFilters
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        kindFilter={kindFilter}
        onKindChange={(value) => {
          setKindFilter(value);
          setPage(1);
        }}
      />
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
              <tr key={`${entry.kind}-${entry.ref_id}-${entry.occurred_at}`} className="border-b border-border last:border-b-0">
                <td className="py-2.5 align-top whitespace-normal" colSpan={7}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="w-12 tabular-nums text-muted-foreground">{timeInBangkok(entry.occurred_at)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_TONE[entry.kind ?? ""] ?? "bg-muted text-foreground"}`}>
                    {KIND_LABEL[entry.kind ?? ""] ?? entry.kind}
                  </span>
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block font-semibold">{entry.label}</span>
                    {entry.detail && <span className="block text-xs text-muted-foreground">{entry.detail}</span>}
                  </span>
                  <span className="tabular-nums">รายได้ {money(entryRevenue(entry))}</span>
                  <span
                    data-testid="entry-profit"
                    className={`min-w-28 text-right font-semibold tabular-nums ${profit < 0 ? "text-danger" : "text-success"}`}
                  >
                    กำไร {money(profit)}
                  </span>
                  {isSale && (
                    <button
                      type="button"
                      data-testid={`open-sale-${entry.ref_id}`}
                      aria-expanded={Boolean(isOpen)}
                      onClick={() => setOpenSale(isOpen ? null : entry.ref_id)}
                      className="ucom-secondary px-3 text-xs"
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
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        label="รายการรายวัน"
        testIdPrefix={`report-detail-${day}-pagination`}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </div>
  );
}

function DetailFilters({
  search,
  onSearchChange,
  kindFilter,
  onKindChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  kindFilter: string;
  onKindChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`${id}-search`}>ค้นหารายการ</label>
      <input
        id={`${id}-search`}
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        data-testid="report-detail-search"
        placeholder="ค้นหารายการ"
        className="ucom-field h-10 w-full rounded-full px-4 text-sm md:w-64"
      />
      <label className="sr-only" htmlFor={`${id}-kind`}>ประเภทรายการ</label>
      <select
        id={`${id}-kind`}
        value={kindFilter}
        onChange={(event) => onKindChange(event.target.value)}
        data-testid="report-detail-kind"
        className="ucom-field h-10 rounded-full px-4 text-sm"
      >
        <option value="all">ทุกประเภท</option>
        <option value="sale">ขาย</option>
        <option value="repair">ซ่อม</option>
        <option value="sf">SF+</option>
        <option value="expense">รายจ่าย</option>
      </select>
    </div>
  );
}
