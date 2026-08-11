"use client";

import { useState } from "react";

export type RepairIntakeSave = {
  customer_name: string;
  customer_phone: string | null;
  device_desc: string;
  symptom: string | null;
  quoted_price: number | null;
  note: string | null;
};

export function IntakeForm({
  onSave,
}: {
  onSave: (input: RepairIntakeSave) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deviceDesc, setDeviceDesc] = useState("");
  const [symptom, setSymptom] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!customerName.trim() || !deviceDesc.trim()) return;
    setSaving(true);
    await onSave({
      customer_name: customerName,
      customer_phone: customerPhone.trim() || null,
      device_desc: deviceDesc,
      symptom: symptom.trim() || null,
      quoted_price: quotedPrice ? Number(quotedPrice) : null,
      note: note.trim() || null,
    });
    setCustomerName("");
    setCustomerPhone("");
    setDeviceDesc("");
    setSymptom("");
    setQuotedPrice("");
    setNote("");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-intake-form"
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
      >
        + รับงานซ่อม
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-neutral-300 p-2">
      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="ชื่อลูกค้า"
        data-testid="intake-customer-name"
        className="w-40 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
        placeholder="เบอร์โทร"
        data-testid="intake-customer-phone"
        className="w-32 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={deviceDesc}
        onChange={(e) => setDeviceDesc(e.target.value)}
        placeholder="เครื่อง/รุ่น"
        data-testid="intake-device-desc"
        className="w-40 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={symptom}
        onChange={(e) => setSymptom(e.target.value)}
        placeholder="อาการ"
        data-testid="intake-symptom"
        className="w-40 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        type="number"
        value={quotedPrice}
        onChange={(e) => setQuotedPrice(e.target.value)}
        placeholder="ราคาที่ตกลง"
        data-testid="intake-quoted-price"
        className="w-24 rounded border border-neutral-300 p-1 text-sm"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต"
        data-testid="intake-note"
        className="flex-1 rounded border border-neutral-300 p-1 text-sm min-w-[120px]"
      />
      <button
        type="button"
        onClick={submit}
        data-testid="intake-submit"
        disabled={!customerName.trim() || !deviceDesc.trim() || saving}
        className="rounded bg-neutral-900 px-2 py-1 text-sm text-white disabled:opacity-40"
      >
        รับงาน
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-neutral-500"
      >
        ยกเลิก
      </button>
    </div>
  );
}
