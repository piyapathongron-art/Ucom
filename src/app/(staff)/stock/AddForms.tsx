"use client";

import { useState } from "react";
import type { Category } from "./types";
import type { DeviceSave, ProductSave } from "./StockTable";

export function AddProductForm({
  categories,
  onSave,
}: {
  categories: Category[];
  onSave: (input: ProductSave) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("0");
  const [qty, setQty] = useState("0");

  async function submit() {
    if (!name.trim()) return;
    await onSave({
      name,
      sku,
      category_id: categoryId,
      price: Number(price) || 0,
      qty: Number(qty) || 0,
      is_active: true,
    });
    setName("");
    setSku("");
    setCategoryId("");
    setPrice("0");
    setQty("0");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-add-product"
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
      >
        + เพิ่มสินค้า
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-300 p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อสินค้า"
        data-testid="add-product-name"
        className="rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={sku}
        onChange={(e) => setSku(e.target.value)}
        placeholder="SKU"
        data-testid="add-product-sku"
        className="w-28 rounded border border-neutral-300 p-1 text-sm"
      />
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
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="ราคา"
        data-testid="add-product-price"
        className="w-20 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        type="number"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="จำนวน"
        data-testid="add-product-qty"
        className="w-20 rounded border border-neutral-300 p-1 text-sm"
      />
      <button
        type="button"
        onClick={submit}
        data-testid="add-product-submit"
        className="rounded bg-neutral-900 px-2 py-1 text-sm text-white"
      >
        เพิ่ม
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500">
        ยกเลิก
      </button>
    </div>
  );
}

export function AddDeviceForm({
  onSave,
}: {
  onSave: (input: DeviceSave) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [imei, setImei] = useState("");
  const [modelName, setModelName] = useState("");
  const [listPrice, setListPrice] = useState("0");

  async function submit() {
    if (!imei.trim() || !modelName.trim()) return;
    await onSave({ imei, model_name: modelName, list_price: Number(listPrice) || 0, status: "in_stock" });
    setImei("");
    setModelName("");
    setListPrice("0");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-add-device"
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
      >
        + เพิ่มเครื่อง (ซื้อขาด)
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-300 p-2">
      <input
        value={imei}
        onChange={(e) => setImei(e.target.value)}
        placeholder="IMEI"
        data-testid="add-device-imei"
        className="w-40 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={modelName}
        onChange={(e) => setModelName(e.target.value)}
        placeholder="รุ่นเครื่อง"
        data-testid="add-device-model"
        className="rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        type="number"
        value={listPrice}
        onChange={(e) => setListPrice(e.target.value)}
        placeholder="ราคาป้าย"
        data-testid="add-device-price"
        className="w-24 rounded border border-neutral-300 p-1 text-sm"
      />
      <button
        type="button"
        onClick={submit}
        data-testid="add-device-submit"
        className="rounded bg-neutral-900 px-2 py-1 text-sm text-white"
      >
        เพิ่ม
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-neutral-500">
        ยกเลิก
      </button>
    </div>
  );
}
