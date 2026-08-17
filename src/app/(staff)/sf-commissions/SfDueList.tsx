import { useState, useId, useEffect } from "react";
import { Modal } from "@/app/_components/Modal";
import { formatDate, fmtMoney } from "./utils";
import type { SfDueRow, SfOrderDeviceRow, SfOrderPayload } from "./useSfDue";

type EditModalProps = {
  order: SfDueRow;
  devices: SfOrderDeviceRow[];
  onClose: () => void;
  onSave: (payload: SfOrderPayload) => Promise<void>;
};

function EditModal({ order, devices, onClose, onSave }: EditModalProps) {
  const [saving, setSaving] = useState(false);
  const [orderNo, setOrderNo] = useState(order.order_no || "");
  const [orderedAt, setOrderedAt] = useState(order.ordered_at || "");
  const [note, setNote] = useState(order.note || "");

  const [draftDevices, setDraftDevices] = useState(devices.map(d => ({
    id: d.id || "",
    imei: d.imei || "",
    model_name: d.model_name || "",
    list_price: String(d.list_price || 0),
    sale_price: d.sale_price !== null ? String(d.sale_price) : "",
    status: d.status,
  })));

  const orderNoId = useId();
  const orderedAtId = useId();
  const noteId = useId();

  function updateDevice(i: number, patch: Partial<typeof draftDevices[0]>) {
    setDraftDevices((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function submit() {
    if (!orderNo.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        id: order.sf_order_id!,
        order_no: orderNo,
        ordered_at: orderedAt,
        note,
        devices: draftDevices.filter(d => d.status === "in_stock").map((d) => ({
          id: d.id,
          imei: d.imei,
          model_name: d.model_name,
          list_price: Number(d.list_price) || 0,
          sale_price: d.sale_price.trim() === "" ? null : Number(d.sale_price) || 0,
        })),
      });
    } catch {
      // the hook already surfaced the RPC's Thai message — keep the modal open so the edit is not lost
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="SF+ / EDIT"
      title="แก้ไขบิล SF"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="ucom-secondary px-4 py-2 text-sm">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            data-testid="sf-due-edit-submit"
            className="ucom-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
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
            placeholder="โน้ต (แก้ไข)"
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        </div>

        <div className="pt-2">
          <h3 className="text-sm font-medium mb-2">รายการเครื่อง</h3>
          <div className="space-y-2">
            {draftDevices.map((d, i) => (
              <div key={i} className="grid gap-2 rounded-md border border-border bg-background p-2 md:grid-cols-[1.2fr_1fr_9rem_9rem]">
                {d.status === "in_stock" ? (
                  <>
                    <input
                      value={d.imei}
                      onChange={(e) => updateDevice(i, { imei: e.target.value })}
                      placeholder="IMEI"
                      className="ucom-field w-full px-2 py-1.5 text-sm"
                    />
                    <input
                      value={d.model_name}
                      onChange={(e) => updateDevice(i, { model_name: e.target.value })}
                      placeholder="รุ่นเครื่อง"
                      className="ucom-field w-full px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={d.list_price}
                      onChange={(e) => updateDevice(i, { list_price: e.target.value })}
                      placeholder="ราคาป้าย SF"
                      className="ucom-field w-full px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={d.sale_price}
                      onChange={(e) => updateDevice(i, { sale_price: e.target.value })}
                      placeholder="ราคาขาย"
                      className="ucom-field w-full px-2 py-1.5 text-sm"
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center text-sm px-2 py-1.5 text-ink-muted bg-surface/50">{d.imei}</div>
                    <div className="flex items-center text-sm px-2 py-1.5 text-ink-muted bg-surface/50">{d.model_name}</div>
                    <div className="flex items-center text-sm px-2 py-1.5 text-ink-muted bg-surface/50">{d.list_price}</div>
                    <div className="flex items-center text-sm px-2 py-1.5 text-ink-muted bg-surface/50 col-span-1 text-xs">
                      แก้ไขไม่ได้ ({d.status})
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function SfDueList({
  dueList,
  devicesByOrder,
  loadDevicesForOrder,
  saveOrder,
  deleteOrder,
  error,
  setError,
}: {
  dueList: SfDueRow[];
  devicesByOrder: Record<string, SfOrderDeviceRow[]>;
  loadDevicesForOrder: (id: string) => Promise<void>;
  saveOrder: (input: SfOrderPayload) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  error: string | null;
  setError: (err: string | null) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeDueList = dueList.filter((o) => (o.unfinanced_count ?? 0) > 0);

  useEffect(() => {
    if (editId && !devicesByOrder[editId]) {
      void loadDevicesForOrder(editId);
    }
  }, [editId, devicesByOrder, loadDevicesForOrder]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ucom-danger px-3 py-1.5 text-sm">
            ปิด
          </button>
        </div>
      )}

      {activeDueList.length > 0 ? (
        <div className="ucom-surface w-full border-warning/30 bg-warning/5 p-3" data-testid="sf-due-list">
          <h3 className="text-sm font-medium text-warning">บิล SF ที่ยังมีเครื่องค้าง</h3>
          <ul className="mt-2 space-y-2">
            {activeDueList.map((o) => (
              <li key={o.sf_order_id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
                <div>
                  {o.order_no} &middot; {formatDate(o.ordered_at)} &middot; เหลือ {o.unfinanced_count} / {o.device_count} เครื่อง
                  {o.amount_due !== null && ` · ค้าง ${fmtMoney(o.amount_due)}`}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditId(o.sf_order_id)}
                    data-testid={`sf-due-edit-${o.sf_order_id}`}
                    className="ucom-secondary px-3 py-1 text-xs"
                  >
                    แก้ไข
                  </button>

                  {deleteConfirmId === o.sf_order_id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          // the hook surfaces the RPC's Thai message in `error`; nothing to do here
                          deleteOrder(o.sf_order_id!).catch(() => {});
                          setDeleteConfirmId(null);
                        }}
                        data-testid={`sf-due-delete-confirm-${o.sf_order_id}`}
                        className="ucom-danger bg-danger px-3 py-1 text-xs"
                      >
                        ยืนยันลบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="ucom-secondary px-3 py-1 text-xs"
                      >
                        ยกเลิก
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(o.sf_order_id)}
                      data-testid={`sf-due-delete-${o.sf_order_id}`}
                      disabled={(o.financed_count ?? 0) > 0}
                      title={(o.financed_count ?? 0) > 0 ? "ลบไม่ได้: บิลนี้มีเครื่องที่ปล่อย/ขายไปแล้ว" : undefined}
                      className="ucom-secondary text-danger hover:border-danger hover:bg-danger/10 px-3 py-1 text-xs disabled:opacity-50 disabled:pointer-events-none"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-ink-muted text-sm py-4">ไม่มีบิลค้าง</div>
      )}

      {editId && devicesByOrder[editId] && (
        <EditModal
          order={dueList.find((o) => o.sf_order_id === editId)!}
          devices={devicesByOrder[editId]}
          onClose={() => setEditId(null)}
          onSave={async (payload) => {
            await saveOrder(payload);
            setEditId(null);
          }}
        />
      )}
    </div>
  );
}
