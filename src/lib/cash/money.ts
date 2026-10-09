export function parseMoney(raw: string, signed = false): string {
  const value = raw.trim();
  if (!(signed ? /^-?\d+(?:\.\d{1,2})?$/ : /^\d+(?:\.\d{1,2})?$/).test(value)) {
    throw new Error("กรอกจำนวนเงินเป็นบาท ทศนิยมไม่เกิน 2 ตำแหน่ง");
  }
  const isNegative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt("999999999999")) throw new Error("จำนวนเงินเกินขอบเขตที่รองรับ");
  return `${isNegative && cents !== BigInt(0) ? "-" : ""}${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}

export function moneyCents(raw: string): bigint {
  return BigInt(parseMoney(raw, true).replace(".", ""));
}

export const formatMoney = (raw: string) => Number(parseMoney(raw, true)).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
