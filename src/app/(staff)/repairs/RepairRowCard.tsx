"use client";

import { ABANDON_LINK, FORWARD_BUTTON, REPAIR_STATUS_BADGE, REPAIR_STATUS_LABEL, TEXT_LINK, formatPrice, type PartPaidFrom, type RepairRow, type RepairStatus } from "./types";
import type { CloseJobPayload } from "./CloseJobDialog";
import { RepairDialogs } from "./RepairDialogs";
import { useRepairRowActions } from "./useRepairRowActions";
import Link from "next/link";

// The phone layout of one job. Test IDs stay on the desktop row only: e2e runs at desktop width,
// and a second copy here would make every test ID ambiguous.
export function RepairRowCard({
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
    <article className="space-y-3 rounded-xl bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{row.customer_name}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {row.customer_phone ? `${row.customer_phone} · ` : ""}รับ {receivedAtStr}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-semibold ${REPAIR_STATUS_BADGE[row.status]}`}>
          {REPAIR_STATUS_LABEL[row.status]}
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{row.device_desc}</div>
          {row.symptom && <div className="text-sm text-muted-foreground">{row.symptom}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm text-muted-foreground">ราคาที่ตกลง</div>
          <div className="font-bold tabular-nums">{formatPrice(row.quoted_price)}</div>
        </div>
      </div>

      {isInSteps && (
        <div className="flex gap-2">
          {prevStep && (
            <button
              type="button"
              onClick={() => handleSetStatus(prevStep)}
              disabled={settingStatus}
              className="ucom-secondary px-4 disabled:opacity-40"
            >
              ย้อนกลับ
            </button>
          )}
          {nextStep && (
            <button
              type="button"
              onClick={() => handleSetStatus(nextStep)}
              disabled={settingStatus}
              className={`${FORWARD_BUTTON} flex-1 justify-center disabled:opacity-40`}
            >
              {REPAIR_STATUS_LABEL[nextStep as RepairStatus]}
            </button>
          )}
        </div>
      )}

      {row.status !== "collected" && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-sm font-semibold">ต้นทุนอะไหล่</div>
          {row.part_paid_at && !isEditingPartCost ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex rounded-full bg-success-bg px-3 py-1 text-sm font-semibold text-success">กรอกแล้ว</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {new Date(row.part_paid_at).toLocaleDateString("th-TH", { dateStyle: "short" })}
              </span>
              {cash.isActive ? <Link href="/cash" className={TEXT_LINK}>ให้เจ้าของแก้ไขพร้อมเหตุผล</Link> : <button
                type="button"
                onClick={() => setIsEditingPartCost(true)}
                className={TEXT_LINK}
              >
                แก้ไข
              </button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={partCostDraft}
                onChange={(e) => setPartCostDraft(e.target.value)}
                placeholder="จำนวนเงิน"
                aria-label="ต้นทุนอะไหล่ (บาท)"
                className="ucom-field min-w-0 px-3 text-sm tabular-nums"
              />
              <select aria-label="จ่ายค่าอะไหล่จาก" value={partPaidFrom} onChange={(e) => setPartPaidFrom(e.target.value as PartPaidFrom | "")} className="ucom-field min-w-0 px-3 text-sm">
                <option value="">วิธีจ่าย</option>
                {cash.isActive ? <><option value="drawer">เงินเก๊ะ</option><option value="pending">เงินรอฝาก</option></> : <option value="cash">เงินสด</option>}
                <option value="transfer">โอน</option>
              </select>
              <button
                type="button"
                onClick={handleSavePartCost}
                disabled={savingPartCost || !canSavePartCost}
                className={`ucom-secondary px-4 disabled:opacity-40 ${isEditingPartCost ? "" : "col-span-2"}`}
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

      {isInSteps && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowCloseDialog(!showCloseDialog)}
            className="ucom-primary flex-1 px-4"
          >
            ปิดงาน/ออกบิล
          </button>
          <button
            type="button"
            onClick={() => setShowAbandonConfirm(true)}
            className={`${ABANDON_LINK} px-2`}
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
    </article>
  );
}
