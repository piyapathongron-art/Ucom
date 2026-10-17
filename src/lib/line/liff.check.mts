import assert from "node:assert/strict";
import { depositEntryUrl, validLiffId } from "./liff.ts";
import { loginErrorPath } from "../login-return.ts";

assert.equal(validLiffId("1234567890-AbC123"), "1234567890-AbC123");
assert.equal(depositEntryUrl("1234567890-AbC123", null), "https://liff.line.me/1234567890-AbC123");
for (const value of [" 123-AbC", "123-AbC ", "123-AbC\n", "https://evil.example", "123-AbC/evil", "123-AbC?x=1", "123-AbC#x", "123-AbC@evil", "abc-def", "123-"]) {
  assert.equal(validLiffId(value), null);
  assert.equal(depositEntryUrl(value, "https://ucom.example"), null);
}
for (const value of [undefined, ""]) assert.equal(depositEntryUrl(value, "https://ucom.example"), "https://ucom.example/cash?intent=deposit");
for (const origin of [null, "http://ucom.example", "https://user:pass@ucom.example", "bad"]) assert.equal(depositEntryUrl(undefined, origin), null);
for (const error of ["missing", "invalid"] as const) {
  assert.equal(loginErrorPath("/liff/deposit", error), `/liff/deposit?error=${error}`);
  assert.equal(loginErrorPath("/cash?intent=deposit", error), `/login?error=${error}&next=%2Fcash%3Fintent%3Ddeposit`);
  assert.equal(loginErrorPath("https://evil.example", error), `/login?error=${error}&next=%2F`);
}
console.log("liff.check ok");
