import { createHash } from "node:crypto";
import { digestFlex, type DigestData } from "./digestFlex.ts";
import { cashMessages, type DepositSnapshot } from "./cashFlex.ts";
import { lineAppUrl } from "./app-url.ts";

export function cashPartRetryKey(event: string, part: number) {
  const bytes = createHash("sha256").update(`ucom-line-cash-v1:${event}:${part}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function pushCashSnapshot(snapshot: DepositSnapshot, title = "เงินสดร้าน", isResend = false, retryKey?: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;
  const appUrl = lineAppUrl();
  if (!token || !groupId || !appUrl) return false;
  try {
    const eventTitles: Record<string, string> = { handover_days: "นำเงินออกไปฝาก", settle: "แจ้งฝากเงิน", return: "คืนเงินนำฝาก", review: "ผลตรวจหลักฐาน", evidence: "ส่งหลักฐานแก้ไข" };
    // Same event/part key must carry identical content even on recovery/resend.
    const messages = cashMessages(snapshot, appUrl, snapshot.eventOperationId ? eventTitles[snapshot.event ?? ""] ?? "เงินสดร้าน" : title, snapshot.eventOperationId ? false : isResend);
    for (const [part, message] of messages.entries()) {
    const key = cashPartRetryKey(snapshot.eventOperationId ?? retryKey ?? snapshot.id, part);
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Line-Retry-Key": key },
      body: JSON.stringify({ to: groupId, messages: [message] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok && !(response.status === 409 && response.headers.has("x-line-accepted-request-id"))) return false;
    }
    return true;
  } catch { return false; }
}

export async function pushCloseDayDigest(data: DigestData, isResend = false) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;
  const appHost = process.env.LINE_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!token || !groupId || !appHost) return false;

  try {
    const appUrl = appHost.startsWith("http") ? appHost : `https://${appHost}`;
    const message = { type: "flex", ...digestFlex(data, appUrl, isResend) };
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: groupId, messages: [message] }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
