"use client";

import type { CashPaymentFund } from "./types";

export function FundSelect({ value, onChange, disabled, testId, allowDrawer = true }: {
  value: CashPaymentFund; onChange: (fund: CashPaymentFund) => void;
  disabled?: boolean; testId?: string; allowDrawer?: boolean;
}) {
  return <select aria-label="กองเงิน" className="ucom-field h-12 w-full px-4 text-base" value={value} disabled={disabled} data-testid={testId} onChange={(event) => onChange(event.target.value as CashPaymentFund)}>
    {allowDrawer && <option value="drawer">เงินเก๊ะ</option>}
    <option value="pending">เงินรอฝาก</option>
    <option value="transfer">เงินโอน/ส่วนตัว</option>
  </select>;
}
