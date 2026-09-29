import type { Tables } from "@/lib/types/database";

export type CaseRow = Tables<"v_pos_consignments">;
export type Direction = "out" | "in";
export type Action = "return" | "report" | "settle" | "sell" | "pay";
export type PayMethod = "cash" | "transfer";

export const statusLabel: Record<string, string> = {
  placed: "ฝากอยู่",
  reported_sold: "แจ้งขายแล้ว · รอรับเงิน",
  sold_unpaid: "ขายแล้ว · รอจ่ายเจ้าของ",
  settled: "รับเงินแล้ว",
  paid: "จ่ายเจ้าของแล้ว",
  returned: "คืนเครื่องแล้ว",
};

export const actionLabel: Record<Action, string> = {
  return: "ยืนยันคืนเครื่อง",
  report: "ยืนยันคู่ค้าแจ้งขาย",
  settle: "ยืนยันรับเงินเต็มยอด",
  sell: "ยืนยันขายและรับเงินลูกค้า",
  pay: "ยืนยันจ่ายเจ้าของเครื่อง",
};

export const money = (value: string) => (/^\d+(\.\d{1,2})?$/.test(value) ? Number(value) : NaN);
export const fmt = (value: number | null | undefined) =>
  `฿${Number(value ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type OpenValues = { imei: string; modelName: string; counterparty: string; listedPrice: number };
export type ActionValues = { salePrice: number; partnerShare: number; paymentMethod: PayMethod; receivingAccount: string };
