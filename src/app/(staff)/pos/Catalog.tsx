"use client";

import { useState } from "react";
import type { CatalogRow, Carrier } from "./types";

export function Catalog({
  catalog,
  topProducts,
  carriers,
  onAddCatalog,
  onAddTopup,
  onFinanceDevice,
}: {
  catalog: CatalogRow[];
  topProducts: CatalogRow[];
  carriers: Carrier[];
  onAddCatalog: (item: CatalogRow) => void;
  onAddTopup: (carrier: Carrier, amount: number) => void;
  onFinanceDevice: (item: CatalogRow) => Promise<string | null>;
}) {
  const [search, setSearch] = useState("");
  const [topupCarrier, setTopupCarrier] = useState<Carrier | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [financeItem, setFinanceItem] = useState<CatalogRow | null>(null);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [financing, setFinancing] = useState(false);

  const filtered = search.trim()
    ? catalog.filter((item) =>
        `${item.name} ${item.code ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : catalog;

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

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-background p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-muted">Counter / catalog</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink">ขายหน้าร้าน</h1>
        </div>
        <span className="text-xs text-ink-muted">เลือกสินค้าเพื่อเพิ่มเข้าบิล</span>
      </div>

      <div className="ucom-toolbar">
        {carriers.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid={`topup-carrier-${c.name}`}
            onClick={() => setTopupCarrier(c)}
            className="ucom-secondary px-3 py-2 text-sm"
          >
            เติมเงิน {c.name}
          </button>
        ))}
        {topupCarrier && (
          <div className="flex flex-wrap items-center gap-2 border-l border-border pl-3">
            <span className="text-sm font-medium">เติม {topupCarrier.name}</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              placeholder="ยอดเงิน"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTopup()}
              data-testid="topup-amount"
              className="ucom-field w-28 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={submitTopup}
              data-testid="topup-add"
              className="ucom-primary px-3 py-1.5 text-sm"
            >
              เพิ่ม
            </button>
            <button
              type="button"
              onClick={() => setTopupCarrier(null)}
              className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>

      {topProducts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">สินค้าขายดี</h2>
            <span className="text-xs text-ink-muted">เพิ่มด้วยคลิกเดียว</span>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {topProducts.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAddCatalog(item)}
              className="ucom-secondary truncate px-3 py-2 text-left text-sm"
            >
              {item.name}
            </button>
          ))}
          </div>
        </section>
      )}

      <label className="relative block">
        <span className="sr-only">ค้นหาสินค้า/เครื่อง</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า / SKU / IMEI"
          data-testid="catalog-search"
          className="ucom-field w-full px-3 py-2.5 pr-10 text-sm"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 text-ink-muted">⌕</span>
      </label>

      {financeItem && (
        <div data-testid="finance-form" className="flex flex-wrap items-center gap-2 rounded border border-warning/40 bg-warning/5 p-3">
          <span className="mr-auto text-sm font-medium">ยืนยันผ่อน SF: {financeItem.name}</span>
          <button
            type="button"
            onClick={submitFinance}
            disabled={financing}
            data-testid="finance-submit"
            className="ucom-primary px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {financing ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <button type="button" onClick={cancelFinance} className="ucom-secondary px-3 py-1.5 text-sm">
            ยกเลิก
          </button>
          {financeError && (
            <p data-testid="finance-error" className="basis-full rounded border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
              {financeError}
            </p>
          )}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">รายการสินค้า</h2>
          <span className="text-xs text-ink-muted">{filtered.length} รายการ</span>
        </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item) =>
          item.kind === "device" && item.acquisition === "sf_credit" ? (
            <div
              key={`${item.kind}-${item.id}`}
              data-testid={`catalog-item-device-${item.id}`}
              className="ucom-surface flex flex-col p-3"
            >
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-ink-muted">
                {item.code} · <span className="font-mono tabular-nums">{item.price?.toLocaleString()}</span> บาท
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  data-testid="sell-cash-device"
                  onClick={() => onAddCatalog(item)}
                  className="ucom-secondary flex-1 px-2 py-1.5 text-sm"
                >
                  ขายสด
                </button>
                <button
                  type="button"
                  data-testid="finance-device"
                  onClick={() => {
                    setFinanceItem(item);
                    setFinanceError(null);
                  }}
                  className="ucom-primary flex-1 px-2 py-1.5 text-sm"
                >
                  ผ่อน SF
                </button>
              </div>
            </div>
          ) : (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              data-testid={`catalog-item-${item.kind}-${item.id}`}
              onClick={() => onAddCatalog(item)}
              className="ucom-surface p-3 text-left transition-colors hover:border-ink"
            >
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-ink-muted">
                {item.code} · <span className="font-mono tabular-nums">{item.price?.toLocaleString()}</span> บาท
                {item.kind === "product" && ` · เหลือ ${item.qty}`}
              </div>
            </button>
          ),
        )}
        {filtered.length === 0 && (
          <p className="col-span-full rounded border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            ไม่พบสินค้า
          </p>
        )}
      </div>
      </section>
    </div>
  );
}
