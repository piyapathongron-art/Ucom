"use client";

import { CategoryIcon, ICON_TONE, iconForCategory } from "./CategoryIcon";
import type { CatalogRow } from "./types";

const LOW_STOCK = 3;

function StockBadge({ item }: { item: CatalogRow }) {
  if (item.kind !== "product") return <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-muted">1 เครื่อง</span>;
  const qty = item.qty ?? 0;
  const tone = qty <= 0 ? "bg-danger/15 text-danger" : qty <= LOW_STOCK ? "bg-warning-bg text-warning" : "bg-sunken text-ink-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{qty <= 0 ? "หมด" : `เหลือ ${qty}`}</span>;
}

function CardBody({ item }: { item: CatalogRow }) {
  const icon = item.kind === "device" ? "phone" : iconForCategory(item.category_name);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${ICON_TONE[icon]}`}>
          <CategoryIcon name={icon} />
        </span>
        <StockBadge item={item} />
      </div>
      <div className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-ink">{item.name}</div>
      <div className="truncate text-xs text-ink-faint">{item.code}</div>
      <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-ink">
        ฿{(item.price ?? 0).toLocaleString("th-TH")}
      </div>
    </>
  );
}

export function CatalogCard({ item, onAdd, onFinance }: {
  item: CatalogRow;
  onAdd: (item: CatalogRow) => void;
  onFinance: (item: CatalogRow) => void;
}) {
  if (item.kind === "device" && item.acquisition === "sf_credit") {
    return (
      <div data-testid={`catalog-item-device-${item.id}`} className="ucom-surface flex flex-col rounded-2xl p-3">
        <CardBody item={item} />
        <div className="mt-3 flex gap-2">
          <button type="button" data-testid="sell-cash-device" onClick={() => onAdd(item)} className="ucom-secondary flex-1 px-2 py-2 text-sm">
            ขายสด
          </button>
          <button type="button" data-testid="finance-device" onClick={() => onFinance(item)} className="ucom-primary flex-1 px-2 py-2 text-sm">
            ผ่อน SF
          </button>
        </div>
      </div>
    );
  }

  const isSoldOut = item.kind === "product" && (item.qty ?? 0) <= 0;
  return (
    <button
      type="button"
      data-testid={`catalog-item-${item.kind}-${item.id}`}
      onClick={() => onAdd(item)}
      disabled={isSoldOut}
      className="ucom-surface flex flex-col rounded-2xl border border-transparent p-3 text-left transition-colors hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-transparent"
    >
      <CardBody item={item} />
    </button>
  );
}
