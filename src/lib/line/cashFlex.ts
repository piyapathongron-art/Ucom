import type { CashSnapshot } from "@/lib/cash/types";
import { digestFlex } from "./digestFlex.ts";

export type DepositSnapshot = CashSnapshot & {
  selectedLines?: { key: string; receiptDay: string | null; kind: string; amount: string }[];
  selectedTotal?: string; drawerBeforeDeparture?: string; bankBound?: string;
  custodian?: string; reporter?: string; reporterName?: string;
  eventOperationId?: string; handoverId?: string; state?: string;
};
const reviewStates: Record<string, string> = { handed_over: "อยู่กับผู้นำฝาก", reported: "รอเจ้าของตรวจหลักฐาน", confirmed: "เจ้าของยืนยันแล้ว", disputed: "หลักฐานต้องแก้ไข", returned: "คืนเงินนำฝากแล้ว" };
function dayLabel(day: string | null, kind: string) {
  return day ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : kind === "opening" ? "ยอดตั้งต้นไม่ทราบวัน" : "ยอดปรับเงินไม่ทราบวัน";
}
function selectedRange(lines: NonNullable<DepositSnapshot["selectedLines"]>) {
  const days = lines.flatMap(line => line.receiptDay ? [line.receiptDay] : []).sort();
  if (!days.length) return "ไม่ทราบวันทั้งหมด";
  const first = days[0], last = days[days.length - 1];
  return `${dayLabel(first, "date")}${first === last ? "" : ` – ${dayLabel(last, "date")}`}${lines.some(line => !line.receiptDay) ? " · รวมยอดไม่ทราบวัน" : ""}`;
}

export function cashFlex(snapshot: DepositSnapshot, appUrl: string, title = "เงินสดร้าน", isResend = false, part?: { index: number; total: number; range: string }) {
  const row = (label: string, value: string) => ({ type: "text", text: `${label}: ${value} บาท`, size: "sm", wrap: true });
  const asOf = new Date(snapshot.asOf).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const originalSections = snapshot.daily ? digestFlex(snapshot.daily, appUrl, isResend).contents.body.contents.slice(3, -1) : [];
  const dailySections = JSON.parse(JSON.stringify(originalSections).replaceAll('"เงินออกจากลิ้นชัก"', '"รายจ่ายเงินสดวันนี้ (ทุกกอง)"')) as typeof originalSections;
  return {
    altText: `${title} · เก๊ะ ${snapshot.drawer} · รอฝาก ${snapshot.pending}`,
    contents: {
      type: "bubble", body: { type: "box", layout: "vertical", spacing: "md", contents: [
        { type: "text", text: `${title}${isResend ? " (ส่งซ้ำ)" : ""}`, weight: "bold", size: "lg", wrap: true },
        { type: "text", text: `ข้อมูล ณ ${asOf}`, size: "xs", wrap: true },
        ...(part && part.total > 1 ? [{ type: "text", text: `ส่วน ${part.index}/${part.total}`, size: "xs", wrap: true }] : []),
        ...(snapshot.state ? [{ type: "text", text: reviewStates[snapshot.state] ?? snapshot.state, size: "sm", wrap: true }] : []),
        ...(snapshot.selectedLines ? [
          { type: "text", text: `ผู้แจ้ง: ${snapshot.reporterName ?? snapshot.reporter ?? "—"} · ผู้นำฝาก: ${snapshot.custodian ?? "—"}`, size: "sm", wrap: true },
          { type: "text", text: "เงินที่เลือกจากวันที่ (รวมเศษเข้าเก๊ะ)", size: "sm", weight: "bold", wrap: true },
          { type: "text", text: part?.range ?? selectedRange(snapshot.selectedLines), size: "sm", wrap: true },
          ...snapshot.selectedLines.map(line => row(dayLabel(line.receiptDay, line.kind), line.amount)),
          row("ยอดเงินที่เลือกทั้งหมด", snapshot.selectedTotal ?? "—"),
          row("เศษเข้าเก๊ะก่อนออกจากร้าน", snapshot.drawerBeforeDeparture ?? "—"),
          row("เงินที่นำออกไปฝาก", snapshot.bankBound ?? "—"),
        ] : []),
        ...(snapshot.deposit ? [
          { type: "text", text: `ผู้นำฝาก: ${snapshot.deposit.custodian}`, size: "sm", wrap: true },
          row("ฝากธนาคารจริง", snapshot.deposit.bank), row(snapshot.selectedLines ? "เศษคืนเข้าเก๊ะเพิ่มเติมหลังนำออก" : "เศษคืนเข้าเก๊ะ", snapshot.deposit.drawer), row("คืนกองรอฝาก", snapshot.deposit.returned),
          { type: "text", text: `ฝาก ณ ${new Date(snapshot.deposit.depositedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}${snapshot.state ? "" : " · รอเจ้าของตรวจหลักฐาน"}`, size: "xs", wrap: true },
        ] : []),
        row("เงินเก๊ะร้าน", snapshot.drawer), row("เงินยอดขายรอฝาก", snapshot.pending),
        row("อยู่กับผู้นำฝาก", snapshot.reserved), row("รอฝากที่ร้าน", snapshot.available),
        ...(snapshot.drawerVariance !== undefined ? [row("เก๊ะเกิน/ขาด", snapshot.drawerVariance)] : []),
        ...(snapshot.pendingVariance !== undefined ? [row("รอฝากเกิน/ขาด", snapshot.pendingVariance)] : []),
        ...(snapshot.daily ? [row("ยอดขายรวม (ทุกบิล)", snapshot.daily.salesTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 }))] : []),
        ...dailySections,
      ] },
      footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "เปิดรายการเงินสด", uri: new URL(snapshot.handoverId && /^[0-9a-f-]{36}$/i.test(snapshot.handoverId) ? `/cash?handover=${snapshot.handoverId}` : "/cash", appUrl).toString() } }] },
    },
  };
}

// LINE bubble JSON <=30 KB, altText <=400 characters; use one message/request (max 5).
// https://developers.line.biz/en/reference/messaging-api/#flex-message
export function cashMessages(snapshot: DepositSnapshot, appUrl: string, title = "เงินสดร้าน", isResend = false) {
  const groups: NonNullable<DepositSnapshot["selectedLines"]>[] = [];
  const lines = snapshot.selectedLines;
  if (lines) {
    let group: typeof lines = [];
    for (const line of lines) {
      const candidate = [...group, line];
      const size = Buffer.byteLength(JSON.stringify(cashFlex({ ...snapshot, selectedLines: candidate }, appUrl, title, isResend).contents));
      if (group.length && (candidate.length > 25 || size > 24000)) { groups.push(group); group = [line]; }
      else group = candidate;
    }
    groups.push(group);
  }
  const parts = lines ? groups : [undefined];
  return parts.map((selectedLines, index) => {
    const flex = cashFlex(lines ? { ...snapshot, selectedLines } : snapshot, appUrl, title, isResend, { index: index + 1, total: parts.length, range: lines ? selectedRange(lines) : "" });
    if (flex.altText.length > 400 || Buffer.byteLength(JSON.stringify(flex.contents)) > 30000) throw new Error("LINE message exceeds documented limits");
    return { type: "flex", ...flex };
  });
}
