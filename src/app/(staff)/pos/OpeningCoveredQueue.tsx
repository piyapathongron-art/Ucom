"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { cashWrite } from "@/lib/cash/client";
import type { CashStatus } from "@/lib/cash/types";
import type { Json } from "@/lib/types/database";
import { toThaiError } from "@/lib/errors";
import type { QueuedSale } from "./queue";

export function OpeningCoveredQueue({ queue, status, onCovered, onBusyChange }: { queue: QueuedSale[]; status: CashStatus | null; onCovered: (id: string) => void; onBusyChange: (isBusy: boolean) => void }) {
  const [profiles, setProfiles] = useState<{ id: string; display_name: string }[]>([]);
  const [selected, setSelected] = useState<QueuedSale | null>(null);
  const [originalActor, setOriginalActor] = useState("");
  const [reason, setReason] = useState("");
  const [isAttested, setIsAttested] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canClassify = Boolean(status?.epoch && status.isOwner);
  useEffect(() => {
    if (!canClassify) return;
    createClient().from("profiles").select("id,display_name").in("role", ["owner", "staff"]).order("display_name")
      .then(({ data, error }) => { if (!error) setProfiles(data ?? []); });
  }, [canClassify]);
  const candidates = canClassify ? queue.filter(sale => {
    const payload = sale.payload;
    return sale.lastError && payload && typeof payload === "object" && !Array.isArray(payload) && !("cash_epoch" in payload && payload.cash_epoch === status?.epoch);
  }) : [];

  async function confirm() {
    if (!selected || !originalActor || !reason.trim() || !isAttested) return;
    setIsBusy(true); setError(null); onBusyChange(true);
    try {
      const result = await cashWrite(`covered:${selected.clientUuid}`, "covered_sale", { payload: selected.payload as Json, originalActor, reason: reason.trim() }, async () => ({ error: { code: "P0001", message: "ระบบเงินสดยังไม่เปิดใช้งาน" } }), selected.clientUuid);
      if (result.error) { setError(toThaiError(result.error)); return; }
      onCovered(selected.clientUuid); setSelected(null);
      setReason(""); setOriginalActor(""); setIsAttested(false);
    } finally { setIsBusy(false); onBusyChange(false); }
  }

  if (candidates.length === 0) return null;
  return <section className="border-b border-border px-5 py-3 text-sm" data-testid="cash-opening-covered-queue">
    <p className="font-semibold">เจ้าของต้องจัดประเภทบิลค้างก่อนเปิดระบบ</p>
    <p className="text-xs text-ink-muted">ใช้เฉพาะบิลที่เงินรับรวมอยู่ในยอดตั้งต้นแล้ว บิลที่เป็นเงินรับใหม่ต้องหยุดและให้เจ้าของตรวจสอบแยก</p>
    <ul className="mt-2 space-y-2">{candidates.map(sale => <li key={sale.clientUuid} className="flex flex-wrap items-center gap-3"><span>{sale.clientUuid}</span><button type="button" className="ucom-secondary px-3 py-1" onClick={() => { setSelected(sale); setError(null); }}>จัดเป็นเงินในยอดตั้งต้น</button></li>)}</ul>
    <ConfirmDialog open={Boolean(selected)} title="ยืนยันบิลที่รวมอยู่ในยอดตั้งต้น" confirmLabel="บันทึกบิลโดยไม่เพิ่มเงินสดซ้ำ" isBusy={isBusy} canConfirm={Boolean(originalActor && reason.trim() && isAttested)} onClose={() => { if (!isBusy) setSelected(null); }} onConfirm={() => void confirm()}>
      <p className="text-xs text-ink-muted">บิล {selected?.clientUuid} · เวลารับเงิน {selected ? new Date(selected.queuedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : ""}</p>
      <label className="block text-sm">ผู้รับเงินเดิม<select value={originalActor} onChange={event => setOriginalActor(event.target.value)} className="ucom-field mt-1 w-full px-3 py-2"><option value="">เลือกพนักงานที่รับเงินจริง</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}</select></label>
      <label className="block text-sm">เหตุผล<textarea maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="ucom-field mt-1 w-full px-3 py-2" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={isAttested} onChange={event => setIsAttested(event.target.checked)} />ยืนยันว่าเงินของบิลนี้นับรวมในยอดตั้งต้นแล้ว การบันทึกครั้งนี้จึงไม่เพิ่มเงินสดอีก</label>
      {error && <p role="alert" className="ucom-error">{error}</p>}
    </ConfirmDialog>
  </section>;
}
