"use client";

import { REPAIR_STATUS_BADGE, REPAIR_STATUS_LABEL, type RepairRow, type RepairStatus } from "./types";
import type { CloseJobPayload } from "./CloseJobDialog";
import { RepairDialogs } from "./RepairDialogs";
import { useRepairRowActions } from "./useRepairRowActions";

export function RepairRowCard({
  row,
  onSetStatus,
  onSetPartCost,
  onCloseJob,
}: {
  row: RepairRow;
  onSetStatus: (id: string, status: string) => Promise<void>;
  onSetPartCost: (id: string, cost: number) => Promise<void>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<boolean>;
}) {
  const {
    partCostDraft,
    setPartCostDraft,
    isEditingPartCost,
    setIsEditingPartCost,
    showAbandonConfirm,
    setShowAbandonConfirm,
    showCloseDialog,
    setShowCloseDialog,
    savingPartCost,
    settingStatus,
    receivedAtStr,
    isInSteps,
    nextStep,
    prevStep,
    handleSetStatus,
    handleSavePartCost,
  } = useRepairRowActions({ row, onSetStatus, onSetPartCost });

  return (
    <div className="ucom-surface space-y-3 p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium text-sm text-ink">{row.customer_name}</div>
          {row.customer_phone && <div className="text-xs text-ink-muted">{row.customer_phone}</div>}
        </div>
        <div className="text-xs text-ink-muted">{receivedAtStr}</div>
      </div>

      <div>
        <div className="text-sm text-ink">{row.device_desc}</div>
        {row.symptom && <div className="text-xs text-ink-muted">{row.symptom}</div>}
      </div>

      <div className="flex justify-between items-center text-sm">
        <span className="text-ink-muted">ราคาที่ตกลง:</span>
        <span className="text-ink font-medium">
          {row.quoted_price != null ? row.quoted_price.toLocaleString() : "-"}
        </span>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <div className="flex justify-between items-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${REPAIR_STATUS_BADGE[row.status]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {REPAIR_STATUS_LABEL[row.status]}
          </span>
          {isInSteps && (
            <div className="flex gap-2">
              {prevStep && (
                <button
                  type="button"
                  onClick={() => handleSetStatus(prevStep)}
                  disabled={settingStatus}
                  className="ucom-secondary !rounded-full px-2 py-1 text-xs disabled:opacity-40"
                >
                  ย้อนกลับ
                </button>
              )}
              {nextStep && (
                <button
                  type="button"
                  onClick={() => handleSetStatus(nextStep)}
                  disabled={settingStatus}
                  className="ucom-primary !rounded-full px-2 py-1 text-xs disabled:opacity-40"
                >
                  {REPAIR_STATUS_LABEL[nextStep as RepairStatus]}
                </button>
              )}
            </div>
          )}
        </div>

        {row.status !== "collected" && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-ink-muted">ต้นทุนอะไหล่:</span>
            {row.part_paid_at && !isEditingPartCost ? (
              <div className="flex items-center gap-2">
                <div className="text-sm text-success">กรอกแล้ว</div>
                <div className="text-xs text-ink-muted">
                  ({new Date(row.part_paid_at).toLocaleDateString("th-TH", { dateStyle: "short" })})
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPartCost(true)}
                  className="ucom-secondary !rounded-full px-2 py-1 text-xs"
                >
                  แก้ไข
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={partCostDraft}
                  onChange={(e) => setPartCostDraft(e.target.value)}
                  placeholder="จำนวนเงิน"
                  className="ucom-field w-24 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSavePartCost}
                  disabled={savingPartCost || partCostDraft.trim() === ""}
                  className="ucom-secondary !rounded-full px-2 py-1 text-xs disabled:opacity-30"
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
                    className="ucom-secondary !rounded-full px-2 py-1 text-xs"
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isInSteps && (
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => setShowCloseDialog(!showCloseDialog)}
            className="ucom-secondary !rounded-full px-2 py-1 text-sm"
          >
            ปิดงาน/ออกบิล
          </button>

          <button
            type="button"
            onClick={() => setShowAbandonConfirm(true)}
            className="ucom-danger border-0 px-0 py-1 text-sm underline"
          >
            ลูกค้าทิ้ง
          </button>
        </div>
      )}

      <RepairDialogs
        row={row}
        showClose={showCloseDialog}
        showAbandon={showAbandonConfirm}
        onCloseClose={() => setShowCloseDialog(false)}
        onCloseAbandon={() => setShowAbandonConfirm(false)}
        onCloseJob={onCloseJob}
        onAbandon={() => handleSetStatus("abandoned")}
      />
    </div>
  );
}
