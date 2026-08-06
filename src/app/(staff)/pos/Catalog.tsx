"use client";

import { useState } from "react";
import type { CatalogRow, Carrier } from "./types";

export function Catalog({
  catalog,
  topProducts,
  carriers,
  onAddCatalog,
  onAddTopup,
}: {
  catalog: CatalogRow[];
  topProducts: CatalogRow[];
  carriers: Carrier[];
  onAddCatalog: (item: CatalogRow) => void;
  onAddTopup: (carrier: Carrier, amount: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [topupCarrier, setTopupCarrier] = useState<Carrier | null>(null);
  const [topupAmount, setTopupAmount] = useState("");

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

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        {carriers.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTopupCarrier(c)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium"
          >
            เติมเงิน {c.name}
          </button>
        ))}
        {topupCarrier && (
          <div className="flex items-center gap-2 rounded border border-neutral-300 p-1.5">
            <span className="text-sm">{topupCarrier.name}</span>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              placeholder="ยอดเงิน"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTopup()}
              className="w-24 rounded border border-neutral-300 p-1 text-sm"
            />
            <button
              type="button"
              onClick={submitTopup}
              className="rounded bg-neutral-900 px-2 py-1 text-sm text-white"
            >
              เพิ่ม
            </button>
            <button
              type="button"
              onClick={() => setTopupCarrier(null)}
              className="text-sm text-neutral-500"
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
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm"
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
        className="w-full rounded border border-neutral-300 p-2"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {filtered.map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            onClick={() => onAddCatalog(item)}
            className="rounded border border-neutral-200 p-3 text-left"
          >
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-neutral-500">
              {item.code} · {item.price?.toLocaleString()} บาท
              {item.kind === "product" && ` · เหลือ ${item.qty}`}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-neutral-500">
            ไม่พบสินค้า
          </p>
        )}
      </div>
    </div>
  );
}
