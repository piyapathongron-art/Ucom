// Pure aggregation for the report's summary tab — kept free of React and Supabase so
// summary.check.mts can run it directly.

export const THAI_AID_ACCOUNT = "ไทยช่วยไทย";
export const CHANNELS = ["เงินสด", "โอนเงิน", THAI_AID_ACCOUNT] as const;
export type Channel = (typeof CHANNELS)[number];

export type SaleEntry = { ref_id: string | null; detail: string | null; sale_revenue: number | null };
export type SaleHeader = { id: string; receiving_account: string | null };
export type SoldItem = { product_id: string | null; name_snapshot: string | null; qty: number | null };

// ไทยช่วยไทย is a transfer into a named account (see Cart), so it is split out of โอนเงิน by account.
export function channelOf(paymentMethod: string | null, receivingAccount: string | null): Channel {
  if (receivingAccount === THAI_AID_ACCOUNT) return THAI_AID_ACCOUNT;
  return paymentMethod === "cash" ? "เงินสด" : "โอนเงิน";
}

// Totals per channel, always in CHANNELS order; the sum equals the sale revenue of the entries.
export function salesByChannel(entries: SaleEntry[], headers: SaleHeader[]): { channel: Channel; amount: number }[] {
  const accountById = new Map(headers.map((h) => [h.id, h.receiving_account]));
  const totals = new Map<Channel, number>(CHANNELS.map((c) => [c, 0]));
  for (const e of entries) {
    const channel = channelOf(e.detail, accountById.get(e.ref_id ?? "") ?? null);
    totals.set(channel, totals.get(channel)! + (e.sale_revenue ?? 0));
  }
  return CHANNELS.map((channel) => ({ channel, amount: totals.get(channel)! }));
}

export function topProducts(items: SoldItem[], limit = 5): { name: string; qty: number }[] {
  const byProduct = new Map<string, { name: string; qty: number }>();
  for (const item of items) {
    const key = item.product_id ?? item.name_snapshot ?? "";
    const current = byProduct.get(key) ?? { name: item.name_snapshot ?? "-", qty: 0 };
    current.qty += item.qty ?? 0;
    byProduct.set(key, current);
  }
  return [...byProduct.values()]
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "th"))
    .slice(0, limit);
}

// null when there is nothing to compare against (no earlier sales, or the lookup failed)
export function changeText(current: number, previous: number | null, isSingleDay: boolean): { text: string; isUp: boolean } | null {
  if (previous === null || previous <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  // a comparison against a near-empty period reads as noise, so the figure stops at 999%
  const size = Math.abs(pct) > 999 ? "999%+" : `${Math.abs(pct)}%`;
  return { text: `${pct >= 0 ? "+" : "−"}${size} จาก${isSingleDay ? "เมื่อวาน" : "ช่วงก่อนหน้า"}`, isUp: pct >= 0 };
}

// #0092 style; numbers past 9999 simply grow.
export function billLabel(billNo: number | null | undefined): string {
  return billNo == null ? "-" : `#${String(billNo).padStart(4, "0")}`;
}
