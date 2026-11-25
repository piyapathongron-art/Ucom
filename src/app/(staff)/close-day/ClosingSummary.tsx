type PartLine = { id: string | null; job_label: string | null; amount: number | null };

interface Props {
  cashTotal: number;
  transferTotal: number;
  cashIncomeTotal: number;
  cashExpenseTotal: number;
  cashConsignmentPayoutTotal: number;
  cashPartTotal: number;
  parts: PartLine[];
  toSend: number;
  sfCount: number;
  fmt: (n: number) => string;
}

// Day totals for the single-drawer close (cash book off). The two-fund close uses CashClosing instead.
export default function ClosingSummary({
  cashTotal,
  transferTotal,
  cashIncomeTotal,
  cashExpenseTotal,
  cashConsignmentPayoutTotal,
  cashPartTotal,
  parts,
  toSend,
  sfCount,
  fmt,
}: Props) {
  const tiles = [
    ["เงินสด", cashTotal, "close-day-cash-total"],
    ["เงินโอน", transferTotal, "close-day-transfer-total"],
    ["รายรับนอกบิล (เงินสด)", cashIncomeTotal, "close-day-income-total"],
    ["รายจ่าย (เงินสด)", cashExpenseTotal, "close-day-expense-total"],
    ["จ่ายเจ้าของเครื่องฝากเข้า (เงินสด)", cashConsignmentPayoutTotal, "close-day-consignment-payout-total"],
    ["ค่าอะไหล่จากลิ้นชัก", cashPartTotal, "close-day-part-total"],
  ] as const;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-card md:p-6" aria-labelledby="close-day-summary-title">
      <h2 id="close-day-summary-title" className="text-lg font-bold">สรุปยอดวันนี้</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map(([label, value, testId]) => (
          <div key={testId} className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd data-testid={testId} className="mt-0.5 text-xl font-bold tabular-nums">{fmt(value)}</dd>
          </div>
        ))}
      </dl>

      {parts.length > 0 && (
        <div className="rounded-2xl bg-muted px-4 py-3">
          <p className="mb-1 text-sm font-semibold">เงินออกจากลิ้นชัก · อะไหล่</p>
          <ul>
            {parts.map((part) => (
              <li key={part.id} className="flex justify-between gap-3 py-1 text-sm">
                <span>อะไหล่ · {part.job_label}</span>
                <span className="tabular-nums">฿{fmt(Number(part.amount))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-accent px-4 py-4">
        <p className="font-semibold text-accent-foreground">ยอดที่ต้องส่ง</p>
        <p data-testid="close-day-to-send" className="text-2xl font-bold tabular-nums text-foreground">{fmt(toSend)}</p>
      </div>

      {sfCount > 0 && <p className="text-sm font-medium">ปล่อย SF+ วันนี้ {sfCount} เครื่อง</p>}
    </section>
  );
}
