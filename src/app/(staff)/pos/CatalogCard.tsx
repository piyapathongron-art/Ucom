"use client";

import { CategoryIcon, ICON_TONE, iconForCategory } from "./CategoryIcon";
import type { CatalogRow } from "./types";

const LOW_STOCK = 3;

function StockBadge({ item }: { item: CatalogRow }) {
  if (item.kind !== "product") return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">1 เครื่อง</span>;
  const qty = item.qty ?? 0;
  if (qty <= 0) return <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold text-danger">หมด</span>;
  if (qty <= LOW_STOCK) return <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">เหลือ {qty}</span>;
  return <span className="px-1 py-0.5 text-xs font-semibold text-success">เหลือ {qty}</span>;
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
      <div>
        <div className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-foreground">{item.name}</div>
        <div className="truncate text-xs text-muted-foreground">{item.code}</div>
      </div>
    </>
  );
}

const card = "flex flex-col gap-3 rounded-xl bg-card p-4 text-left shadow-card";
const price = (item: CatalogRow) => <span className="font-mono text-lg font-bold">฿{(item.price ?? 0).toLocaleString("th-TH")}</span>;

// A product or a purchased device is one tap to add. An SF device always asks: ขายสด goes on the
// bill; ผ่อน SF is a contract with SF and only on large screens (ADR 0002, ADR 0033 decision 7).
export function CatalogCard({ item, onAdd, onFinance }: {
  item: CatalogRow;
  onAdd: (item: CatalogRow) => void;
  onFinance?: (item: CatalogRow) => void;
}) {
  if (item.kind === "device" && item.acquisition === "sf_credit") {
    return (
      <div data-testid={`catalog-item-device-${item.id}`} className={card}>
        <CardBody item={item} />
        {price(item)}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-testid="sell-cash-device" onClick={() => onAdd(item)} className="h-11 rounded-full bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            ขายสด
          </button>
          {onFinance ? (
            <button type="button" data-testid="finance-device" onClick={() => onFinance(item)} className="h-11 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              ผ่อน SF
            </button>
          ) : (
            <span className="grid h-11 place-items-center rounded-full bg-muted px-2 text-center text-xs leading-tight text-muted-foreground">ผ่อนบนจอใหญ่</span>
          )}
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
      aria-label={`เพิ่ม ${item.name ?? ""} ลงบิล`}
      className={`${card} group transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:ring-0`}
    >
      <CardBody item={item} />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        {price(item)}
        <span aria-hidden="true" className="grid h-11 place-items-center rounded-full bg-accent px-4 text-sm font-semibold whitespace-nowrap text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground group-disabled:hidden">
          + เพิ่ม
        </span>
      </div>
    </button>
  );
}
