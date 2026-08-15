import { useState } from "react";
import type { Category, StockRow } from "./types";
import type { ProductSave, DeviceSave } from "./StockTable";

export function useStockRowEdit({
  row,
  categories,
  cost,
  onSaveProduct,
  onSaveDevice,
  onSaveCost,
}: {
  row: StockRow;
  categories: Category[];
  cost: number | null | undefined;
  onSaveProduct: (input: ProductSave) => Promise<void>;
  onSaveDevice: (input: DeviceSave) => Promise<void>;
  onSaveCost: (kind: string, id: string, cost: number) => Promise<void>;
}) {
  const [name, setName] = useState(row.name ?? "");
  const [code, setCode] = useState(row.code ?? "");
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.name === row.category_name)?.id ?? "",
  );
  const [price, setPrice] = useState(String(row.price ?? 0));
  const [qty, setQty] = useState(String(row.qty ?? 0));
  const [status, setStatus] = useState(row.status ?? "");
  const [costDraft, setCostDraft] = useState(String(cost ?? ""));
  const [saving, setSaving] = useState(false);

  // costById on the page loads asynchronously after the row first mounts (it depends
  // on an auth + profile-role lookup), so the useState above almost always captures
  // "". Sync during render (React's recommended pattern for this, no effect needed)
  // once the real value arrives, instead of leaving the field stuck empty forever.
  const [syncedCost, setSyncedCost] = useState(cost);
  if (cost !== syncedCost) {
    setSyncedCost(cost);
    setCostDraft(String(cost ?? ""));
  }

  const dirty =
    name !== (row.name ?? "") ||
    code !== (row.code ?? "") ||
    price !== String(row.price ?? 0) ||
    qty !== String(row.qty ?? 0) ||
    status !== (row.status ?? "") ||
    (row.kind === "product" &&
      categoryId !== (categories.find((c) => c.name === row.category_name)?.id ?? ""));

  async function save() {
    setSaving(true);
    if (row.kind === "product") {
      await onSaveProduct({
        id: row.id!,
        name,
        sku: code,
        category_id: categoryId,
        price: Number(price) || 0,
        qty: Number(qty) || 0,
        is_active: status === "active",
      });
    } else {
      await onSaveDevice({
        id: row.id!,
        imei: code,
        model_name: name,
        list_price: Number(price) || 0,
        status,
      });
    }
    setSaving(false);
  }

  async function saveCost() {
    if (!row.id || !row.kind) return;
    setSaving(true);
    await onSaveCost(row.kind, row.id, Number(costDraft) || 0);
    setSaving(false);
  }

  return {
    name,
    setName,
    code,
    setCode,
    categoryId,
    setCategoryId,
    price,
    setPrice,
    qty,
    setQty,
    status,
    setStatus,
    costDraft,
    setCostDraft,
    saving,
    dirty,
    save,
    saveCost,
  };
}
