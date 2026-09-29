"use client";

import { useState } from "react";
import { Modal } from "@/app/_components/Modal";
import { actionLabel, fmt, money, type Action, type ActionValues, type CaseRow, type Direction, type OpenValues } from "./consignTypes";

const field = "ucom-field w-full px-4 py-2.5 text-sm";
const lbl = "block space-y-1 text-xs font-semibold text-ink-muted";

// Both dialogs validate locally (message shown inside) and stay open when `onSubmit` resolves false.
export function ConsignOpenDialog({ direction, onClose, onSubmit }: {
  direction: Direction;
  onClose: () => void;
  onSubmit: (values: OpenValues) => Promise<boolean>;
}) {
  const [imei, setImei] = useState("");
  const [modelName, setModelName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [listedPrice, setListedPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isOut = direction === "out";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const price = money(listedPrice);
    if (!imei.trim() || !counterparty.trim() || !Number.isFinite(price) || price < 0 || (!isOut && !modelName.trim())) {
      setFormError("กรุณากรอก IMEI ร้านคู่ค้า รุ่นเครื่อง และราคาตั้งให้ถูกต้อง");
      return;
    }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({ imei: imei.trim(), modelName: modelName.trim(), counterparty: counterparty.trim(), listedPrice: price });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isOut ? "ฝากเครื่องร้านเราออก" : "รับเครื่องร้านอื่นเข้าฝาก"}
      footer={<>
        <button type="button" onClick={onClose} disabled={saving} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="submit" form="consign-open-form" data-testid="consignment-open-submit" disabled={saving} className="ucom-primary px-5 py-2.5 disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : isOut ? "ฝากออก" : "รับฝากเข้า"}
        </button>
      </>}
    >
      <form id="consign-open-form" onSubmit={(e) => void submit(e)} className="space-y-3">
        <p className="text-xs text-ink-muted">ยังไม่กำหนดส่วนแบ่งจนกว่าจะมีการขายจริง</p>
        <label className={lbl}><span>IMEI</span><input className={field} value={imei} onChange={(e) => setImei(e.target.value)} disabled={saving} /></label>
        {!isOut && <label className={lbl}><span>รุ่นเครื่อง</span><input className={field} value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={saving} /></label>}
        <label className={lbl}><span>{isOut ? "ร้านที่รับฝาก" : "เจ้าของเครื่อง"}</span><input className={field} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} disabled={saving} /></label>
        <label className={lbl}><span>ราคาตั้ง</span><input className={field} type="number" min="0" step="0.01" value={listedPrice} onChange={(e) => setListedPrice(e.target.value)} disabled={saving} /></label>
        {formError && <p role="alert" className="text-sm text-warning">{formError}</p>}
      </form>
    </Modal>
  );
}

export function ConsignActionDialog({ row, action, onClose, onSubmit }: {
  row: CaseRow;
  action: Action;
  onClose: () => void;
  onSubmit: (values: ActionValues) => Promise<boolean>;
}) {
  const [salePrice, setSalePrice] = useState(row.listed_price?.toString() ?? "");
  const [partnerShare, setPartnerShare] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsPrice = action === "report" || action === "sell";
  const needsMethod = action === "settle" || action === "sell" || action === "pay";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const price = money(salePrice);
    const share = money(partnerShare);
    if (needsPrice && (!Number.isFinite(price) || price <= 0 || !Number.isFinite(share) || share < 0 || (action === "report" ? share >= price : share > price))) {
      setFormError("กรอกยอดขายและส่วนแบ่งให้ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
      return;
    }
    if ((action === "settle" || action === "sell") && paymentMethod === "transfer" && !receivingAccount.trim()) {
      setFormError("กรุณาระบุบัญชีที่รับเงินโอน");
      return;
    }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({ salePrice: price, partnerShare: share, paymentMethod, receivingAccount: receivingAccount.trim() });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${actionLabel[action]} · ${row.model_name ?? ""}`}
      footer={<>
        <button type="button" onClick={onClose} disabled={saving} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="submit" form="consign-action-form" disabled={saving} className={`${action === "return" ? "rounded-full bg-warning text-[13.5px] font-bold text-on-accent" : "ucom-primary"} px-5 py-2.5 disabled:opacity-50`}>
          {saving ? "กำลังบันทึก..." : actionLabel[action]}
        </button>
      </>}
    >
      <form id="consign-action-form" onSubmit={(e) => void submit(e)} className="space-y-3">
        {action === "return" && <p className="text-sm text-warning">ยืนยันว่าได้รับเครื่องคืนจริง การคืนเครื่องปิดรายการฝากนี้และย้อนสถานะกลับไม่ได้</p>}
        {action === "settle" && <p className="text-sm text-ink">คู่ค้าต้องโอน/ส่งเงินเต็มยอด {fmt(row.receivable_amount)} ในครั้งเดียว</p>}
        {action === "pay" && <p className="text-sm text-ink">ยืนยันจ่ายเจ้าของเครื่อง {fmt(row.partner_share)} แล้ว</p>}
        {needsPrice && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}><span>ราคาที่ขายจริง</span><input className={field} type="number" min="0.01" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label>
            <label className={lbl}><span>{action === "report" ? "ส่วนแบ่งคู่ค้า" : "ยอดที่ต้องจ่ายเจ้าของเครื่อง"}</span><input className={field} type="number" min="0" step="0.01" value={partnerShare} onChange={(e) => setPartnerShare(e.target.value)} /></label>
          </div>
        )}
        {needsMethod && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}><span>ช่องทาง{action === "pay" ? "จ่าย" : "รับ"}เงิน</span>
              <select className={field} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "transfer")}><option value="cash">เงินสด</option><option value="transfer">โอน</option></select>
            </label>
            {action !== "pay" && paymentMethod === "transfer" && <label className={lbl}><span>บัญชีที่รับเงิน</span><input className={field} value={receivingAccount} onChange={(e) => setReceivingAccount(e.target.value)} /></label>}
          </div>
        )}
        {formError && <p role="alert" className="text-sm text-warning">{formError}</p>}
      </form>
    </Modal>
  );
}
