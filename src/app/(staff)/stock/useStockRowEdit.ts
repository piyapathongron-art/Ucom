import { useState } from "react";
import type { Category, DeviceSave, ProductSave, StockKind, StockRow } from "./types";

type Args = {
  kind: StockKind;
  row: StockRow | null; // null = create
  categories: Category[];
  canEditCarrier: boolean;
  cost: number | null | undefined;
  onSaveProduct: (input: ProductSave) => Promise<boolean>;
  onSaveDevice: (input: DeviceSave) => Promise<boolean>;
  onSaveCost: (kind: string, id: string, cost: number) => Promise<boolean>;
};

// Form state for the stock drawer, for both create (row = null) and edit.
export function useStockRowEdit({ kind, row, categories, canEditCarrier, cost, onSaveProduct, onSaveDevice, onSaveCost }: Args) {
  const initialCategory = categories.find((c) => c.name === row?.category_name)?.id ?? "";
  const [name, setName] = useState(row?.name ?? "");
  const [code, setCode] = useState(row?.code ?? "");
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [carrierId, setCarrierId] = useState(row?.carrier_id ?? "");
  const [price, setPrice] = useState(String(row?.price ?? 0));
  const [qty, setQty] = useState(String(row?.qty ?? 0));
  const [status, setStatus] = useState(row?.status ?? (kind === "product" ? "active" : "in_stock"));
  const [costDraft, setCostDraft] = useState(String(cost ?? (row ? "" : 0)));
  const [saving, setSaving] = useState(false);

  const dirty = !row || name !== (row.name ?? "") || code !== (row.code ?? "") || price !== String(row.price ?? 0) ||
    qty !== String(row.qty ?? 0) || status !== (row.status ?? "") || (kind === "product" && (categoryId !== initialCategory || (canEditCarrier && carrierId !== (row.carrier_id ?? ""))));
  const canSubmit = name.trim() !== "" && (kind === "product" || code.trim() !== "");

  async function save() {
    if (saving || !canSubmit) return false;
    setSaving(true);
    const id = row?.id ?? undefined;
    let ok: boolean;
    if (kind === "product") {
      ok = await onSaveProduct({ id, name, sku: code, category_id: categoryId, ...(canEditCarrier ? { carrier_id: carrierId || null } : {}), price: Number(price) || 0, qty: Number(qty) || 0, is_active: status === "active", ...(row ? {} : { cost: Number(costDraft) || 0 }) });
    } else if (row?.acquisition === "sf_credit") {
      // v_pos_stock.price shows coalesce(sale_price, list_price) for an sf_credit device, so this field
      // edits the shop's asking price, not the SF debt (list_price, set once at intake).
      ok = await onSaveDevice({ id, imei: code, model_name: name, sale_price: Number(price) || 0, status });
    } else {
      // sale_price is deliberately not sent: for a purchased device list_price IS the sale price and
      // the catalog views coalesce(sale_price, list_price) — sending 0 would show the device as ฿0.
      ok = await onSaveDevice({ id, imei: code, model_name: name, list_price: Number(price) || 0, status, ...(row ? {} : { cost: Number(costDraft) || 0 }) });
    }
    setSaving(false);
    return ok;
  }

  async function saveCost() {
    if (!row?.id) return false;
    setSaving(true);
    const ok = await onSaveCost(kind, row.id, Number(costDraft) || 0);
    setSaving(false);
    return ok;
  }

  return { name, setName, code, setCode, categoryId, setCategoryId, carrierId, setCarrierId, price, setPrice, qty, setQty, status, setStatus, costDraft, setCostDraft, saving, dirty, canSubmit, save, saveCost };
}
