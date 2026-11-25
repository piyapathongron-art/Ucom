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
  canFinance,
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
  /** False below lg: SF instalment stays on large screens (ADR 0033 decision 7). */
  canFinance: boolean;
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-0 lg:pr-1">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ขายสินค้า</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">แตะการ์ดเพื่อเพิ่มลงบิล · สแกนบาร์โค้ดได้ทุกหน้า</span>
      </header>

      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
        <label className="flex h-12 items-center gap-2.5 rounded-full bg-muted px-4 focus-within:ring-2 focus-within:ring-primary/40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true" className="size-5 shrink-0 text-muted-foreground">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <span className="sr-only">ค้นหาสินค้าหรือเครื่อง</span>
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นชื่อ รหัส หรือสแกน IMEI"
            data-testid="catalog-search"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
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
                className={`flex h-10 shrink-0 items-center gap-2 rounded-full border pr-4 pl-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <span className={`grid size-7 place-items-center rounded-full ${isActive ? "bg-primary-foreground/15" : ICON_TONE[t.icon]}`}>
                  <CategoryIcon name={t.icon} className="size-4" />
                </span>
                {t.label}
                {t.count != null && <span className={`font-mono text-xs ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{t.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isTopup ? (
        <section className="flex flex-col gap-3" aria-labelledby="pos-topup-heading">
          <h2 id="pos-topup-heading" className="text-base font-semibold text-foreground">เลือกเครือข่ายที่จะเติมเงิน</h2>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {carriers.map((c) => (
              <button
                key={c.id}
                type="button"
                data-testid={`topup-carrier-${c.name}`}
                aria-pressed={topupCarrier?.id === c.id}
                onClick={() => setTopupCarrier(c)}
                className={`flex min-h-16 items-center gap-3 rounded-xl bg-card p-4 text-left shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${topupCarrier?.id === c.id ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/40"}`}
              >
                <span className={`grid size-10 place-items-center rounded-xl ${ICON_TONE.topup}`}><CategoryIcon name="topup" /></span>
                <span className="font-semibold text-foreground">{c.name}</span>
              </button>
            ))}
          </div>
          {topupCarrier && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-4 shadow-card">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">ยอดเติม {topupCarrier.name} (บาท)</span>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitTopup()}
                  data-testid="topup-amount"
                  className="h-11 w-40 rounded-xl border border-input bg-card px-3.5 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                />
              </label>
              <button type="button" onClick={submitTopup} data-testid="topup-add" className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/85">
                เพิ่มลงบิล
              </button>
              <button type="button" onClick={() => setTopupCarrier(null)} className="h-11 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-muted">
                ยกเลิก
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {showTop && (
            <section className="flex flex-col gap-2" aria-labelledby="pos-top-heading">
              <h2 id="pos-top-heading" className="text-base font-semibold text-foreground">ขายดี</h2>
              <div className="flex flex-wrap gap-2">
                {topProducts.map((item) => {
                  const icon = item.kind === "device" ? "phone" : iconForCategory(item.category_name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAddCatalog(item)}
                      className="flex h-11 max-w-64 items-center gap-2 rounded-full border border-border bg-card pr-4 pl-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${ICON_TONE[icon]}`}>
                        <CategoryIcon name={icon} className="size-4" />
                      </span>
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {financeItem && (
            <div data-testid="finance-form" role="dialog" aria-labelledby="finance-title" className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card ring-2 ring-primary">
              <div className="rounded-xl bg-accent p-3 text-sm leading-6 text-foreground">
                <p id="finance-title" className="font-semibold">ยืนยันผ่อน SF: {financeItem.name}</p>
                <p className="text-muted-foreground">เครื่องจะออกจากคลังทันที ไม่ออกบิลขาย ค่าคอมบันทึกที่หน้า SF+ เมื่อได้รับเงิน</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitFinance}
                  disabled={financing}
                  data-testid="finance-submit"
                  className="h-11 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:bg-muted disabled:text-muted-foreground"
                >
                  {financing ? "กำลังบันทึก..." : "บันทึกผ่อน SF"}
                </button>
                <button type="button" onClick={cancelFinance} className="h-11 rounded-full border border-border px-6 text-sm font-semibold text-foreground hover:bg-muted">
                  ยกเลิก
                </button>
              </div>
              {financeError && (
                <p data-testid="finance-error" role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
                  {financeError}
                </p>
              )}
            </div>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="pos-catalog-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="pos-catalog-heading" className="text-base font-semibold text-foreground">{tabs.find((t) => t.value === tab)?.label ?? "รายการสินค้า"}</h2>
              <span className="text-sm text-muted-foreground">{total.toLocaleString("th-TH")} รายการ</span>
            </div>
            {catalogError && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-bg p-3 text-sm text-danger">
                <span>{catalogError}</span>
                <button type="button" onClick={onRetry} className="h-10 rounded-full bg-card px-4 text-sm font-semibold text-danger">
                  ลองใหม่
                </button>
              </div>
            )}
            {isLoading && <p role="status" className="text-sm text-muted-foreground">กำลังโหลดรายการ...</p>}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
              {catalog.map((item) => (
                <CatalogCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onAdd={onAddCatalog}
                  onFinance={canFinance ? (row) => {
                    setFinanceItem(row);
                    setFinanceError(null);
                  } : undefined}
                />
              ))}
              {!isLoading && !catalogError && catalog.length === 0 && (
                <p className="col-span-full rounded-xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
                  ไม่พบสินค้า ลองค้นด้วยคำอื่น หรือเลือกหมวด &quot;ทั้งหมด&quot;
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
  );
}
