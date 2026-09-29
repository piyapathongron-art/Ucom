"use client";

import { Toaster } from "sonner";

// Success/warning auto-dismiss 4s; errors stay until dismissed (callers pass duration: Infinity + a "ลองใหม่" action).
export function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      duration={4000}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "flex w-[min(420px,92vw)] items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-[var(--shadow-card)]",
          success: "!bg-success-bg !text-success",
          warning: "!bg-warning-bg !text-warning",
          error: "!text-danger",
          actionButton: "rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent",
          closeButton: "text-ink-muted",
        },
      }}
    />
  );
}
