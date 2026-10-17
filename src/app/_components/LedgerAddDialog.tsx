"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { useCashStatus } from "@/lib/cash/useCashStatus";
import { FundSelect } from "@/lib/cash/FundSelect";
import type { CashPaymentFund } from "@/lib/cash/types";
import { parseMoney } from "@/lib/cash/money";

export type LedgerKind = "expense" | "income";
export type LedgerValues = { name: string; amount: number; amountText: string; method: "cash" | "transfer"; fund: CashPaymentFund; date: string; operationId: string };

export const LEDGER_METHOD_LABEL: Record<LedgerKind, Record<string, string>> = {
  expense: { cash: "เงินสดในลิ้นชัก", transfer: "เงินโอน/ส่วนตัว" },
  income: { cash: "เงินสดในลิ้นชัก", transfer: "เงินโอน" },
};

// Shared by the ledger page (withDate) and close-day (no date — always today). `onSubmit` resolves true on success.
export function LedgerAddDialog({ kind, withDate, defaultDate, testIdPrefix, onClose, onSubmit }: {
  kind: LedgerKind;
  withDate: boolean;
  defaultDate: string;
  testIdPrefix: string;
  onClose: () => void;
  onSubmit: (values: LedgerValues) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [fund, setFund] = useState<CashPaymentFund>(kind === "expense" ? "drawer" : "pending");
  const [operationId] = useState(() => crypto.randomUUID());
  const cash = useCashStatus();
  const [formError, setFormError] = useState<string | null>(null);
  const isExpense = kind === "expense";
  const canSubmit = cash.isReady && name.trim() !== "" && Number(amount) > 0 && (!withDate || date !== "") && !saving;
  const field = "ucom-field w-full px-4 py-2.5 text-sm";
  const lbl = "block space-y-1 text-xs font-semibold text-ink-muted";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      const amountText = parseMoney(amount);
      setSaving(true);
      const ok = await onSubmit({ name: name.trim(), amount: Number(amountText), amountText, method: cash.isActive ? (fund === "transfer" ? "transfer" : "cash") : method, fund: cash.isActive ? fund : method === "transfer" ? "transfer" : kind === "expense" ? "drawer" : "pending", date, operationId });
      if (ok) onClose();
    } catch (error) { setFormError(error instanceof Error ? error.message : "จำนวนเงินไม่ถูกต้อง"); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับนอกบิล"}
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="submit" form="ledger-add-form" data-testid={`${testIdPrefix}-submit`} disabled={!canSubmit} className="ucom-primary px-5 py-2.5 disabled:opacity-40">
          {isExpense ? "บันทึกรายจ่าย" : "บันทึกรายรับ"}
        </button>
      </>}
    >
      <form id="ledger-add-form" onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className={lbl}><span>รายการ</span><input required data-testid={`${testIdPrefix}-name`} value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="ชื่อรายการ" /></label>
        <label className={lbl}><span>จำนวนเงิน (บาท)</span><input type="number" required min="0.01" step="any" data-testid={`${testIdPrefix}-amount`} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} placeholder="0.00" /></label>
        {withDate && <label className={lbl}><span>วันที่</span><input type="date" required data-testid={`${testIdPrefix}-date`} value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>}
        <label className={lbl}><span>{isExpense ? "จ่ายจาก" : "รับเข้า"}</span>
          {cash.isActive ? <FundSelect value={fund} onChange={setFund} allowDrawer={isExpense} disabled={saving} testId={`${testIdPrefix}-${isExpense ? "paid-from" : "received-to"}`} /> :
          <select data-testid={`${testIdPrefix}-${isExpense ? "paid-from" : "received-to"}`} value={method} onChange={(e) => setMethod(e.target.value as "cash" | "transfer")} className={field}>
            <option value="cash">{LEDGER_METHOD_LABEL[kind].cash}</option>
            <option value="transfer">{LEDGER_METHOD_LABEL[kind].transfer}</option>
          </select>}
        </label>
        {(cash.error || formError) && <p role="alert" className="text-sm text-danger">{cash.error || formError}</p>}
      </form>
    </Modal>
  );
}
