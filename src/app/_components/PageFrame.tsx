import type { ReactNode } from "react";

type PageFrameProps = {
  page: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dataLoading?: boolean;
};

export function PageFrame({
  page,
  title,
  description,
  actions,
  children,
  className = "",
  dataLoading,
}: PageFrameProps) {
  return (
    <main
      data-page={page}
      data-loading={dataLoading}
      className={`ucom-page w-full space-y-6 p-4 md:p-8 ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold leading-8 tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-[12.5px] text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      {children}
    </main>
  );
}

export function PageSection({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ucom-section space-y-4 ${className}`}>
      {(title || description) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
