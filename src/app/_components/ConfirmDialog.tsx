"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

// Yellow confirm = irreversible action (design "States" board). Reversible per-row actions use inline confirm instead.
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel = "ยกเลิก", isBusy, confirmTestId, onConfirm, onClose, children }: {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  isBusy?: boolean;
  confirmTestId?: string;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={<>
        <button type="button" onClick={onClose} disabled={isBusy} className="ucom-secondary px-5 py-2.5">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} data-testid={confirmTestId} disabled={isBusy} className="rounded-full bg-warning px-5 py-2.5 text-[13.5px] font-bold text-on-accent disabled:opacity-50">{confirmLabel}</button>
      </>}
    >
      {children}
    </Modal>
  );
}
