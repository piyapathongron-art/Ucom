interface Props {
  cashTotal: number;
  transferTotal: number;
  cashIncomeTotal: number;
  cashExpenseTotal: number;
  toSend: number;
  sfCount: number;
  fmt: (n: number) => string;
}

export default function ClosingSummary({
  cashTotal,
  transferTotal,
  cashIncomeTotal,
  cashExpenseTotal,
  toSend,
  sfCount,
  fmt,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="ucom-surface !border-dashed rounded-2xl p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">เงินสด</p>
          <p data-testid="close-day-cash-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(cashTotal)}</p>
        </div>
        <div className="ucom-surface !border-dashed rounded-2xl p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">เงินโอน</p>
          <p data-testid="close-day-transfer-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(transferTotal)}</p>
        </div>
        <div className="ucom-surface !border-dashed rounded-2xl p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">รายรับนอกบิล (เงินสด)</p>
          <p data-testid="close-day-income-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(cashIncomeTotal)}</p>
        </div>
        <div className="ucom-surface !border-dashed rounded-2xl p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">รายจ่าย (เงินสด)</p>
          <p data-testid="close-day-expense-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(cashExpenseTotal)}</p>
        </div>
      </div>

      <div className="ucom-surface bg-background p-4">
        <p className="text-sm font-medium text-ink">ยอดที่ต้องส่ง</p>
        <p data-testid="close-day-to-send" className="text-2xl font-bold font-mono tabular-nums mt-1 text-ink">{fmt(toSend)}</p>
      </div>

      {sfCount > 0 && (
        <div className="text-ink font-medium">ปล่อย SF+ วันนี้ {sfCount} เครื่อง</div>
      )}
    </>
  );
}
