"use client";

import { useState } from "react";
import { Modal } from "@/app/_components/Modal";
import { createClient } from "@/lib/supabase/client";
import { useBarcodeScanner } from "../pos/useBarcodeScanner";
import { positivePrice, rowMessages, sfRowProblem } from "./sfDuplicates";
import { fmtMoney, todayInBangkok } from "./utils";
import type { SfDueRow, SfOrderDeviceRow, SfOrderPayload } from "./useSfDue";

export type SfIntakePayload = {
  order_no: string;
  ordered_at: string;
  note: string;
  devices: { imei: string; model_name: string; list_price: number; sale_price: number | null }[];
};

export type SfDialogMode = { type: "create" } | { type: "edit"; order: SfDueRow; devices: SfOrderDeviceRow[] };

type Row = { key: number; id: string; imei: string; model: string; list: string; sale: string; locked: boolean };

// React keys only — a module counter is enough (never persisted).
let rowKeySeed = 0;
const blank = (over: Partial<Row> = {}): Row => ({ key: ++rowKeySeed, id: "", imei: "", model: "", list: "", sale: "", locked: false, ...over });

const label = "mb-1.5 block text-sm font-semibold text-foreground";
const input = "ucom-field h-12 w-full px-4 text-base";
const cell = "ucom-field h-11 w-full px-3 text-sm";

// Create + edit share one component. Mounted only while open, so the barcode scanner listens only then.
// Both submit callbacks resolve true on success; on failure the dialog stays open with the draft intact.
export function SfIntakeDialog({ mode, onClose, onCreate, onEdit }: {
  mode: SfDialogMode;
  onClose: () => void;
  onCreate: (payload: SfIntakePayload) => Promise<boolean>;
  onEdit: (payload: SfOrderPayload) => Promise<boolean>;
}) {
  const supabase = createClient();
  const isEdit = mode.type === "edit";

  const [orderNo, setOrderNo] = useState(isEdit ? mode.order.order_no ?? "" : "");
  const [orderedAt, setOrderedAt] = useState(isEdit ? mode.order.ordered_at ?? todayInBangkok() : todayInBangkok());
  const [note, setNote] = useState(isEdit ? mode.order.note ?? "" : "");
  const [rows, setRows] = useState<Row[]>(() =>
    isEdit
      ? mode.devices.map((d) => blank({ id: d.id ?? "", imei: d.imei ?? "", model: d.model_name ?? "", list: String(d.list_price ?? 0), sale: d.sale_price == null ? "" : String(d.sale_price), locked: d.status !== "in_stock" }))
      : [blank()],
  );
  // Existing devices removed in this edit; deleted by the RPC only when the edit is saved.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function removeRow(row: Row) {
    if (row.id) setRemovedIds((prev) => [...prev, row.id]);
    setRows((prev) => prev.filter((x) => x.key !== row.key));
  }

  const patch = (key: number, change: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));

  // A scan fills a still-empty last row, otherwise appends one that copies model + list price from the row above.
  useBarcodeScanner((code) => setRows((prev) => {
    const last = prev[prev.length - 1];
    if (last && !last.locked && !last.imei.trim()) return prev.map((r) => (r.key === last.key ? { ...r, imei: code } : r));
    return [...prev, blank({ imei: code, model: last?.model ?? "", list: last?.list ?? "" })];
  }));

  // Rows are checked as typed so a bad SF tag price never silently becomes 0 (the SQL refuses it too).
  const problems: Record<number, string> = {};
  rows.forEach((r) => { const problem = sfRowProblem(r); if (problem) problems[r.key] = problem; });
  const usable = rows.filter((r) => !r.locked && r.imei.trim() && r.model.trim());
  const credit = usable.reduce((sum, r) => sum + (positivePrice(r.list) ?? 0), 0);
  const canSubmit = orderNo.trim() !== "" && usable.length > 0 && Object.keys(problems).length === 0 && !saving;

  // Best-effort pre-check; the DB unique constraints on imei / order_no remain the real guard.
  async function existingImeis(imeis: string[]) {
    const own = new Set(rows.map((r) => r.id).filter(Boolean));
    const { data } = await supabase.from("v_pos_stock").select("id, code").eq("kind", "device").in("code", imeis);
    return new Set((data ?? []).filter((d) => !own.has(d.id ?? "")).map((d) => d.code ?? ""));
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const imeis = rows.map((r) => (r.locked ? "" : r.imei));
    const found = await existingImeis(imeis.filter((v) => v.trim()).map((v) => v.trim()));
    const found2 = rowMessages(imeis, found);
    let orderTaken = false;
    if (!isEdit || orderNo.trim() !== (mode.order.order_no ?? "")) {
      const { data } = await supabase.from("v_sf_due").select("order_no").eq("order_no", orderNo.trim());
      orderTaken = (data?.length ?? 0) > 0;
    }
    const byKey: Record<number, string> = {};
    rows.forEach((r, i) => { if (found2[i]) byKey[r.key] = found2[i]; });
    setMessages(byKey);
    setOrderMessage(orderTaken ? "เลขที่บิลนี้มีอยู่ในระบบแล้ว" : null);
    if (orderTaken || Object.keys(byKey).length > 0) {
      setSaving(false);
      return;
    }
    const devices = usable.map((r) => ({ imei: r.imei.trim(), model_name: r.model.trim(), list_price: positivePrice(r.list)!, sale_price: r.sale.trim() === "" ? null : positivePrice(r.sale)! }));
    const ok = isEdit
      ? await onEdit({ id: mode.order.sf_order_id!, order_no: orderNo, ordered_at: orderedAt, note, devices: usable.map((r, i) => ({ id: r.id, ...devices[i] })), removed_device_ids: removedIds })
      : await onCreate({ order_no: orderNo, ordered_at: orderedAt, note, devices });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "แก้ไขบิล SF" : "รับเครื่องเข้าจากบิล SF"}
      size="lg"
      footer={<>
        <p data-testid="sf-intake-summary" className="mr-auto text-sm text-muted-foreground tabular-nums">
          {usable.length} เครื่อง · ยอดเครดิต SF <b className="font-bold text-primary">฿{fmtMoney(credit)}</b>
          {removedIds.length > 0 && <span data-testid="sf-removed-summary" className="text-danger"> · จะลบ {removedIds.length} เครื่องเมื่อบันทึก</span>}
        </p>
        <button type="button" onClick={onClose} className="ucom-secondary min-h-12 px-5">ยกเลิก</button>
        <button type="button" onClick={() => void submit()} disabled={!canSubmit} data-testid={isEdit ? "sf-due-edit-submit" : "sf-intake-submit"} className="ucom-primary min-h-12 px-6 disabled:opacity-40">
          {saving ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "บันทึกการรับเครื่อง"}
        </button>
      </>}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={label}>เลขที่บิล SF</span>
          <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} data-testid="sf-order-no" className={input} />
          {orderMessage && <span role="alert" className="mt-1 block text-sm font-semibold text-danger">{orderMessage}</span>}
        </label>
        <label className="block"><span className={label}>วันที่รับ</span><input type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} className={input} /></label>
        <label className="block"><span className={label}>โน้ต</span><input value={note} onChange={(e) => setNote(e.target.value)} className={input} /></label>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold">รายการเครื่อง</h3><span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">ยิงบาร์โค้ดเพื่อเพิ่มแถว</span></div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className="grid gap-2 grid-cols-2 md:grid-cols-[1.3fr_1.3fr_1fr_1fr_2.75rem]">
                {r.locked ? (
                  <>
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">{r.imei}</p>
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">{r.model}</p>
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">{r.list}</p>
                    <p className="col-span-2 px-3 py-2.5 text-xs text-muted-foreground">ล็อก — เครื่องออกจากคลังแล้ว</p>
                  </>
                ) : (
                  <>
                    <input value={r.imei} onChange={(e) => patch(r.key, { imei: e.target.value })} placeholder="IMEI" aria-label="IMEI" data-testid={`sf-device-imei-${i}`} className={cell} />
                    <input value={r.model} onChange={(e) => patch(r.key, { model: e.target.value })} placeholder="รุ่นเครื่อง" aria-label="รุ่นเครื่อง" data-testid={`sf-device-model-${i}`} className={cell} />
                    <input type="number" value={r.list} onChange={(e) => patch(r.key, { list: e.target.value })} placeholder="ราคาป้าย SF" aria-label="ราคาป้าย SF" data-testid={`sf-device-price-${i}`} className={cell} />
                    <input type="number" value={r.sale} onChange={(e) => patch(r.key, { sale: e.target.value })} placeholder="ราคาขาย" aria-label="ราคาขาย" data-testid={`sf-device-sale-price-${i}`} className={cell} />
                    <button type="button" onClick={() => removeRow(r)} disabled={rows.length === 1} aria-label="ลบแถว" data-testid={`sf-device-remove-${i}`} className="ucom-secondary size-11 justify-self-end text-lg disabled:opacity-30">×</button>
                  </>
                )}
              </div>
              {(messages[r.key] ?? problems[r.key]) && <p role="alert" className="mt-1 px-3 text-sm font-semibold text-danger">{messages[r.key] ?? problems[r.key]}</p>}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((prev) => [...prev, blank({ model: prev[prev.length - 1]?.model ?? "", list: prev[prev.length - 1]?.list ?? "" })])} className="ucom-secondary mt-3 min-h-11 border-dashed px-5 text-sm text-primary">+ เพิ่มแถวเครื่อง</button>
      </div>
    </Modal>
  );
}
