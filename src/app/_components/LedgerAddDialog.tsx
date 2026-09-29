"use client";

import { useState } from "react";
import { Modal } from "./Modal";

export type LedgerKind = "expense" | "income";
export type LedgerValues = { name: string; amount: number; method: "cash" | "transfer"; date: string };

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
  const isExpense = kind === "expense";
  const canSubmit = name.trim() !== "" && Number(amount) > 0 && (!withDate || date !== "") && !saving;
  const field = "ucom-field w-full px-4 py-2.5 text-sm";
  const lbl = "block space-y-1 text-xs font-semibold text-ink-muted";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const ok = await onSubmit({ name: name.trim(), amount: Number(amount), method, date });
    setSaving(false);
    if (ok) onClose();
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
          <select data-testid={`${testIdPrefix}-${isExpense ? "paid-from" : "received-to"}`} value={method} onChange={(e) => setMethod(e.target.value as "cash" | "transfer")} className={field}>
            <option value="cash">{LEDGER_METHOD_LABEL[kind].cash}</option>
            <option value="transfer">{LEDGER_METHOD_LABEL[kind].transfer}</option>
          </select>
        </label>
      </form>
    </Modal>
  );
}
