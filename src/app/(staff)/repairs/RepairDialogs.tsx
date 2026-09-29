"use client";

import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { CloseJobDialog, type CloseJobPayload } from "./CloseJobDialog";
import type { RepairRow } from "./types";

// Shared by the desktop row and the mobile card. The abandon dialog deliberately shows no part cost:
// staff cannot read it (ADR 0010).
export function RepairDialogs({ row, showClose, showAbandon, onCloseClose, onCloseAbandon, onCloseJob, onAbandon }: {
  row: RepairRow;
  showClose: boolean;
  showAbandon: boolean;
  onCloseClose: () => void;
  onCloseAbandon: () => void;
  onCloseJob: (id: string, payload: CloseJobPayload) => Promise<boolean>;
  onAbandon: () => void;
}) {
  return (
    <>
      {showClose && <CloseJobDialog row={row} onClose={onCloseClose} onSubmit={(payload) => onCloseJob(row.id, payload)} />}
      <ConfirmDialog
        open={showAbandon}
        title="ลูกค้าทิ้งเครื่อง?"
        confirmLabel="ยืนยันทิ้งงาน"
        confirmTestId={`repair-abandon-confirm-${row.id}`}
        onClose={onCloseAbandon}
        onConfirm={() => { onAbandon(); onCloseAbandon(); }}
      >
        <p className="text-sm text-ink">{row.customer_name} · {row.device_desc}</p>
        <p className="text-sm text-ink-muted">ตัดงานทิ้งแล้วจะกดกลับเป็นสถานะอื่นไม่ได้ และแถวจะไม่ถูกลบ</p>
      </ConfirmDialog>
    </>
  );
}
