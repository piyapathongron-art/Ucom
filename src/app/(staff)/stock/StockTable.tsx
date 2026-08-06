"use client";

import { useState } from "react";
import type { Category, StockRow } from "./types";

export type ProductSave = {
  id?: string;
  name: string;
  sku: string;
  category_id: string;
  price: number;
  qty: number;
  is_active: boolean;
};

export type DeviceSave = {
  id?: string;
  imei: string;
  model_name: string;
  list_price: number;
  status: string;
};

const deviceStatuses = ["in_stock", "consigned_out", "written_off"];

function Row({
  row,
  categories,
  isOwner,
  cost,
  onSaveProduct,
  onSaveDevice,
  onSaveCost,
}: {
  row: StockRow;
  categories: Category[];
  isOwner: boolean;
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

  if (!row.id || !row.kind) return null;

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

  return (
    <tr className="border-b border-neutral-100" data-testid={`stock-row-${row.kind}-${row.id}`}>
      <td className="p-2 text-sm text-neutral-500">
        {row.kind === "product" ? "สินค้า" : "เครื่อง"}
      </td>
      <td className="p-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid={`stock-name-${row.id}`}
          className="w-full rounded border border-neutral-300 p-1 text-sm"
        />
      </td>
      <td className="p-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={row.kind === "product" ? "SKU" : "IMEI"}
          className="w-32 rounded border border-neutral-300 p-1 text-sm"
        />
      </td>
      <td className="p-2">
        {row.kind === "product" ? (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-neutral-300 p-1 text-sm"
          >
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-neutral-500">{row.acquisition}</span>
        )}
      </td>
      <td className="p-2">
        <input
          type="number"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-24 rounded border border-neutral-300 p-1 text-sm"
        />
      </td>
      <td className="p-2">
        {row.kind === "product" ? (
          <input
            type="number"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-16 rounded border border-neutral-300 p-1 text-sm"
          />
        ) : (
          <span className="text-sm text-neutral-500">1</span>
        )}
      </td>
      <td className="p-2">
        {row.kind === "product" ? (
          <select
            value={status === "active" ? "active" : "inactive"}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-neutral-300 p-1 text-sm"
          >
            <option value="active">ขายอยู่</option>
            <option value="inactive">เลิกขาย</option>
          </select>
        ) : (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!deviceStatuses.includes(row.status ?? "")}
            className="rounded border border-neutral-300 p-1 text-sm disabled:text-neutral-400"
          >
            {!deviceStatuses.includes(row.status ?? "") && (
              <option value={status}>{status}</option>
            )}
            {deviceStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </td>
      {isOwner && (
        <td className="p-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="decimal"
              value={costDraft}
              onChange={(e) => setCostDraft(e.target.value)}
              data-testid={`stock-cost-${row.id}`}
              className="w-20 rounded border border-neutral-300 p-1 text-sm"
            />
            <button
              type="button"
              onClick={saveCost}
              disabled={saving || costDraft === String(cost ?? "")}
              data-testid={`stock-save-cost-${row.id}`}
              className="text-xs text-neutral-500 underline disabled:opacity-30"
            >
              บันทึกทุน
            </button>
          </div>
        </td>
      )}
      <td className="p-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          data-testid={`stock-save-${row.id}`}
          className="rounded bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-30"
        >
          บันทึก
        </button>
      </td>
    </tr>
  );
}

export function StockTable({
  rows,
  categories,
  isOwner,
  costById,
  onSaveProduct,
  onSaveDevice,
  onSaveCost,
}: {
  rows: StockRow[];
  categories: Category[];
  isOwner: boolean;
  costById: Record<string, number | null>;
  onSaveProduct: (input: ProductSave) => Promise<void>;
  onSaveDevice: (input: DeviceSave) => Promise<void>;
  onSaveCost: (kind: string, id: string, cost: number) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm text-neutral-500">
            <th className="p-2">ชนิด</th>
            <th className="p-2">ชื่อ</th>
            <th className="p-2">รหัส</th>
            <th className="p-2">หมวดหมู่/ที่มา</th>
            <th className="p-2">ราคา</th>
            <th className="p-2">จำนวน</th>
            <th className="p-2">สถานะ</th>
            {isOwner && (
              <th className="p-2" data-testid="cost-column-header">
                ต้นทุน
              </th>
            )}
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row
              key={`${row.kind}-${row.id}`}
              row={row}
              categories={categories}
              isOwner={isOwner}
              cost={row.id ? costById[row.id] : undefined}
              onSaveProduct={onSaveProduct}
              onSaveDevice={onSaveDevice}
              onSaveCost={onSaveCost}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
