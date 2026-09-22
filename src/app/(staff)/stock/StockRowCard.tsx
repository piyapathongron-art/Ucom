import { useState } from "react";
import type { Category, StockRow } from "./types";
import type { ProductSave, DeviceSave } from "./StockTable";
import { useStockRowEdit } from "./useStockRowEdit";
import { QtyStepper } from "./QtyStepper";

const deviceStatuses = ["in_stock", "consigned_out", "written_off"];

export function StockRowCard({
  row,
  categories,
  canEditCost,
  cost,
  onSaveProduct,
  onSaveDevice,
  onSaveCost,
}: {
  row: StockRow;
  categories: Category[];
  canEditCost: boolean;
  cost: number | null | undefined;
  onSaveProduct: (input: ProductSave) => Promise<void>;
  onSaveDevice: (input: DeviceSave) => Promise<void>;
  onSaveCost: (kind: string, id: string, cost: number) => Promise<void>;
}) {
  const {
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
  } = useStockRowEdit({
    row,
    categories,
    cost,
    onSaveProduct,
    onSaveDevice,
    onSaveCost,
  });
  const [open, setOpen] = useState(false);

  if (!row.id || !row.kind) return null;

  return (
    <div className="ucom-surface space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {row.kind === "product" ? "สินค้า" : "เครื่อง"}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="ucom-primary !rounded-full px-3 py-1.5 text-xs disabled:opacity-30"
        >
          บันทึก
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-ink-muted">ชื่อ</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ucom-field w-full px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">รหัส</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={row.kind === "product" ? "SKU" : "IMEI"}
            className="ucom-field w-full px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">ราคา</label>
          <input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="ucom-field w-full px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">จำนวน</label>
          {row.kind === "product" ? (
            <QtyStepper value={qty} onChange={setQty} />
          ) : (
            <div className="mt-1.5 text-sm text-ink-muted">1</div>
          )}
        </div>

        {canEditCost && (
          <div>
            <label className="mb-1 block text-xs text-ink-muted">ต้นทุน</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="decimal"
                value={costDraft}
                onChange={(e) => setCostDraft(e.target.value)}
                className="ucom-field w-full px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={saveCost}
                disabled={saving || costDraft === String(cost ?? "")}
                className="ucom-secondary !rounded-full shrink-0 px-2 py-1 text-xs disabled:opacity-30"
              >
                บันทึกทุน
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`stock-expand-${row.id}`}
        className="flex items-center gap-1 text-xs text-ink-muted"
      >
        {open ? "▾" : "▸"} ประเภท/สถานะ
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-2" data-testid={`stock-detail-${row.id}`}>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">หมวดหมู่/ที่มา</label>
            {row.kind === "product" ? (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="ucom-field w-full px-2 py-1.5 text-sm"
              >
                <option value="">ไม่มีหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id!}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mt-1.5 text-sm text-ink-muted">{row.acquisition}</div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-muted">สถานะ</label>
            {row.kind === "product" ? (
              <select
                value={status === "active" ? "active" : "inactive"}
                onChange={(e) => setStatus(e.target.value)}
                className="ucom-field w-full px-2 py-1.5 text-sm"
              >
                <option value="active">ขายอยู่</option>
                <option value="inactive">เลิกขาย</option>
              </select>
            ) : (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={!deviceStatuses.includes(row.status ?? "")}
                className="ucom-field w-full px-2 py-1.5 text-sm disabled:bg-background disabled:text-ink-muted"
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
          </div>
        </div>
      )}
    </div>
  );
}
