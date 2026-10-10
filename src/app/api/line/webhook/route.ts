import { createHmac, timingSafeEqual } from "node:crypto";
import { lineAppUrl } from "../../../../lib/line/app-url.ts";
import { depositEntryUrl } from "../../../../lib/line/liff.ts";

type JoinEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; groupId?: string };
  message?: { type?: string; text?: string };
};

export async function POST(request: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) return new Response(null, { status: 503 });

  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-line-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest();
  const received = Buffer.from(signature, "base64");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return new Response(null, { status: 401 });
  }

  let events: JoinEvent[];
  try {
    const body = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    const payload = JSON.parse(body) as { events?: JoinEvent[] };
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.events)) return new Response(null, { status: 400 });
    events = payload.events;
  } catch {
    return new Response(null, { status: 400 });
  }

  for (const event of events) {
    if (!event || typeof event !== "object" || event.source?.type !== "group" || typeof event.source.groupId !== "string" || typeof event.replyToken !== "string" || !event.replyToken) continue;
    let messages;
    if (event.type === "join") messages = [{ type: "text", text: `LINE_GROUP_ID=${event.source.groupId}` }];
    else {
      if (event.type !== "message" || event.message?.type !== "text" || typeof event.message.text !== "string" || event.message.text.trim() !== "/ฝากเงิน" || !process.env.LINE_GROUP_ID || event.source.groupId !== process.env.LINE_GROUP_ID) continue;
      const uri = depositEntryUrl(process.env.LINE_LIFF_ID, lineAppUrl());
      if (!uri) return new Response(null, { status: 503 });
      messages = [{ type: "flex", altText: "ฝากเงินร้าน · เปิดฟอร์ม", contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "ฝากเงินร้าน", weight: "bold" }, { type: "text", text: "เปิดฟอร์มและเข้าสู่ระบบด้วยบัญชีร้าน เพื่อเลือกวันและแจ้งผลฝากพร้อมสลิป", wrap: true }] }, footer: { type: "box", layout: "vertical", contents: [{ type: "button", action: { type: "uri", label: "เปิดฟอร์มฝากเงิน", uri } }] } } }];
    }
    try {
      const response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ replyToken: event.replyToken, messages }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return new Response(null, { status: 502 });
    } catch { return new Response(null, { status: 502 }); }
  }
  return new Response("OK");
}
