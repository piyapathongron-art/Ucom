export function cashToSend({ cashBills, cashIncome, cashExpenses, cashConsignmentPayouts, cashParts }: {
  cashBills: number;
  cashIncome: number;
  cashExpenses: number;
  cashConsignmentPayouts: number;
  cashParts: number;
}) {
  return cashBills + cashIncome - cashExpenses - cashConsignmentPayouts - cashParts;
}
