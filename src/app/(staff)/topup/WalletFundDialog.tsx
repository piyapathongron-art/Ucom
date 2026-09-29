"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/_components/Modal";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

// Owner-only: money the shop places with a carrier (not a customer sale). Moved here from the expenses page.
export function WalletFundDialog({ wallets, onClose, onSaved }: {
  wallets: Tables<"v_pos_topup_wallet_balance">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [carrier, setCarrier] = useState(wallets.find((w) => w.is_initialized)?.carrier_id ?? wallets[0]?.carrier_id ?? "");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isOpened = wallets.find((w) => w.carrier_id === carrier)?.is_initialized;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!carrier || !Number.isFinite(value) || value <= 0 || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setFormError("กรุณากรอกยอดเติมเงินมากกว่า 0 บาท (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
      return;
    }
    if (!isOpened) {
      setFormError("กรุณาตั้งยอดวอลเล็ตค่ายนี้ก่อนเติมเงิน");
      return;
    }
    setFormError(null);
    setSaving(true);
    const { error } = await supabase.from("topup_wallet_entries").insert({ carrier_id: carrier, amount: value, occurred_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error("บันทึกการเติมเงินไม่สำเร็จ", { duration: Infinity });
      return;
    }
    toast.success("เติมเงินเข้าวอลเล็ตแล้ว");
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="เติมเงินเข้าวอลเล็ต"
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary px-5 py-2.5">ยกเลิก</button>
        <button type="submit" form="wallet-fund-form" data-testid="topup-submit" disabled={saving || !isOpened} className="ucom-primary px-5 py-2.5 disabled:opacity-50">บันทึกเติมเงิน</button>
      </>}
    >
      <form id="wallet-fund-form" onSubmit={(e) => void submit(e)} className="space-y-3">
        <p className="text-xs text-ink-muted">ยอดสะสมและยอดใช้ไปนับเฉพาะหลังตั้งยอดจริงครั้งแรก</p>
        <label className="block space-y-1 text-xs font-semibold text-ink-muted"><span>ผู้ให้บริการ</span>
          <select data-testid="topup-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="ucom-field w-full px-4 py-2.5 text-sm">
            {wallets.map((w) => <option key={w.carrier_id} value={w.carrier_id ?? ""}>{w.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold text-ink-muted"><span>จำนวนเงินเติม (บาท)</span>
          <input type="number" min="0.01" step="any" data-testid="topup-amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="ucom-field w-full px-4 py-2.5 text-sm" placeholder="0.00" />
        </label>
        {!isOpened && <p className="text-sm text-warning">ค่ายนี้ยังไม่ตั้งยอดตั้งต้น</p>}
        {formError && <p role="alert" className="text-sm text-warning">{formError}</p>}
      </form>
    </Modal>
  );
}
