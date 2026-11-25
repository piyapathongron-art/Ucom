// Pure helpers for the SF dealer account (ADR 0034). The ledger rows come from v_sf_dealer_ledger.

export type DealerLedgerLine = {
  kind: string | null;
  entry_date: string | null; // YYYY-MM-DD
  debt_change: number | null; // + raises what the shop owes the dealer
  voided_at: string | null;
};

export type DealerEntryKind = "payment" | "credit_other" | "adjustment";

export const DEALER_KIND_LABEL: Record<string, string> = {
  invoice: "ใบส่งของ",
  credit_financed: "ลดหนี้ (ผ่อน SF)",
  credit_other: "ลดหนี้อื่นๆ",
  payment: "โอนจ่าย",
  adjustment: "ปรับยอด",
};

/** What the shop owed the dealer at the end of `asOf` (inclusive), ignoring voided rows. */
export function balanceAsOf(lines: DealerLedgerLine[], asOf: string): number {
  const cents = lines
    .filter((l) => l.voided_at == null && l.entry_date != null && l.entry_date <= asOf)
    .reduce((sum, l) => sum + Math.round((l.debt_change ?? 0) * 100), 0);
  return cents / 100;
}

/**
 * The statement's ยอดหนี้คงค้าง minus the system's balance on the same date. Positive means the
 * dealer says the shop owes more than the system shows. Null when the typed amount is not a number.
 */
export function statementDifference(lines: DealerLedgerLine[], asOf: string, statementBalance: string): number | null {
  const text = statementBalance.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return null;
  return (Math.round(Number(text) * 100) - Math.round(balanceAsOf(lines, asOf) * 100)) / 100;
}

/** Form check mirroring rpc_sf_dealer_record. Returns a Thai message, or null when it can be saved. */
export function dealerEntryProblem(kind: DealerEntryKind, amount: string, note: string, date: string, today: string): string | null {
  const text = amount.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) return "จำนวนเงินต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง";
  const value = Number(text);
  if (!date || date > today) return "วันที่ต้องไม่เป็นวันในอนาคต";
  if (kind === "adjustment") {
    if (value === 0) return "ยอดปรับต้องไม่เป็น 0";
    if (!note.trim()) return "การปรับยอดต้องมีเหตุผล";
    return null;
  }
  return value > 0 ? null : "จำนวนเงินต้องมากกว่า 0";
}
