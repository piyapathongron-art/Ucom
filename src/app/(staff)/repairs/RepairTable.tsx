"use client";

import { REPAIR_STATUS_BADGE, REPAIR_STATUS_LABEL, type PartPaidFrom, type RepairRow, type RepairStatus } from "./types";
import type { CloseJobPayload } from "./CloseJobDialog";
import { RepairDialogs } from "./RepairDialogs";
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
  onSetPartCost: (id: string, cost: number, paidFrom: PartPaidFrom) => Promise<boolean>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<boolean>;
}) {
  const {
    partCostDraft,
    setPartCostDraft,
    partPaidFrom,
    setPartPaidFrom,
    isEditingPartCost,
    setIsEditingPartCost,
    showAbandonConfirm,
    setShowAbandonConfirm,
    showCloseDialog,
    setShowCloseDialog,
    savingPartCost,
    canSavePartCost,
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
        <td className="text-sm text-ink-muted">{receivedAtStr}</td>
        <td>
          <div data-testid={`repair-customer-${row.id}`}>
            <div className="font-medium text-sm text-ink">{row.customer_name}</div>
            {row.customer_phone && <div className="text-xs text-ink-muted">{row.customer_phone}</div>}
          </div>
        </td>
        <td>
          <div className="text-sm text-ink">{row.device_desc}</div>
          {row.symptom && <div className="text-xs text-ink-muted">{row.symptom}</div>}
        </td>
        <td className="text-sm text-ink">
          {row.quoted_price != null ? row.quoted_price.toLocaleString() : "-"}
        </td>
        <td>
          <div className="flex flex-col items-start gap-1">
            <span
              data-testid={`repair-status-${row.id}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${REPAIR_STATUS_BADGE[row.status]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
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
                    data-testid={`repair-status-forward-${row.id}`}
                    className="ucom-primary !rounded-full px-2 py-1 text-xs disabled:opacity-40"
                  >
                    {REPAIR_STATUS_LABEL[nextStep as RepairStatus]}
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
        <td>
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
                <div className="flex flex-wrap items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={partCostDraft}
                    onChange={(e) => setPartCostDraft(e.target.value)}
                    placeholder="ต้นทุนอะไหล่"
                    data-testid={`repair-part-cost-input-${row.id}`}
                    className="ucom-field w-24 px-2 py-1.5 text-sm"
                  />
                  <select aria-label="จ่ายค่าอะไหล่จาก" value={partPaidFrom} onChange={(e) => setPartPaidFrom(e.target.value as PartPaidFrom | "")} data-testid={`repair-part-paid-from-${row.id}`} className="ucom-field px-2 py-1.5 text-sm">
                    <option value="">วิธีจ่าย</option>
                    <option value="cash">เงินสด</option>
                    <option value="transfer">โอน</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSavePartCost}
                    disabled={savingPartCost || !canSavePartCost}
                    data-testid={`repair-part-cost-save-${row.id}`}
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
        </td>
        <td>
          {isInSteps && (
            <div className="flex flex-col items-start gap-1 min-w-[100px]">
              <button
                type="button"
                onClick={() => setShowCloseDialog(!showCloseDialog)}
                data-testid={`repair-close-${row.id}`}
                className="ucom-secondary !rounded-full px-2 py-1 text-sm"
              >
                ปิดงาน/ออกบิล
              </button>
              
              <button
                type="button"
                onClick={() => setShowAbandonConfirm(true)}
                data-testid={`repair-abandon-${row.id}`}
                className="ucom-danger border-0 px-0 py-1 text-sm underline"
              >
                ลูกค้าทิ้ง
              </button>
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
          )}
        </td>
      </tr>
    </>
  );
}

export function RepairTableHead() {
  return (
    <thead>
      <tr>
        <th>วันที่รับ</th>
        <th>ลูกค้า</th>
        <th>เครื่อง/อาการ</th>
        <th>ราคาที่ตกลง</th>
        <th>สถานะ</th>
        <th>ต้นทุนอะไหล่</th>
        <th>จัดการ</th>
      </tr>
    </thead>
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
  onSetPartCost: (id: string, cost: number, paidFrom: PartPaidFrom) => Promise<boolean>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<boolean>;
}) {
  return (
    <>
      <div className="ucom-table-wrap hidden md:block">
        <table className="ucom-table">
          <RepairTableHead />
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
