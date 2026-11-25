// 40px targets (ADR 0033; was 28px). The input stays editable for large corrections.
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
  const step = "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-lg text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(String(Math.max(0, n - 1)))} disabled={n <= 0} aria-label="ลดจำนวน" className={step}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="จำนวนคงเหลือ"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="ucom-field h-10 w-20 px-2 text-center font-mono text-base"
      />
      <button type="button" onClick={() => onChange(String(n + 1))} aria-label="เพิ่มจำนวน" className={step}>
        +
      </button>
    </div>
  );
}
