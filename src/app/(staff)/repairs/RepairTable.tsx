"use client";

import { ABANDON_LINK, FORWARD_BUTTON, REPAIR_STATUS_BADGE, REPAIR_STATUS_LABEL, TEXT_LINK, formatPrice, type PartPaidFrom, type RepairRow, type RepairStatus } from "./types";
import type { CloseJobPayload } from "./CloseJobDialog";
import { RepairDialogs } from "./RepairDialogs";
import { useRepairRowActions } from "./useRepairRowActions";
import { RepairRowCard } from "./RepairRowCard";
import Link from "next/link";

function Row({
  row,
  onSetStatus,
  onSetPartCost,
  onCloseJob,
}: {
  row: RepairRow;
  onSetStatus: (id: string, status: string) => Promise<void>;
  onSetPartCost: (id: string, cost: string, paidFrom: PartPaidFrom) => Promise<boolean>;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<boolean>;
}) {
  const {
    cash,
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
      <tr className="border-b border-border bg-card align-top" data-testid={`repair-row-${row.id}`}>
        <td className="text-sm text-muted-foreground tabular-nums">{receivedAtStr}</td>
        <td>
          <div data-testid={`repair-customer-${row.id}`}>
            <div className="text-sm font-semibold">{row.customer_name}</div>
            {row.customer_phone && <div className="text-sm text-muted-foreground tabular-nums">{row.customer_phone}</div>}
          </div>
        </td>
        <td>
          <div className="text-sm font-semibold">{row.device_desc}</div>
          {row.symptom && <div className="text-sm text-muted-foreground">{row.symptom}</div>}
        </td>
        <td className="text-right text-sm font-semibold tabular-nums">
          {formatPrice(row.quoted_price)}
        </td>
        <td>
          <div className="flex flex-col items-start gap-2">
            <span
              data-testid={`repair-status-${row.id}`}
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${REPAIR_STATUS_BADGE[row.status]}`}
            >
              {REPAIR_STATUS_LABEL[row.status]}
            </span>
            {isInSteps && (
              <div className="flex gap-1.5">
                {prevStep && (
                  <button
                    type="button"
                    onClick={() => handleSetStatus(prevStep)}
                    disabled={settingStatus}
                    data-testid={`repair-status-back-${row.id}`}
                    className="ucom-secondary px-3 disabled:opacity-40"
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
                    className={`${FORWARD_BUTTON} disabled:opacity-40`}
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
            <div className="flex min-w-40 flex-col items-start gap-1">
              {row.part_paid_at && !isEditingPartCost ? (
                <div data-testid={`repair-part-paid-${row.id}`}>
                  <span className="inline-flex rounded-full bg-success-bg px-3 py-1 text-sm font-semibold text-success">กรอกแล้ว</span>
                  <div className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {new Date(row.part_paid_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
                  </div>
                  {cash.isActive ? <Link href="/cash" className={TEXT_LINK}>ให้เจ้าของแก้ไขพร้อมเหตุผล</Link> : <button
                    type="button"
                    onClick={() => setIsEditingPartCost(true)}
                    data-testid={`repair-part-cost-edit-${row.id}`}
                    className={TEXT_LINK}
                  >
                    แก้ไข
                  </button>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={partCostDraft}
                    onChange={(e) => setPartCostDraft(e.target.value)}
                    placeholder="ต้นทุนอะไหล่"
                    aria-label="ต้นทุนอะไหล่ (บาท)"
                    data-testid={`repair-part-cost-input-${row.id}`}
                    className="ucom-field w-28 px-3 text-sm tabular-nums"
                  />
                  <select aria-label="จ่ายค่าอะไหล่จาก" value={partPaidFrom} onChange={(e) => setPartPaidFrom(e.target.value as PartPaidFrom | "")} data-testid={`repair-part-paid-from-${row.id}`} className="ucom-field px-3 text-sm">
                    <option value="">วิธีจ่าย</option>
                    {cash.isActive ? <><option value="drawer">เงินเก๊ะ</option><option value="pending">เงินรอฝาก</option></> : <option value="cash">เงินสด</option>}
                    <option value="transfer">โอน</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSavePartCost}
                    disabled={savingPartCost || !canSavePartCost}
                    data-testid={`repair-part-cost-save-${row.id}`}
                    className="ucom-secondary px-4 disabled:opacity-40"
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
                      className="ucom-secondary px-4"
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
            <div className="flex min-w-32 flex-col items-stretch gap-1">
              <button
                type="button"
                onClick={() => setShowCloseDialog(!showCloseDialog)}
                data-testid={`repair-close-${row.id}`}
                className="ucom-primary px-4"
              >
                ปิดงาน/ออกบิล
              </button>
              <button
                type="button"
                onClick={() => setShowAbandonConfirm(true)}
                data-testid={`repair-abandon-${row.id}`}
                className={ABANDON_LINK}
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
        <th className="text-right">ราคาที่ตกลง</th>
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
  onSetPartCost: (id: string, cost: string, paidFrom: PartPaidFrom) => Promise<boolean>;
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
      <div className="space-y-3 md:hidden">
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
