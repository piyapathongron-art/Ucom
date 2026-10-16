import { moneyCents, parseMoney } from "./money.ts";
import type { CashDayLine } from "./types";
export function lineDayLabel(line: Pick<CashDayLine, "receiptDay" | "kind">) {
  if (line.receiptDay) return new Date(`${line.receiptDay}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  return line.kind === "opening" ? "ยอดตั้งต้นไม่ทราบวัน" : "ยอดปรับจากการนับไม่ทราบวัน";
}
export function selectionAmounts(lines: CashDayLine[], keys: string[], drawer: string) {
  if (new Set(keys).size !== keys.length) throw new Error("เลือกวันซ้ำ");
  const chosen = keys.map(key => { const line = lines.find(item => item.key === key); if (!line || moneyCents(line.available) <= BigInt(0)) throw new Error("วันนั้นไม่มีเงินที่ร้านพร้อมนำฝาก"); return line; });
  const total = chosen.reduce((sum, line) => sum + moneyCents(line.available), BigInt(0));
  const preDrawer = moneyCents(parseMoney(drawer));
  if (preDrawer < BigInt(0) || preDrawer >= total) throw new Error("เศษเข้าเก๊ะต้องน้อยกว่ายอดที่เลือก");
  const decimal = (value: bigint) => `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
  return { selectedTotal: decimal(total), bankBound: decimal(total - preDrawer), lines: chosen.map(line => ({ key: line.key, amount: parseMoney(line.available) })) };
}
