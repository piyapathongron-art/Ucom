import { createHmac, timingSafeEqual } from "node:crypto";

type JoinEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; groupId?: string };
};

export async function POST(request: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) return new Response(null, { status: 503 });

  const body = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  const expected = createHmac("sha256", secret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return new Response(null, { status: 401 });
  }

  let events: JoinEvent[];
  try {
    const payload = JSON.parse(body) as { events?: JoinEvent[] };
    events = Array.isArray(payload.events) ? payload.events : [];
  } catch {
    return new Response(null, { status: 400 });
  }

  for (const event of events) {
    if (event.type !== "join" || event.source?.type !== "group" || !event.source.groupId || !event.replyToken) continue;
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text: `LINE_GROUP_ID=${event.source.groupId}` }] }),
      signal: AbortSignal.timeout(10000),
    });
  }
  return new Response("OK");
}
