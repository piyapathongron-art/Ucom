import type { ReactNode } from "react";

// Two variants: no data yet (pass `action` CTA) and no match for filter (pass `onClearFilter`).
export function EmptyState({ title, hint, action, onClearFilter }: { title: string; hint?: string; action?: ReactNode; onClearFilter?: () => void }) {
  return (
    <div className="ucom-surface flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-bold text-ink">{title}</p>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      {onClearFilter && <button type="button" onClick={onClearFilter} className="ucom-secondary mt-2 px-5 py-2">ล้างตัวกรอง</button>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
