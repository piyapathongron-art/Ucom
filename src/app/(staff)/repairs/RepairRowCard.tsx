"use client";

import { REPAIR_STATUS_LABEL, type RepairRow, type RepairStatus } from "./types";
import { CloseJobDialog, type CloseJobPayload } from "./CloseJobDialog";
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
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<void>;
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
    <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
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
          <span className="text-sm font-medium text-ink">
            {REPAIR_STATUS_LABEL[row.status]}
          </span>
          {isInSteps && (
            <div className="flex gap-2">
              {prevStep && (
                <button
                  type="button"
                  onClick={() => handleSetStatus(prevStep)}
                  disabled={settingStatus}
                  className="text-xs rounded border border-border bg-surface px-2 py-1 text-ink-muted disabled:opacity-40"
                >
                  ย้อนกลับ
                </button>
              )}
              {nextStep && (
                <button
                  type="button"
                  onClick={() => handleSetStatus(nextStep)}
                  disabled={settingStatus}
                  className="text-xs rounded bg-ink text-surface px-2 py-1 disabled:opacity-40"
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
                  className="text-xs text-ink-muted underline"
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
                  className="w-24 rounded border border-border bg-surface p-1 text-sm text-ink"
                />
                <button
                  type="button"
                  onClick={handleSavePartCost}
                  disabled={savingPartCost || partCostDraft.trim() === ""}
                  className="text-xs text-ink-muted underline disabled:opacity-30"
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
                    className="text-xs text-ink-muted"
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
            className="text-sm text-ink underline"
          >
            ปิดงาน/ออกบิล
          </button>

          {showAbandonConfirm ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSetStatus("abandoned");
                  setShowAbandonConfirm(false);
                }}
                className="text-xs rounded border border-danger text-danger px-2 py-1"
              >
                ยืนยันทิ้งงาน
              </button>
              <button
                type="button"
                onClick={() => setShowAbandonConfirm(false)}
                className="text-xs text-ink-muted"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAbandonConfirm(true)}
              className="text-sm text-danger underline"
            >
              ลูกค้าทิ้ง
            </button>
          )}
        </div>
      )}

      {showCloseDialog && (
        <div className="pt-2">
          <CloseJobDialog
            row={row}
            onClose={() => setShowCloseDialog(false)}
            onSubmit={async (payload) => {
              await onCloseJob(row.id, payload);
              setShowCloseDialog(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
