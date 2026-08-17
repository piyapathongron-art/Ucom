"use client";

import { useState, useId } from "react";
import { Modal } from "@/app/_components/Modal";

type DraftDevice = { imei: string; model_name: string; list_price: string; sale_price: string };

export type SfIntakePayload = {
  order_no: string;
  ordered_at: string;
  note: string;
  devices: { imei: string; model_name: string; list_price: number; sale_price: number | null }[];
};

export function SfIntake({
  onSubmit,
}: {
  onSubmit: (input: SfIntakePayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [orderNo, setOrderNo] = useState("");
  const [orderedAt, setOrderedAt] = useState("");
  const [note, setNote] = useState("");
  const [devices, setDevices] = useState<DraftDevice[]>([
    { imei: "", model_name: "", list_price: "0", sale_price: "" },
  ]);

  const orderNoId = useId();
  const orderedAtId = useId();
  const noteId = useId();

  function updateDevice(i: number, patch: Partial<DraftDevice>) {
    setDevices((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function submit() {
    const validDevices = devices.filter((d) => d.imei.trim() && d.model_name.trim());
    if (!orderNo.trim() || validDevices.length === 0 || saving) return;

    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="open-sf-intake"
        className="ucom-secondary px-3 py-1.5 text-sm"
      >
        + รับบิล SF
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="SF+ / RECEIVING"
        title="รับเครื่องเข้าจากบิล SF"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ucom-secondary px-4 py-2 text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              data-testid="sf-intake-submit"
              className="ucom-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : "บันทึกการรับเครื่อง"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={orderNoId} className="text-sm font-medium text-ink-muted">เลขที่บิล SF</label>
            <input
              id={orderNoId}
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="เลขที่บิล SF"
              data-testid="sf-order-no"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={orderedAtId} className="text-sm font-medium text-ink-muted">วันที่รับ</label>
            <input
              id={orderedAtId}
              type="date"
              value={orderedAt}
              onChange={(e) => setOrderedAt(e.target.value)}
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={noteId} className="text-sm font-medium text-ink-muted">โน้ต</label>
            <input
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="โน้ต"
              className="ucom-field w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-medium mb-2">รายการเครื่อง</h3>
            <div className="space-y-2">
              {devices.map((d, i) => (
                <div key={i} className="grid gap-2 rounded-md border border-border bg-background p-2 md:grid-cols-[1.2fr_1fr_9rem_9rem]">
                  <input
                    value={d.imei}
                    onChange={(e) => updateDevice(i, { imei: e.target.value })}
                    placeholder="IMEI"
                    aria-label="IMEI"
                    data-testid={`sf-device-imei-${i}`}
                    className="ucom-field w-full px-2 py-1.5 text-sm"
                  />
                  <input
                    value={d.model_name}
                    onChange={(e) => updateDevice(i, { model_name: e.target.value })}
                    placeholder="รุ่นเครื่อง"
                    aria-label="รุ่นเครื่อง"
                    data-testid={`sf-device-model-${i}`}
                    className="ucom-field w-full px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={d.list_price}
                    onChange={(e) => updateDevice(i, { list_price: e.target.value })}
                    placeholder="ราคาป้าย SF"
                    aria-label="ราคาป้าย SF"
                    data-testid={`sf-device-price-${i}`}
                    className="ucom-field w-full px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={d.sale_price}
                    onChange={(e) => updateDevice(i, { sale_price: e.target.value })}
                    placeholder="ราคาขาย"
                    aria-label="ราคาขาย"
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
                className="ucom-secondary mt-2 px-3 py-1.5 text-sm"
              >
                + เพิ่มแถวเครื่อง
              </button>
            </div>
          </div>
        </div>
      </Modal>


    </>
  );
}
