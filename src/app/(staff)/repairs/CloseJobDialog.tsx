"use client";

import { useState, useRef, useEffect } from "react";
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

export function CloseJobDialog({
  row,
  onClose,
  onSubmit,
}: {
  row: RepairRow;
  onClose: () => void;
  onSubmit: (payload: CloseJobPayload) => Promise<void>;
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
    await onSubmit({
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
  }

  return (
    <div data-testid="close-dialog" className="mt-2 rounded bg-neutral-50 p-4 border border-neutral-200">
      <div className="mb-4">
        <p className="font-medium">{row.customer_name}</p>
        <p className="text-sm text-neutral-600">{row.device_desc}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-neutral-600 mb-1">ราคา</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            data-testid="close-unit-price"
            className="w-full rounded border border-neutral-300 p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-600 mb-1">วิธีชำระเงิน</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            data-testid="close-payment-method"
            className="w-full rounded border border-neutral-300 p-2 text-sm bg-white"
          >
            <option value="cash">เงินสด</option>
            <option value="transfer">โอน</option>
          </select>
        </div>

        {paymentMethod === "transfer" && (
          <div>
            <label className="block text-sm text-neutral-600 mb-1">บัญชีที่รับเงิน</label>
            <input
              value={receivingAccount}
              onChange={(e) => setReceivingAccount(e.target.value)}
              placeholder="บัญชีที่รับเงิน"
              data-testid="close-receiving-account"
              className="w-full rounded border border-neutral-300 p-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-neutral-600 mb-1">โน้ต</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="โน้ต"
            data-testid="close-note"
            className="w-full rounded border border-neutral-300 p-2 text-sm"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            data-testid="close-submit"
            className="flex-1 rounded bg-neutral-900 p-2 text-white text-sm disabled:opacity-40"
          >
            {submitting ? "กำลังบันทึก..." : "ออกบิลและปิดงาน"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-600"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
