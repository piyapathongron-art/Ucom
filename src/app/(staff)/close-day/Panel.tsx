import type { ReactNode } from "react";

// White ADR 0033 card used by every close-day section: heading row (title, optional count and action) above the body.
export function Panel({ title, count, description, action, children, testId }: {
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3 rounded-xl bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground">
            {title}
            {count !== undefined && <span className="ml-2 font-medium tabular-nums text-muted-foreground">{count.toLocaleString("th-TH")}</span>}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// One line of a list inside a Panel; rows are separated by a hairline.
export const panelRow = "border-t border-border py-2.5 text-sm first:border-t-0";
