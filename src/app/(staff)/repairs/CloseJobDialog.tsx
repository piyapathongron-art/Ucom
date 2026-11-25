"use client";

import { useState, useRef, useEffect } from "react";
import { Modal } from "@/app/_components/Modal";
import { REPAIR_STATUS_BADGE, REPAIR_STATUS_LABEL, type RepairRow } from "./types";
import { formatMoney, parseMoney } from "@/lib/cash/money";

export type CloseJobPayload = {
  client_uuid: string;
  payment_method: string;
  receiving_account: string | null;
  note: string | null;
  items: [
    {
      kind: "service";
      name: string;
      unit_price: string;
      qty: 1;
    }
  ];
};

const PAYMENT_METHODS = [["cash", "เงินสด"], ["transfer", "โอน"]] as const;

const payOption = (isActive: boolean) =>
  `h-11 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
    isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
  }`;

function billTotal(unitPrice: string) {
  try { return `฿${formatMoney(parseMoney(unitPrice))}`; } catch { return "-"; }
}

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
  const [error, setError] = useState<string | null>(null);

  const clientUuidRef = useRef<string>("");
  useEffect(() => {
    clientUuidRef.current = crypto.randomUUID();
  }, []);

  async function submit() {
    let price: string;
    try { price = parseMoney(unitPrice); } catch { setError("กรอกราคาตั้งแต่ 0 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง"); return; }
    setError(null);
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
          unit_price: price,
          qty: 1,
        },
      ],
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  const label = "mb-1.5 block text-sm font-semibold";
  const field = "ucom-field h-12 w-full px-4 text-base";
  return (
    <Modal
      open
      onClose={onClose}
      title="ปิดงานและออกบิล"
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary h-12 px-6">ยกเลิก</button>
        <button type="button" onClick={submit} disabled={submitting} data-testid="close-submit" className="ucom-primary h-12 px-6">
          {submitting ? "กำลังบันทึก..." : "ออกบิลและปิดงาน"}
        </button>
      </>}
    >
      <div data-testid="close-dialog" className="space-y-4">
        {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
          <div className="min-w-0">
            <p className="font-semibold">{row.customer_name}</p>
            <p className="text-sm text-muted-foreground">{row.device_desc}{row.symptom ? ` · ${row.symptom}` : ""}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${REPAIR_STATUS_BADGE[row.status]}`}>{REPAIR_STATUS_LABEL[row.status]}</span>
        </div>
        <label className="block">
          <span className={label}>ราคา (บาท)</span>
          <input type="number" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} data-testid="close-unit-price" className="ucom-field h-13 w-full px-4 text-lg font-bold tabular-nums" />
          <span className="mt-1.5 block text-sm text-muted-foreground">ใส่ราคาที่ตกลงไว้ให้แล้ว แก้ได้ถ้าราคาเปลี่ยน</span>
        </label>
        <div>
          <span id="close-payment-label" className={label}>วิธีชำระเงิน</span>
          <div role="radiogroup" aria-labelledby="close-payment-label" data-testid="close-payment-method" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            {PAYMENT_METHODS.map(([value, text]) => (
              <button key={value} type="button" role="radio" aria-checked={paymentMethod === value} onClick={() => setPaymentMethod(value)} className={payOption(paymentMethod === value)}>
                {text}
              </button>
            ))}
          </div>
        </div>
        {paymentMethod === "transfer" && (
          <label className="block">
            <span className={label}>บัญชีที่รับเงิน</span>
            <input value={receivingAccount} onChange={(e) => setReceivingAccount(e.target.value)} data-testid="close-receiving-account" className={field} />
          </label>
        )}
        <label className="block">
          <span className={label}>โน้ต</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} data-testid="close-note" className={field} />
        </label>
        <div className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-3">
          <span className="min-w-0 text-sm text-muted-foreground">บิล: ค่าซ่อม {row.device_desc}</span>
          <span className="shrink-0 text-xl font-bold text-primary tabular-nums">{billTotal(unitPrice)}</span>
        </div>
      </div>
    </Modal>
  );
}
