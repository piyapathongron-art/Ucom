export function QtyStepper({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  testId?: string;
}) {
  const n = Number(value) || 0;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(String(Math.max(0, n - 1)))}
        aria-label="ลดจำนวน"
        className="ucom-secondary h-7 w-7 shrink-0 p-0 text-sm leading-none"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="ucom-field w-14 px-1 py-1.5 text-center text-sm"
      />
      <button
        type="button"
        onClick={() => onChange(String(n + 1))}
        aria-label="เพิ่มจำนวน"
        className="ucom-secondary h-7 w-7 shrink-0 p-0 text-sm leading-none"
      >
        +
      </button>
    </div>
  );
}
