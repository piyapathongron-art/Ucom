import { digestFlex, type DigestData } from "./digestFlex";

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
