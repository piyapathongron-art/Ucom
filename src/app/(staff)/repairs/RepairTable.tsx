"use client";

import { REPAIR_STATUS_LABEL, type RepairRow, type RepairStatus } from "./types";
import { CloseJobDialog, type CloseJobPayload } from "./CloseJobDialog";
import { useRepairRowActions } from "./useRepairRowActions";
import { RepairRowCard } from "./RepairRowCard";

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
    <>
      <tr className="border-b border-border bg-surface" data-testid={`repair-row-${row.id}`}>
        <td className="p-2 text-sm text-ink-muted">{receivedAtStr}</td>
        <td className="p-2">
          <div data-testid={`repair-customer-${row.id}`}>
            <div className="font-medium text-sm text-ink">{row.customer_name}</div>
            {row.customer_phone && <div className="text-xs text-ink-muted">{row.customer_phone}</div>}
          </div>
        </td>
        <td className="p-2">
          <div className="text-sm text-ink">{row.device_desc}</div>
          {row.symptom && <div className="text-xs text-ink-muted">{row.symptom}</div>}
        </td>
        <td className="p-2 text-sm text-ink">
          {row.quoted_price != null ? row.quoted_price.toLocaleString() : "-"}
        </td>
        <td className="p-2">
          <div className="flex flex-col items-start gap-1">
            <span data-testid={`repair-status-${row.id}`} className="text-sm font-medium text-ink">
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
                    className="ucom-secondary px-2 py-1 text-xs disabled:opacity-40"
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
                    className="ucom-primary px-2 py-1 text-xs disabled:opacity-40"
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
                  <div className="text-sm text-success">กรอกแล้ว</div>
                  <div className="text-xs text-ink-muted">
                    {new Date(row.part_paid_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingPartCost(true)}
                    data-testid={`repair-part-cost-edit-${row.id}`}
                    className="text-xs text-ink-muted underline"
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
                    className="ucom-field w-24 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSavePartCost}
                    disabled={savingPartCost || partCostDraft.trim() === ""}
                    data-testid={`repair-part-cost-save-${row.id}`}
                    className="ucom-secondary px-2 py-1 text-xs disabled:opacity-30"
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
                      className="ucom-secondary px-2 py-1 text-xs"
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
                className="ucom-secondary px-2 py-1 text-sm"
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
                    className="ucom-danger px-2 py-1 text-xs"
                  >
                    ยืนยันทิ้งงาน
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAbandonConfirm(false)}
                    className="ucom-secondary px-2 py-1 text-xs"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAbandonConfirm(true)}
                  data-testid={`repair-abandon-${row.id}`}
                  className="ucom-danger border-0 px-0 py-1 text-sm underline"
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
    <>
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <thead>
            <tr className="text-sm text-ink-muted border-b border-border">
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
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <RepairRowCard
            key={row.id}
            row={row}
            onSetStatus={onSetStatus}
            onSetPartCost={onSetPartCost}
            onCloseJob={onCloseJob}
          />
        ))}
      </div>
    </>
  );
}
