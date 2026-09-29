"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/app/_components/Modal";
import type { RepairRow } from "./types";

export type CloseJobPayload = {
  client_uuid: string;
  payment_method: string;
  receiving_account: string | null;
  note: string | null;
  items: [
    {
      kind: "service";
      name: string;
      unit_price: number;
      qty: 1;
    }
  ];
};

// `onSubmit` resolves true when the bill was issued; on failure the dialog stays open for a retry
// (same client_uuid, so a retry after a lost response cannot double-bill).
export function CloseJobDialog({
  row,
  onClose,
  onSubmit,
}: {
  row: RepairRow;
  onClose: () => void;
  onSubmit: (payload: CloseJobPayload) => Promise<boolean>;
}) {
  const [unitPrice, setUnitPrice] = useState(String(row.quoted_price ?? 0));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clientUuidRef = useRef<string>("");
  useEffect(() => {
    clientUuidRef.current = crypto.randomUUID();
  }, []);

  async function submit() {
    setSubmitting(true);
    const ok = await onSubmit({
      client_uuid: clientUuidRef.current,
      payment_method: paymentMethod,
      receiving_account: paymentMethod === "transfer" ? receivingAccount : null,
      note: note.trim() || null,
      items: [
        {
          kind: "service",
          name: `ค่าซ่อม ${row.device_desc}`,
          unit_price: Number(unitPrice) || 0,
          qty: 1,
        },
      ],
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  const label = "mb-1 block text-xs font-semibold text-ink-muted";
  return (
    <Modal
      open
      onClose={onClose}
      title="ปิดงานและออกบิล"
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="button" onClick={submit} disabled={submitting} data-testid="close-submit" className="ucom-primary px-5 py-2.5 disabled:opacity-40">
          {submitting ? "กำลังบันทึก..." : "ออกบิลและปิดงาน"}
        </button>
      </>}
    >
      <div data-testid="close-dialog" className="space-y-3">
        <div>
          <p className="text-sm font-bold text-ink">{row.customer_name}</p>
          <p className="text-xs text-ink-muted">{row.device_desc}</p>
        </div>
        <label className="block">
          <span className={label}>ราคา</span>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} data-testid="close-unit-price" className="ucom-field w-full px-4 py-2.5 text-sm" />
        </label>
        <label className="block">
          <span className={label}>วิธีชำระเงิน</span>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} data-testid="close-payment-method" className="ucom-field w-full px-4 py-2.5 text-sm">
            <option value="cash">เงินสด</option>
            <option value="transfer">โอน</option>
          </select>
        </label>
        {paymentMethod === "transfer" && (
          <label className="block">
            <span className={label}>บัญชีที่รับเงิน</span>
            <input value={receivingAccount} onChange={(e) => setReceivingAccount(e.target.value)} data-testid="close-receiving-account" className="ucom-field w-full px-4 py-2.5 text-sm" />
          </label>
        )}
        <label className="block">
          <span className={label}>โน้ต</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} data-testid="close-note" className="ucom-field w-full px-4 py-2.5 text-sm" />
        </label>
      </div>
    </Modal>
  );
}
