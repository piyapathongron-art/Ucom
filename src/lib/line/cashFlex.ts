import type { CashSnapshot } from "@/lib/cash/types";
import { digestFlex } from "./digestFlex.ts";

export function cashFlex(snapshot: CashSnapshot, appUrl: string, title = "เงินสดร้าน", isResend = false) {
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
        ...(snapshot.deposit ? [
          { type: "text", text: `ผู้นำฝาก: ${snapshot.deposit.custodian}`, size: "sm", wrap: true },
          row("ฝากธนาคารจริง", snapshot.deposit.bank), row("เศษคืนเข้าเก๊ะ", snapshot.deposit.drawer), row("คืนกองรอฝาก", snapshot.deposit.returned),
          { type: "text", text: `ฝาก ณ ${new Date(snapshot.deposit.depositedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · รอเจ้าของตรวจหลักฐาน`, size: "xs", wrap: true },
        ] : []),
        row("เงินเก๊ะร้าน", snapshot.drawer), row("เงินยอดขายรอฝาก", snapshot.pending),
        row("อยู่กับผู้นำฝาก", snapshot.reserved), row("รอฝากที่ร้าน", snapshot.available),
        ...(snapshot.drawerVariance !== undefined ? [row("เก๊ะเกิน/ขาด", snapshot.drawerVariance)] : []),
        ...(snapshot.pendingVariance !== undefined ? [row("รอฝากเกิน/ขาด", snapshot.pendingVariance)] : []),
        ...(snapshot.daily ? [row("ยอดขายรวม (ทุกบิล)", snapshot.daily.salesTotal.toLocaleString("th-TH", { maximumFractionDigits: 2 }))] : []),
        ...dailySections,
      ] },
      footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "เปิดรายการเงินสด", uri: new URL("/cash", appUrl).toString() } }] },
    },
  };
}
