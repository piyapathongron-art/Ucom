import type { ReactNode } from "react";

type PageFrameProps = {
  page: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dataLoading?: boolean;
};

export function PageFrame({
  page,
  eyebrow,
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
      className={`ucom-page mx-auto w-full max-w-[1440px] space-y-6 px-4 py-5 md:px-8 md:py-7 ${className}`}
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          {eyebrow && (
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {title}
          </h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
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
