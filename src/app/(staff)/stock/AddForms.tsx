"use client";

import { useState, useId } from "react";
import type { Category } from "./types";
import type { DeviceSave, ProductSave } from "./StockTable";
import { Modal } from "@/app/_components/Modal";

export function AddProductForm({
  categories,
  onSave,
}: {
  categories: Category[];
  onSave: (input: ProductSave) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("0");
  const [qty, setQty] = useState("0");
  const [cost, setCost] = useState("0");

  const nameId = useId();
  const skuId = useId();
  const categoryIdId = useId();
  const priceId = useId();
  const costId = useId();
  const qtyId = useId();

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name,
        sku,
        category_id: categoryId,
        price: Number(price) || 0,
        qty: Number(qty) || 0,
        is_active: true,
        cost: Number(cost) || 0,
      });
      setName("");
      setSku("");
      setCategoryId("");
      setPrice("0");
      setQty("0");
      setCost("0");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-add-product"
        className="ucom-secondary px-3 py-1.5 text-sm"
      >
        + เพิ่มสินค้า
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มสินค้าใหม่"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ucom-secondary px-4 py-2 text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              data-testid="add-product-submit"
              className="ucom-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : "เพิ่มสินค้า"}
            </button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-ink-muted">ชื่อสินค้า</label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อสินค้า"
            data-testid="add-product-name"
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        </div>
        
        <div className="space-y-1.5">
          <label htmlFor={skuId} className="text-sm font-medium text-ink-muted">SKU</label>
          <input
            id={skuId}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
            data-testid="add-product-sku"
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={categoryIdId} className="text-sm font-medium text-ink-muted">หมวดหมู่</label>
          <select
            id={categoryIdId}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="ucom-field w-full px-3 py-2 text-sm"
          >
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label htmlFor={priceId} className="text-sm font-medium text-ink-muted">ราคา</label>
            <input
              id={priceId}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="ราคา"
              data-testid="add-product-price"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={costId} className="text-sm font-medium text-ink-muted">ต้นทุน</label>
            <input
              id={costId}
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="ต้นทุน"
              data-testid="add-product-cost"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={qtyId} className="text-sm font-medium text-ink-muted">จำนวน</label>
            <input
              id={qtyId}
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="จำนวน"
              data-testid="add-product-qty"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

export function AddDeviceForm({
  onSave,
}: {
  onSave: (input: DeviceSave) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [imei, setImei] = useState("");
  const [modelName, setModelName] = useState("");
  const [listPrice, setListPrice] = useState("0");
  const [cost, setCost] = useState("0");

  const imeiId = useId();
  const modelNameId = useId();
  const listPriceId = useId();
  const costId = useId();

  async function submit() {
    if (!imei.trim() || !modelName.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        imei,
        model_name: modelName,
        // sale_price is deliberately not sent: for a purchased device list_price IS the
        // sale price, and the catalog views coalesce(sale_price, list_price) — sending 0
        // here would make the device show as ฿0.
        list_price: Number(listPrice) || 0,
        cost: Number(cost) || 0,
        status: "in_stock"
      });
      setImei("");
      setModelName("");
      setListPrice("0");
      setCost("0");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-add-device"
        className="ucom-secondary px-3 py-1.5 text-sm"
      >
        + เพิ่มเครื่อง (ซื้อขาด)
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เพิ่มเครื่อง (ซื้อขาด)"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ucom-secondary px-4 py-2 text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              data-testid="add-device-submit"
              className="ucom-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : "เพิ่มเครื่อง"}
            </button>
          </>
        }
      >
        <div className="space-y-1.5">
          <label htmlFor={imeiId} className="text-sm font-medium text-ink-muted">IMEI</label>
          <input
            id={imeiId}
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="IMEI"
            data-testid="add-device-imei"
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        </div>
        
        <div className="space-y-1.5">
          <label htmlFor={modelNameId} className="text-sm font-medium text-ink-muted">รุ่นเครื่อง</label>
          <input
            id={modelNameId}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="รุ่นเครื่อง"
            data-testid="add-device-model"
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor={listPriceId} className="text-sm font-medium text-ink-muted">ราคาป้าย</label>
            <input
              id={listPriceId}
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="ราคาป้าย"
              data-testid="add-device-price"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={costId} className="text-sm font-medium text-ink-muted">ต้นทุน</label>
            <input
              id={costId}
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="ต้นทุน"
              data-testid="add-device-cost"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
