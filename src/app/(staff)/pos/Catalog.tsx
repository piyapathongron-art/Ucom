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
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        {carriers.map((c) => (
          <button
            key={c.id}
            type="button"
            data-testid={`topup-carrier-${c.name}`}
            onClick={() => setTopupCarrier(c)}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium"
          >
            เติมเงิน {c.name}
          </button>
        ))}
        {topupCarrier && (
          <div className="flex items-center gap-2 rounded border border-border p-1.5">
            <span className="text-sm">{topupCarrier.name}</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              placeholder="ยอดเงิน"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTopup()}
              data-testid="topup-amount"
              className="w-24 rounded border border-border p-1 text-sm"
            />
            <button
              type="button"
              onClick={submitTopup}
              data-testid="topup-add"
              className="rounded bg-ink px-2 py-1 text-sm text-surface"
            >
              เพิ่ม
            </button>
            <button
              type="button"
              onClick={() => setTopupCarrier(null)}
              className="text-sm text-ink-muted"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>

      {topProducts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topProducts.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAddCatalog(item)}
              className="rounded-full border border-border px-3 py-1 text-sm"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาสินค้า/เครื่อง"
        data-testid="catalog-search"
        className="w-full rounded border border-border p-2"
      />

      {financeItem && (
        <div data-testid="finance-form" className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
          <span className="text-sm">ผ่อน SF: {financeItem.name}</span>
          <button
            type="button"
            onClick={submitFinance}
            disabled={financing}
            data-testid="finance-submit"
            className="rounded bg-ink px-2 py-1 text-sm text-surface disabled:opacity-40"
          >
            {financing ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <button type="button" onClick={cancelFinance} className="text-sm text-ink-muted">
            ยกเลิก
          </button>
          {financeError && (
            <p data-testid="finance-error" className="basis-full rounded bg-danger/10 p-1 text-sm text-danger">
              {financeError}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item) =>
          item.kind === "device" && item.acquisition === "sf_credit" ? (
            <div
              key={`${item.kind}-${item.id}`}
              data-testid={`catalog-item-device-${item.id}`}
              className="rounded border border-border p-3"
            >
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-ink-muted">
                {item.code} · <span className="font-mono tabular-nums">{item.price?.toLocaleString()}</span> บาท
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onAddCatalog(item)}
                  className="rounded border border-border px-2 py-1 text-sm"
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
                  className="rounded bg-ink px-2 py-1 text-sm text-surface"
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
              className="rounded border border-border p-3 text-left"
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
          <p className="col-span-full text-sm text-ink-muted">
            ไม่พบสินค้า
          </p>
        )}
      </div>
    </div>
  );
}
