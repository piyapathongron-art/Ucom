"use client";

import { Drawer } from "@/app/_components/Drawer";
import { QtyStepper } from "./QtyStepper";
import { useStockRowEdit } from "./useStockRowEdit";
import { ACQUISITION_LABEL, STATUS_LABEL, type Carrier, type Category, type DeviceSave, type ProductSave, type StockKind, type StockRow } from "./types";

const DEVICE_STATUSES = ["in_stock", "written_off"];
const label = "mb-1 block text-xs font-semibold text-ink-muted";
const input = "ucom-field w-full px-4 py-2.5 text-sm";

type DrawerProps = {
  kind: StockKind;
  row: StockRow | null; // null = create
  categories: Category[];
  carriers: Carrier[];
  canEditCarrier: boolean;
  canEditCost: boolean;
  cost: number | null | undefined;
  onClose: () => void;
  onSaveProduct: (input: ProductSave) => Promise<boolean>;
  onSaveDevice: (input: DeviceSave) => Promise<boolean>;
  onSaveCost: (kind: string, id: string, cost: number) => Promise<boolean>;
};

// One right drawer for add + edit. Mounted per open (parent keys it) so form state always starts fresh.
export function StockDrawer(props: DrawerProps) {
  const { kind, row, categories, carriers, canEditCarrier, canEditCost, onClose } = props;
  const f = useStockRowEdit(props);
  const isProduct = kind === "product";
  const isConsignedIn = row?.acquisition === "consigned_in";
  const showCost = canEditCost && !isConsignedIn;
  const statusLocked = !isProduct && (isConsignedIn || (row != null && !DEVICE_STATUSES.includes(row.status ?? "")));
  const statusOptions = isProduct ? ["active", "inactive"] : DEVICE_STATUSES.includes(f.status) ? DEVICE_STATUSES : [f.status, ...DEVICE_STATUSES];

  async function submit() {
    if (await f.save()) onClose();
  }

  const title = row ? (isProduct ? "แก้ไขสินค้า" : "แก้ไขเครื่อง") : isProduct ? "เพิ่มสินค้าใหม่" : "เพิ่มเครื่อง (ซื้อขาด)";
  const id = row?.id ?? "new";

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button
          type="button"
          onClick={submit}
          disabled={!f.dirty || !f.canSubmit || f.saving}
          data-testid={row ? `stock-save-${id}` : isProduct ? "add-product-submit" : "add-device-submit"}
          className="ucom-primary px-5 py-2.5 disabled:opacity-40"
        >
          {f.saving ? "กำลังบันทึก…" : row ? "บันทึก" : isProduct ? "เพิ่มสินค้า" : "เพิ่มเครื่อง"}
        </button>
      </>}
    >
      <label className="block">
        <span className={label}>{isProduct ? "ชื่อสินค้า" : "รุ่นเครื่อง"}</span>
        <input value={f.name} onChange={(e) => f.setName(e.target.value)} data-testid={row ? `stock-name-input-${id}` : isProduct ? "add-product-name" : "add-device-model"} className={input} />
      </label>
      <label className="block">
        <span className={label}>{isProduct ? "SKU" : "IMEI"}</span>
        <input value={f.code} onChange={(e) => f.setCode(e.target.value)} data-testid={row ? undefined : isProduct ? "add-product-sku" : "add-device-imei"} className={input} />
      </label>
      {isProduct ? (
        <label className="block">
          <span className={label}>หมวดหมู่</span>
          <select value={f.categoryId} onChange={(e) => f.setCategoryId(e.target.value)} className={input}>
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => <option key={c.id} value={c.id!}>{c.name}</option>)}
          </select>
        </label>
      ) : row && (
        <p className="text-sm text-ink-muted">ที่มา: {ACQUISITION_LABEL[row.acquisition ?? ""] ?? row.acquisition}</p>
      )}
      {isProduct && canEditCarrier && (
        <label className="block">
          <span className={label}>ค่ายซิม</span>
          <select value={f.carrierId} onChange={(e) => f.setCarrierId(e.target.value)} data-testid="stock-sim-carrier" className={input}>
            <option value="">ไม่ระบุค่าย</option>
            {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className={label}>{isProduct ? "ราคาขาย" : row?.acquisition === "sf_credit" ? "ราคาขายหน้าร้าน" : "ราคาป้าย"}</span>
        <input type="number" inputMode="decimal" value={f.price} onChange={(e) => f.setPrice(e.target.value)} data-testid={row ? undefined : isProduct ? "add-product-price" : "add-device-price"} className={input} />
      </label>
      {isProduct && (
        <div>
          <span className={label}>คงเหลือ</span>
          {row
            ? <QtyStepper value={f.qty} onChange={f.setQty} testId={`stock-qty-${id}`} />
            : <input type="number" value={f.qty} onChange={(e) => f.setQty(e.target.value)} data-testid="add-product-qty" className={input} />}
        </div>
      )}
      {showCost && (
        <div>
          <span className={label}>ต้นทุน</span>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" value={f.costDraft} onChange={(e) => f.setCostDraft(e.target.value)} data-testid={row ? `stock-cost-${id}` : isProduct ? "add-product-cost" : "add-device-cost"} className={input} />
            {row && (
              <button type="button" onClick={f.saveCost} disabled={f.saving || f.costDraft === String(props.cost ?? "")} data-testid={`stock-save-cost-${id}`} className="ucom-secondary shrink-0 px-4 py-2.5 disabled:opacity-30">
                บันทึกทุน
              </button>
            )}
          </div>
        </div>
      )}
      {row && (
        <label className="block">
          <span className={label}>สถานะ</span>
          <select value={f.status} onChange={(e) => f.setStatus(e.target.value)} disabled={statusLocked} className={`${input} disabled:text-ink-muted`}>
            {statusOptions.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
          </select>
        </label>
      )}
      {!row && !isProduct && <p className="ucom-info">เครื่องใหม่จะมีสถานะ “อยู่ในคลัง” เสมอ</p>}
    </Drawer>
  );
}
