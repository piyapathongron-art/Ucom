"use client";

import { useState } from "react";
import { Modal } from "@/app/_components/Modal";
import { actionLabel, fmt, money, type Action, type ActionValues, type CaseRow, type Direction, type OpenValues } from "./consignTypes";
import { useCashStatus } from "@/lib/cash/useCashStatus";
import { FundSelect } from "@/lib/cash/FundSelect";
import { parseMoney } from "@/lib/cash/money";
import type { CashPaymentFund } from "@/lib/cash/types";

// ADR 0033 form fields: 48px, labelled (e2e finds them by label text), 14px semibold labels.
const field = "ucom-field h-12 w-full px-4 text-base";
const moneyField = `${field} font-semibold tabular-nums`;
const lbl = "flex flex-col gap-1.5 text-sm font-semibold text-foreground";
const errorText = "rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger";

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent px-4 py-3">
      <span className="font-semibold text-accent-foreground">{label}</span>
      <span className="text-xl font-bold tabular-nums text-primary">{value}</span>
    </div>
  );
}

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
        <button type="button" onClick={onClose} disabled={saving} className="ucom-secondary min-h-12 px-5">ยกเลิก</button>
        <button type="submit" form="consign-open-form" data-testid="consignment-open-submit" disabled={saving} className="ucom-primary min-h-12 px-6 disabled:opacity-50">
          {saving ? "กำลังบันทึก..." : isOut ? "ฝากออก" : "รับฝากเข้า"}
        </button>
      </>}
    >
      <form id="consign-open-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <p className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">ยังไม่กำหนดส่วนแบ่งจนกว่าจะมีการขายจริง</p>
        <label className={lbl}><span>IMEI</span><input className={`${field} tabular-nums`} inputMode="numeric" autoComplete="off" value={imei} onChange={(e) => setImei(e.target.value)} disabled={saving} /></label>
        {!isOut && <label className={lbl}><span>รุ่นเครื่อง</span><input className={field} value={modelName} onChange={(e) => setModelName(e.target.value)} disabled={saving} /></label>}
        <label className={lbl}><span>{isOut ? "ร้านที่รับฝาก" : "เจ้าของเครื่อง"}</span><input className={field} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} disabled={saving} /></label>
        <label className={lbl}><span>ราคาตั้ง (บาท)</span><input className={moneyField} type="number" min="0" step="0.01" inputMode="decimal" value={listedPrice} onChange={(e) => setListedPrice(e.target.value)} disabled={saving} /></label>
        {isOut && <p className="text-sm text-muted-foreground">ฝากออกได้เฉพาะเครื่องซื้อขาดที่อยู่ในคลังและมีต้นทุน</p>}
        {formError && <p role="alert" className={errorText}>{formError}</p>}
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
  const [fund, setFund] = useState<CashPaymentFund>("drawer");
  const [operationId] = useState(() => crypto.randomUUID());
  const cash = useCashStatus();
  const [receivingAccount, setReceivingAccount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const needsPrice = action === "report" || action === "sell";
  const needsMethod = action === "settle" || action === "sell" || action === "pay";
  // Live preview of what the shop keeps (price − share); shown only when both numbers parse.
  const previewPrice = money(salePrice);
  const previewShare = money(partnerShare);
  const preview = Number.isFinite(previewPrice) && Number.isFinite(previewShare) && previewShare <= previewPrice ? previewPrice - previewShare : null;

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
    const ok = await onSubmit({ salePrice: price, partnerShare: share, amountText: needsPrice ? parseMoney(salePrice) : "0.00", shareText: needsPrice ? parseMoney(partnerShare) : "0.00", fund: cash.isActive ? fund : paymentMethod === "cash" ? "drawer" : "transfer", operationId, paymentMethod: action === "pay" && cash.isActive ? fund === "transfer" ? "transfer" : "cash" : paymentMethod, receivingAccount: receivingAccount.trim() });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${actionLabel[action]} · ${row.model_name ?? ""}`}
      footer={<>
        <button type="button" onClick={onClose} disabled={saving} className="ucom-secondary min-h-12 px-5">ยกเลิก</button>
        <button type="submit" form="consign-action-form" disabled={saving || (needsMethod && !cash.isReady)} className={`${action === "return" ? "inline-flex items-center justify-center rounded-full bg-warning text-sm font-bold text-on-accent" : "ucom-primary"} min-h-12 px-6 disabled:opacity-50`}>
          {saving ? "กำลังบันทึก..." : actionLabel[action]}
        </button>
      </>}
    >
      <form id="consign-action-form" onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
          <span>{row.counterparty_name} · ราคาตั้ง</span>
          <span className="font-bold tabular-nums">{fmt(row.listed_price)}</span>
        </div>
        {action === "return" && <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">ยืนยันว่าได้รับเครื่องคืนจริง การคืนเครื่องปิดรายการฝากนี้และย้อนสถานะกลับไม่ได้</p>}
        {action === "settle" && <Total label="คู่ค้าต้องโอน/ส่งเงินเต็มยอดในครั้งเดียว" value={fmt(row.receivable_amount)} />}
        {action === "pay" && <Total label="ยืนยันจ่ายเจ้าของเครื่อง" value={fmt(row.partner_share)} />}
        {needsPrice && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}><span>ราคาที่ขายจริง</span><input className={moneyField} type="number" min="0.01" step="0.01" inputMode="decimal" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label>
            <label className={lbl}><span>{action === "report" ? "ส่วนแบ่งคู่ค้า" : "ยอดที่ต้องจ่ายเจ้าของเครื่อง"}</span><input className={moneyField} type="number" min="0" step="0.01" inputMode="decimal" value={partnerShare} onChange={(e) => setPartnerShare(e.target.value)} /></label>
          </div>
        )}
        {needsPrice && preview !== null && <Total label={action === "report" ? "ร้านจะได้รับเต็มยอด" : "ร้านได้หลังจ่ายเจ้าของ"} value={fmt(preview)} />}
        {action === "report" && <p className="text-sm text-muted-foreground">ขั้นถัดไป: กด “รับเงิน” เมื่อคู่ค้าโอนหรือส่งเงินเต็มยอดในครั้งเดียว ส่วนแบ่งต้องน้อยกว่าราคาขาย</p>}
        {needsMethod && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={lbl}><span>ช่องทาง{action === "pay" ? "จ่าย" : "รับ"}เงิน</span>
              {action === "pay" && cash.isActive ? <FundSelect value={fund} onChange={setFund} /> : <select className={field} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as "cash" | "transfer")}><option value="cash">เงินสด</option><option value="transfer">โอน</option></select>}
            </label>
            {action !== "pay" && paymentMethod === "transfer" && <label className={lbl}><span>บัญชีที่รับเงิน</span><input className={field} value={receivingAccount} onChange={(e) => setReceivingAccount(e.target.value)} /></label>}
          </div>
        )}
        {formError && <p role="alert" className={errorText}>{formError}</p>}
        {needsMethod && cash.error && <p role="alert" className={errorText}>{cash.error}</p>}
      </form>
    </Modal>
  );
}
