"use client";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  isLoading?: boolean;
  pageSizeOptions?: number[];
  label?: string;
  testIdPrefix?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function PaginationControls({
  page,
  pageSize,
  total,
  isLoading = false,
  pageSizeOptions = [25, 50, 100],
  label = "รายการ",
  testIdPrefix = "pagination",
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const first = total === 0 ? 0 : (currentPage - 1) * safePageSize + 1;
  const last = Math.min(currentPage * safePageSize, Math.max(0, total));

  return (
    <nav
      aria-label={`แบ่งหน้า${label}`}
      data-testid={`${testIdPrefix}-controls`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm text-ink-muted"
    >
      <span data-testid={`${testIdPrefix}-range`}>
        {total === 0 ? `ไม่มี${label}` : `แสดง ${first.toLocaleString("th-TH")}–${last.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} ${label}`}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1">
            <span className="sr-only">จำนวนต่อหน้า</span>
            <select
              value={safePageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              disabled={isLoading}
              data-testid={`${testIdPrefix}-page-size`}
              className="ucom-field px-2 py-1.5 text-sm"
            >
              {Array.from(new Set([safePageSize, ...pageSizeOptions])).map((option) => (
                <option key={option} value={option}>
                  {option}/หน้า
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="min-w-16 text-center font-mono text-xs tabular-nums" data-testid={`${testIdPrefix}-page`}>
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isLoading || currentPage <= 1}
          data-testid={`${testIdPrefix}-prev`}
          className="ucom-secondary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLoading || currentPage >= totalPages}
          data-testid={`${testIdPrefix}-next`}
          className="ucom-secondary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          ถัดไป
        </button>
      </div>
    </nav>
  );
}
