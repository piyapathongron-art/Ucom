"use client";

import { useState } from "react";
import type { SfDue } from "./types";

type DraftDevice = { imei: string; model_name: string; list_price: string; sale_price: string };

export type SfIntakePayload = {
  order_no: string;
  ordered_at: string;
  note: string;
  devices: { imei: string; model_name: string; list_price: number; sale_price: number | null }[];
};

export function SfIntake({
  dueList,
  onSubmit,
}: {
  dueList: SfDue[];
  onSubmit: (input: SfIntakePayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [orderedAt, setOrderedAt] = useState("");
  const [note, setNote] = useState("");
  const [devices, setDevices] = useState<DraftDevice[]>([
    { imei: "", model_name: "", list_price: "0", sale_price: "" },
  ]);

  function updateDevice(i: number, patch: Partial<DraftDevice>) {
    setDevices((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function submit() {
    const validDevices = devices.filter((d) => d.imei.trim() && d.model_name.trim());
    if (!orderNo.trim() || validDevices.length === 0) return;

    await onSubmit({
      order_no: orderNo,
      ordered_at: orderedAt,
      note,
      devices: validDevices.map((d) => ({
        imei: d.imei,
        model_name: d.model_name,
        list_price: Number(d.list_price) || 0,
        sale_price: d.sale_price.trim() === "" ? null : Number(d.sale_price) || 0,
      })),
    });

    setOrderNo("");
    setOrderedAt("");
    setNote("");
    setDevices([{ imei: "", model_name: "", list_price: "0", sale_price: "" }]);
    setOpen(false);
  }

  return (
    <section className="ucom-surface space-y-4 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[0.68rem] tracking-[0.16em] text-ink-muted">SF+ / RECEIVING</p>
          <h2 className="mt-1 font-semibold">รับเครื่องเข้าจากบิล SF</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-testid="open-sf-intake"
          className="ucom-secondary px-3 py-1.5 text-sm"
        >
          {open ? "ปิด" : "+ รับบิลใหม่"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="ucom-toolbar rounded-md border-dashed">
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="เลขที่บิล SF"
              data-testid="sf-order-no"
              className="ucom-field px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={orderedAt}
              onChange={(e) => setOrderedAt(e.target.value)}
              className="ucom-field px-2 py-1.5 text-sm"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="โน้ต"
              className="ucom-field min-w-40 flex-1 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-2">
            {devices.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border bg-background p-2 md:grid-cols-[1.1fr_1fr_9rem_9rem]">
                <input
                  value={d.imei}
                  onChange={(e) => updateDevice(i, { imei: e.target.value })}
                  placeholder="IMEI"
                  data-testid={`sf-device-imei-${i}`}
                  className="ucom-field w-full px-2 py-1.5 text-sm"
                />
                <input
                  value={d.model_name}
                  onChange={(e) => updateDevice(i, { model_name: e.target.value })}
                  placeholder="รุ่นเครื่อง"
                  data-testid={`sf-device-model-${i}`}
                  className="ucom-field w-full px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={d.list_price}
                  onChange={(e) => updateDevice(i, { list_price: e.target.value })}
                  placeholder="ราคาป้าย SF"
                  data-testid={`sf-device-price-${i}`}
                  className="ucom-field w-full px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={d.sale_price}
                  onChange={(e) => updateDevice(i, { sale_price: e.target.value })}
                  placeholder="ราคาขาย"
                  data-testid={`sf-device-sale-price-${i}`}
                  className="ucom-field w-full px-2 py-1.5 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDevices((prev) => [
                  ...prev,
                  { imei: "", model_name: "", list_price: "0", sale_price: "" },
                ])
              }
              className="ucom-secondary px-3 py-1.5 text-sm"
            >
              + เพิ่มแถวเครื่อง
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            data-testid="sf-intake-submit"
            className="ucom-primary px-3 py-2 text-sm"
          >
            บันทึกการรับเครื่อง
          </button>
        </div>
      )}

      {dueList.filter((o) => (o.unfinanced_count ?? 0) > 0).length > 0 && (
        <div className="border-t border-border pt-3" data-testid="sf-due-list">
          <h3 className="text-sm font-medium text-warning">บิล SF ที่ยังมีเครื่องค้าง</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {dueList
              .filter((o) => (o.unfinanced_count ?? 0) > 0)
              .map((o) => (
                <li key={o.sf_order_id}>
                  {o.order_no} · เหลือ {o.unfinanced_count} เครื่อง
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
