import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "./route.ts";

process.env.LINE_CHANNEL_SECRET = "test-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-token";
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
  console.log("route.check ok");
} finally {
  globalThis.fetch = oldFetch;
}
