import { safeReturnPath } from "./safe-return.ts";

export function loginErrorPath(value: unknown, error: "missing" | "invalid"): string {
  const next = safeReturnPath(value);
  return next === "/liff/deposit"
    ? `/liff/deposit?error=${error}`
    : `/login?error=${error}&next=${encodeURIComponent(next)}`;
}
