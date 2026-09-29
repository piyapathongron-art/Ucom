"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Right-side 380px panel; shared by stock add + edit.
export function Drawer({ open, onClose, title, footer, children }: { open: boolean; onClose: () => void; title: string; footer?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-0 ml-auto h-full max-h-full w-[min(380px,100vw)] bg-surface p-0 text-ink shadow-2xl backdrop:bg-background/80 open:flex open:flex-col">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="ปิด" className="ucom-secondary grid h-8 w-8 place-items-center text-ink-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-3">{children}</div>
      {footer && <div className="flex items-center justify-end gap-3 px-6 pt-3 pb-5">{footer}</div>}
    </dialog>
  );
}
