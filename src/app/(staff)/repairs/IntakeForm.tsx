"use client";

import { useState } from "react";
import { Modal } from "@/app/_components/Modal";

export type RepairIntakeSave = {
  customer_name: string;
  customer_phone: string | null;
  device_desc: string;
  symptom: string | null;
  quoted_price: number | null;
  note: string | null;
};

const EMPTY = { customerName: "", customerPhone: "", deviceDesc: "", symptom: "", quotedPrice: "", note: "" };

function Field({ label, value, onChange, testId, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; testId: string; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-muted">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} className="ucom-field w-full px-4 py-2.5 text-sm" />
    </label>
  );
}

// `onSave` resolves true when the job was created; the dialog stays open (keeping the draft) on failure.
export function IntakeForm({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (input: RepairIntakeSave) => Promise<boolean> }) {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof EMPTY) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const canSubmit = draft.customerName.trim() !== "" && draft.deviceDesc.trim() !== "" && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const ok = await onSave({
      customer_name: draft.customerName,
      customer_phone: draft.customerPhone.trim() || null,
      device_desc: draft.deviceDesc,
      symptom: draft.symptom.trim() || null,
      quoted_price: draft.quotedPrice ? Number(draft.quotedPrice) : null,
      note: draft.note.trim() || null,
    });
    setSaving(false);
    if (ok) {
      setDraft(EMPTY);
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="รับงานซ่อมใหม่"
      size="md"
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="button" onClick={submit} data-testid="intake-submit" disabled={!canSubmit} className="ucom-primary px-5 py-2.5 disabled:opacity-40">รับงาน</button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อลูกค้า" value={draft.customerName} onChange={set("customerName")} testId="intake-customer-name" />
        <Field label="เบอร์โทร" value={draft.customerPhone} onChange={set("customerPhone")} testId="intake-customer-phone" />
        <Field label="เครื่อง/รุ่น" value={draft.deviceDesc} onChange={set("deviceDesc")} testId="intake-device-desc" />
        <Field label="อาการ" value={draft.symptom} onChange={set("symptom")} testId="intake-symptom" />
        <Field label="ราคาที่ตกลง" type="number" value={draft.quotedPrice} onChange={set("quotedPrice")} testId="intake-quoted-price" />
        <Field label="โน้ต" value={draft.note} onChange={set("note")} testId="intake-note" />
      </div>
    </Modal>
  );
}
