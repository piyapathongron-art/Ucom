export function lineAppUrl(): string | null {
  const host = process.env.LINE_APP_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) return null;
  try {
    const url = new URL(host.includes("://") ? host : `https://${host}`);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}
