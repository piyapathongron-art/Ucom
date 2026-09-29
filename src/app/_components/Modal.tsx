"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SIZE = { sm: "max-w-[480px]", md: "max-w-[640px]", lg: "max-w-[880px]" } as const;

export function Modal({
  open,
  onClose,
  title,
  footer,
  size = "sm",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className={`backdrop:bg-background/80 backdrop:backdrop-blur-sm m-auto w-full ${
        SIZE[size]
      } rounded-[20px] bg-surface p-0 text-ink shadow-2xl`}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="ucom-secondary flex h-8 w-8 shrink-0 items-center justify-center text-ink-muted"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 py-3">{children}</div>

        <div className="flex items-center justify-end gap-3 px-6 pt-3 pb-5">
          {footer}
        </div>
      </div>
    </dialog>
  );
}
