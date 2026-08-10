"use client";

import { useState } from "react";
import { REPAIR_STATUS_LABEL, REPAIR_STEPS, type RepairRow, type RepairStatus } from "./types";
import { CloseJobDialog, type CloseJobPayload } from "./CloseJobDialog";

function Row({
  row,
  onSetStatus,
  onSetPartCost,
  onCloseJob,
}: {
  row: RepairRow;
  onSetStatus: (id: string, status: string) => Promise<void>;
  onSetPartCost: (id: string, cost: number) => Promise<void>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<void>;
}) {
  const [partCostDraft, setPartCostDraft] = useState("");
  const [isEditingPartCost, setIsEditingPartCost] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [savingPartCost, setSavingPartCost] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);

  const receivedAtStr = new Date(row.received_at).toLocaleDateString("th-TH", { dateStyle: "short" });
  
  const currentStepIndex = (REPAIR_STEPS as readonly string[]).indexOf(row.status);
  const isInSteps = currentStepIndex !== -1;
  const nextStep = isInSteps && currentStepIndex < REPAIR_STEPS.length - 1 ? REPAIR_STEPS[currentStepIndex + 1] : null;
  const prevStep = isInSteps && currentStepIndex > 0 ? REPAIR_STEPS[currentStepIndex - 1] : null;

  async function handleSetStatus(target: string) {
    setSettingStatus(true);
    await onSetStatus(row.id, target);
    setSettingStatus(false);
  }

  async function handleSavePartCost() {
    setSavingPartCost(true);
    await onSetPartCost(row.id, Number(partCostDraft) || 0);
    setPartCostDraft("");
    setIsEditingPartCost(false);
    setSavingPartCost(false);
  }

  return (
    <>
      <tr className="border-b border-neutral-100" data-testid={`repair-row-${row.id}`}>
        <td className="p-2 text-sm text-neutral-600">{receivedAtStr}</td>
        <td className="p-2">
          <div data-testid={`repair-customer-${row.id}`}>
            <div className="font-medium text-sm">{row.customer_name}</div>
            {row.customer_phone && <div className="text-xs text-neutral-500">{row.customer_phone}</div>}
          </div>
        </td>
        <td className="p-2">
          <div className="text-sm">{row.device_desc}</div>
          {row.symptom && <div className="text-xs text-neutral-500">{row.symptom}</div>}
        </td>
        <td className="p-2 text-sm">
          {row.quoted_price != null ? row.quoted_price.toLocaleString() : "-"}
        </td>
        <td className="p-2">
          <div className="flex flex-col items-start gap-1">
            <span data-testid={`repair-status-${row.id}`} className="text-sm font-medium">
              {REPAIR_STATUS_LABEL[row.status]}
            </span>
            {isInSteps && (
              <div className="flex gap-1">
                {prevStep && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(prevStep)}
                    disabled={settingStatus}
                    data-testid={`repair-status-back-${row.id}`}
                    className="text-xs rounded bg-neutral-100 px-2 py-1 disabled:opacity-40"
                  >
                    ย้อนกลับ
                  </button>
                )}
                {nextStep && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(nextStep)}
                    disabled={settingStatus}
                    data-testid={`repair-status-forward-${row.id}`}
                    className="text-xs rounded bg-neutral-900 text-white px-2 py-1 disabled:opacity-40"
                  >
                    {REPAIR_STATUS_LABEL[nextStep as RepairStatus]}
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
        <td className="p-2">
          {row.status !== "collected" && (
            <div className="flex flex-col items-start gap-1 min-w-[120px]">
              {row.part_paid_at && !isEditingPartCost ? (
                <div data-testid={`repair-part-paid-${row.id}`}>
                  <div className="text-sm text-green-600">กรอกแล้ว</div>
                  <div className="text-xs text-neutral-500">
                    {new Date(row.part_paid_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPartCost(true)}
                    data-testid={`repair-part-cost-edit-${row.id}`}
                    className="text-xs text-neutral-500 underline"
                  >
                    แก้ไข
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={partCostDraft}
                    onChange={(e) => setPartCostDraft(e.target.value)}
                    placeholder="ต้นทุนอะไหล่"
                    data-testid={`repair-part-cost-input-${row.id}`}
                    className="w-24 rounded border border-neutral-300 p-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSavePartCost}
                    disabled={savingPartCost || partCostDraft.trim() === ""}
                    data-testid={`repair-part-cost-save-${row.id}`}
                    className="text-xs text-neutral-500 underline disabled:opacity-30"
                  >
                    บันทึก
                  </button>
                  {isEditingPartCost && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPartCost(false);
                        setPartCostDraft("");
                      }}
                      className="text-xs text-neutral-400"
                    >
                      ยกเลิก
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </td>
        <td className="p-2">
          {isInSteps && (
            <div className="flex flex-col items-start gap-1 min-w-[100px]">
              <button
                type="button"
                onClick={() => setShowCloseDialog(!showCloseDialog)}
                data-testid={`repair-close-${row.id}`}
                className="text-sm text-neutral-700 underline"
              >
                ปิดงาน/ออกบิล
              </button>
              
              {showAbandonConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleSetStatus("abandoned");
                      setShowAbandonConfirm(false);
                    }}
                    data-testid={`repair-abandon-confirm-${row.id}`}
                    className="text-xs rounded bg-red-600 text-white px-2 py-1"
                  >
                    ยืนยันทิ้งงาน
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbandonConfirm(false)}
                    className="text-xs text-neutral-500"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAbandonConfirm(true)}
                  data-testid={`repair-abandon-${row.id}`}
                  className="text-sm text-red-600 underline"
                >
                  ลูกค้าทิ้ง
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
      {showCloseDialog && (
        <tr>
          <td colSpan={7} className="p-0">
            <CloseJobDialog
              row={row}
              onClose={() => setShowCloseDialog(false)}
              onSubmit={async (payload) => {
                await onCloseJob(row.id, payload);
                setShowCloseDialog(false);
              }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function RepairTable({
  rows,
  onSetStatus,
  onSetPartCost,
  onCloseJob,
}: {
  rows: RepairRow[];
  onSetStatus: (id: string, status: string) => Promise<void>;
  onSetPartCost: (id: string, cost: number) => Promise<void>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm text-neutral-500">
            <th className="p-2">วันที่รับ</th>
            <th className="p-2">ลูกค้า</th>
            <th className="p-2">เครื่อง/อาการ</th>
            <th className="p-2">ราคาที่ตกลง</th>
            <th className="p-2">สถานะ</th>
            <th className="p-2">ต้นทุนอะไหล่</th>
            <th className="p-2">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              onSetStatus={onSetStatus}
              onSetPartCost={onSetPartCost}
              onCloseJob={onCloseJob}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
