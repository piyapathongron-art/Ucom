import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "./route.ts";

process.env.LINE_CHANNEL_SECRET = "test-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
process.env.LINE_GROUP_ID = "Ctest";
process.env.LINE_APP_URL = "https://ucom.example";
delete process.env.LINE_LIFF_ID;
const body = JSON.stringify({ events: [{ type: "join", replyToken: "reply-1", source: { type: "group", groupId: "Ctest" } }] });
const oldFetch = globalThis.fetch;
let sentBody = "";
globalThis.fetch = async (_url, options) => {
  sentBody = String(options?.body);
  return new Response("OK");
};

try {
  assert.equal((await POST(new Request("https://example.com/api/line/webhook", { method: "POST", body }))).status, 401);
  assert.equal(sentBody, "");
  const signature = createHmac("sha256", "test-secret").update(body).digest("base64");
  const response = await POST(new Request("https://example.com/api/line/webhook", {
    method: "POST", body, headers: { "x-line-signature": signature },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(sentBody).messages, [{ type: "text", text: "LINE_GROUP_ID=Ctest" }]);
  async function signed(payload: unknown) {
    const text = JSON.stringify(payload);
    return POST(new Request("https://evil.example/api/line/webhook", { method: "POST", body: text, headers: { "x-line-signature": createHmac("sha256", "test-secret").update(text).digest("base64") } }));
  }
  const command = { type: "message", replyToken: "r", source: { type: "group", groupId: "Ctest" }, message: { type: "text", text: " /ฝากเงิน " } };
  assert.equal((await signed({ events: [command] })).status, 200);
  assert.ok(sentBody.includes("https://ucom.example/cash?intent=deposit"));
  assert.ok(!sentBody.includes("evil.example"));
  process.env.LINE_LIFF_ID = "1234567890-AbC123";
  assert.equal((await signed({ events: [command] })).status, 200);
  assert.ok(sentBody.includes("https://liff.line.me/1234567890-AbC123"));
  process.env.LINE_LIFF_ID = "https://evil.example";
  sentBody = "";
  assert.equal((await signed({ events: [command] })).status, 503);
  assert.equal(sentBody, "");
  delete process.env.LINE_LIFF_ID;
  await signed({ events: [command] });
  const original = sentBody;
  await signed({ events: [command], deliveryContext: { isRedelivery: true } });
  assert.equal(sentBody, original);
  for (const event of [null, 4, { ...command, source: { type: "group", groupId: "wrong" } }, { ...command, source: { type: "user" } }, { ...command, replyToken: undefined }, { ...command, message: { type: "text", text: "/ฝากเงิน 100" } }, { ...command, message: { type: "image" } }]) {
    sentBody = ""; await signed({ events: [event] }); assert.equal(sentBody, "");
  }
  for (const payload of [null, {}, { events: "invalid" }]) assert.equal((await signed(payload)).status, 400);
  process.env.LINE_APP_URL = "https://user:password@evil.example";
  assert.equal((await signed({ events: [command] })).status, 503);
  console.log("route.check ok");
} finally {
  globalThis.fetch = oldFetch;
}
