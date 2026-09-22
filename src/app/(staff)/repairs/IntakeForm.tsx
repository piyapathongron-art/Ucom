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
        className="ucom-secondary !rounded-full px-3 py-1.5 text-sm"
      >
        + รับงานซ่อม
      </button>
    );
  }

  return (
    <section className="ucom-surface space-y-3 p-4">
      <div>
        <p className="font-mono text-[0.68rem] tracking-[0.16em] text-ink-muted">SERVICE / INTAKE</p>
        <h2 className="mt-1 font-semibold">รับงานซ่อมใหม่</h2>
      </div>
      <div className="ucom-toolbar rounded-md border-dashed">
      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="ชื่อลูกค้า"
        data-testid="intake-customer-name"
        className="ucom-field w-40 px-2 py-1.5 text-sm"
      />
      <input
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
        placeholder="เบอร์โทร"
        data-testid="intake-customer-phone"
        className="ucom-field w-32 px-2 py-1.5 text-sm"
      />
      <input
        value={deviceDesc}
        onChange={(e) => setDeviceDesc(e.target.value)}
        placeholder="เครื่อง/รุ่น"
        data-testid="intake-device-desc"
        className="ucom-field w-40 px-2 py-1.5 text-sm"
      />
      <input
        value={symptom}
        onChange={(e) => setSymptom(e.target.value)}
        placeholder="อาการ"
        data-testid="intake-symptom"
        className="ucom-field w-40 px-2 py-1.5 text-sm"
      />
      <input
        type="number"
        value={quotedPrice}
        onChange={(e) => setQuotedPrice(e.target.value)}
        placeholder="ราคาที่ตกลง"
        data-testid="intake-quoted-price"
        className="ucom-field w-24 px-2 py-1.5 text-sm"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต"
        data-testid="intake-note"
        className="ucom-field min-w-[120px] flex-1 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={submit}
        data-testid="intake-submit"
        disabled={!customerName.trim() || !deviceDesc.trim() || saving}
        className="ucom-primary !rounded-full px-3 py-1.5 text-sm disabled:opacity-40"
      >
        รับงาน
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="ucom-secondary !rounded-full px-3 py-1.5 text-sm"
      >
        ยกเลิก
      </button>
      </div>
    </section>
  );
}
