"use client";

import { useState } from "react";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { CatalogCard } from "./CatalogCard";
import { CategoryIcon, ICON_TONE, iconForCategory, type IconName } from "./CategoryIcon";
import type { CatalogRow, Carrier } from "./types";

// "cat:<name>" = products of one category; devices and top-up have their own tabs.
export type CatalogTab = "all" | "device" | "topup" | `cat:${string}`;
export type CatalogTabInfo = { value: CatalogTab; label: string; icon: IconName; count?: number };

export function Catalog({
  tabs,
  catalog,
  topProducts,
  carriers,
  onAddCatalog,
  onAddTopup,
  onFinanceDevice,
  search,
  onSearchChange,
  tab,
  onTabChange,
  page,
  pageSize,
  total,
  isLoading,
  catalogError,
  onRetry,
  onPageChange,
  onPageSizeChange,
}: {
  tabs: CatalogTabInfo[];
  catalog: CatalogRow[];
  topProducts: CatalogRow[];
  carriers: Carrier[];
  onAddCatalog: (item: CatalogRow) => void;
  onAddTopup: (carrier: Carrier, amount: number) => void;
  onFinanceDevice: (item: CatalogRow) => Promise<string | null>;
  search: string;
  onSearchChange: (value: string) => void;
  tab: CatalogTab;
  onTabChange: (value: CatalogTab) => void;
  page: number;
  pageSize: number;
  total: number;
  isLoading: boolean;
  catalogError: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [topupCarrier, setTopupCarrier] = useState<Carrier | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [financeItem, setFinanceItem] = useState<CatalogRow | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financing, setFinancing] = useState(false);
  const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "full" }).format(new Date());

  function submitTopup() {
    const amount = Number(topupAmount);
    if (!topupCarrier || !amount || amount <= 0) return;
    onAddTopup(topupCarrier, amount);
    setTopupCarrier(null);
    setTopupAmount("");
  }

  function cancelFinance() {
    setFinanceItem(null);
    setFinanceError(null);
  }

  async function submitFinance() {
    if (!financeItem) return;

    setFinancing(true);
    setFinanceError(null);
    const error = await onFinanceDevice(financeItem);
    setFinancing(false);
    if (error) {
      setFinanceError(error);
      return;
    }
    cancelFinance();
  }

  const isTopup = tab === "topup";
  const showTop = tab === "all" && !search && topProducts.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 space-y-3 border-b border-border bg-background/95 px-6 pb-3 pt-5 backdrop-blur">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[0.68rem] tracking-[0.08em] text-ink-muted">{today}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">หน้าขาย</h1>
          </div>
          <span className="text-xs text-ink-muted">แตะการ์ดเพื่อเพิ่มเข้าบิล · สแกนบาร์โค้ดได้ทุกหน้า</span>
        </div>
        <label className="relative block">
          <span className="sr-only">ค้นหาสินค้า/เครื่อง</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า / SKU / IMEI"
            data-testid="catalog-search"
            className="ucom-field w-full py-3 pl-11 pr-4 text-sm"
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-muted">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </label>
        <div role="tablist" aria-label="ประเภทสินค้า" className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const isActive = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(t.value)}
                data-testid={`catalog-tab-${t.value}`}
                className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition-colors ${
                  isActive ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                <span className={`grid size-6 place-items-center rounded-full ${isActive ? "bg-on-accent/10" : ICON_TONE[t.icon]}`}>
                  <CategoryIcon name={t.icon} className="size-3.5" />
                </span>
                {t.label}
                {t.count != null && <span className={`font-mono text-xs ${isActive ? "text-on-accent/70" : "text-ink-faint"}`}>{t.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {isTopup ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">เลือกเครือข่ายที่จะเติมเงิน</h2>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {carriers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`topup-carrier-${c.name}`}
                  aria-pressed={topupCarrier?.id === c.id}
                  onClick={() => setTopupCarrier(c)}
                  className={`ucom-surface flex items-center gap-3 rounded-2xl border p-4 text-left ${topupCarrier?.id === c.id ? "border-accent" : "border-transparent hover:border-accent/60"}`}
                >
                  <span className={`grid size-10 place-items-center rounded-xl ${ICON_TONE.topup}`}><CategoryIcon name="topup" /></span>
                  <span className="font-semibold text-ink">{c.name}</span>
                </button>
              ))}
            </div>
            {topupCarrier && (
              <div className="ucom-surface flex flex-wrap items-center gap-3 rounded-2xl p-4">
                <span className="text-sm font-medium text-ink">เติม {topupCarrier.name}</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder="ยอดเงิน (บาท)"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTopup()}
                  data-testid="topup-amount"
                  className="ucom-field w-40 px-4 py-2 text-sm"
                />
                <button type="button" onClick={submitTopup} data-testid="topup-add" className="ucom-primary px-5 py-2 text-sm">
                  เพิ่มเข้าบิล
                </button>
                <button type="button" onClick={() => setTopupCarrier(null)} className="px-2 py-2 text-sm text-ink-muted hover:text-ink">
                  ยกเลิก
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            {showTop && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-ink">ขายดี</h2>
                <div className="flex flex-wrap gap-2">
                  {topProducts.map((item) => {
                    const icon = item.kind === "device" ? "phone" : iconForCategory(item.category_name);
                    return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAddCatalog(item)}
                      className="ucom-secondary flex max-w-[16rem] items-center gap-2 py-1.5 pl-1.5 pr-4 text-sm"
                    >
                      <span className={`grid size-6 shrink-0 place-items-center rounded-full ${ICON_TONE[icon]}`}>
                        <CategoryIcon name={icon} className="size-3.5" />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </button>
                    );
                  })}
                </div>
              </section>
            )}

            {financeItem && (
              <div data-testid="finance-form" className="flex flex-wrap items-center gap-2 rounded-2xl border border-warning/40 bg-warning/5 p-3">
                <span className="mr-auto text-sm font-medium">ยืนยันผ่อน SF: {financeItem.name}</span>
                <button
                  type="button"
                  onClick={submitFinance}
                  disabled={financing}
                  data-testid="finance-submit"
                  className="ucom-primary px-4 py-2 text-sm disabled:opacity-40"
                >
                  {financing ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button type="button" onClick={cancelFinance} className="ucom-secondary px-4 py-2 text-sm">
                  ยกเลิก
                </button>
                {financeError && (
                  <p data-testid="finance-error" className="basis-full rounded-2xl bg-danger/10 p-2 text-sm text-danger">
                    {financeError}
                  </p>
                )}
              </div>
            )}

            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-ink">{tabs.find((t) => t.value === tab)?.label ?? "รายการสินค้า"}</h2>
                <span className="text-xs text-ink-muted">{total.toLocaleString("th-TH")} รายการ</span>
              </div>
              {catalogError && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger/10 p-3 text-sm text-danger">
                  <span>{catalogError}</span>
                  <button type="button" onClick={onRetry} className="ucom-danger px-4 py-2 text-sm">
                    ลองใหม่
                  </button>
                </div>
              )}
              {isLoading && <p className="text-sm text-ink-muted">กำลังโหลดรายการ...</p>}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {catalog.map((item) => (
                  <CatalogCard
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onAdd={onAddCatalog}
                    onFinance={(row) => {
                      setFinanceItem(row);
                      setFinanceError(null);
                    }}
                  />
                ))}
                {!isLoading && !catalogError && catalog.length === 0 && (
                  <p className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
                    ไม่พบสินค้า
                  </p>
                )}
              </div>
              <PaginationControls
                page={page}
                pageSize={pageSize}
                total={total}
                isLoading={isLoading}
                pageSizeOptions={[24, 48, 96]}
                label="สินค้า"
                testIdPrefix="catalog-pagination"
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
