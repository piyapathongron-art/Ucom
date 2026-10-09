export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\s\x00-\x1f]/.test(value)) return "/";
  try {
    const parsed = new URL(value, "https://ucom.invalid");
    if (parsed.origin !== "https://ucom.invalid" || /^\/(?:login|api)(?:\/|$)/.test(parsed.pathname)) return "/";
    return `${parsed.pathname}${parsed.search}`;
  } catch { return "/"; }
}
