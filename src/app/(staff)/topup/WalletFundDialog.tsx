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
  const selected = wallets.find((w) => w.carrier_id === carrier);
  const isOpened = selected?.is_initialized;
  const value = Number(amount);
  const balanceAfter = isOpened && amount && Number.isFinite(value) && value > 0 ? (selected?.balance ?? 0) + value : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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

  const label = "mb-1.5 block text-sm font-semibold";
  return (
    <Modal
      open
      onClose={onClose}
      title="เติมเงินเข้าวอลเล็ต"
      footer={<>
        <button type="button" onClick={onClose} className="ucom-secondary h-12 px-6">ยกเลิก</button>
        <button type="submit" form="wallet-fund-form" data-testid="topup-submit" disabled={saving || !isOpened} className="ucom-primary h-12 px-6">{saving ? "กำลังบันทึก..." : "บันทึกเติมเงิน"}</button>
      </>}
    >
      <form id="wallet-fund-form" onSubmit={(e) => void submit(e)} className="space-y-4">
        <p className="text-sm text-muted-foreground">ยอดสะสมและยอดใช้ไปนับเฉพาะหลังตั้งยอดจริงครั้งแรก</p>
        <label className="block"><span className={label}>ผู้ให้บริการ</span>
          <select data-testid="topup-carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="ucom-field h-12 w-full px-4 text-base">
            {wallets.map((w) => <option key={w.carrier_id} value={w.carrier_id ?? ""}>{w.name}</option>)}
          </select>
          {selected && isOpened && <span className="mt-1.5 block text-sm text-muted-foreground tabular-nums">คงเหลือ ฿{(selected.balance ?? 0).toLocaleString("th-TH")}</span>}
        </label>
        <label className="block"><span className={label}>จำนวนเงินเติม (บาท)</span>
          <input type="number" inputMode="decimal" min="0.01" step="any" data-testid="topup-amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="ucom-field h-13 w-full px-4 text-lg font-bold tabular-nums" placeholder="0.00" />
        </label>
        {balanceAfter !== null && (
          <p className="flex justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground">
            <span>ยอดหลังเติม</span>
            <span className="font-bold tabular-nums">฿{balanceAfter.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</span>
          </p>
        )}
        {!isOpened && <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">ค่ายนี้ยังไม่ตั้งยอดตั้งต้น ตั้งยอดในการ์ดวอลเล็ตก่อนเติมเงิน</p>}
        {formError && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{formError}</p>}
      </form>
    </Modal>
  );
}
