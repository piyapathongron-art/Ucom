export function validLiffId(value: string | undefined): string | null {
  return value && /^[0-9]+-[A-Za-z0-9]+$/.test(value) ? value : null;
}

export function depositEntryUrl(id: string | undefined, origin: string | null): string | null {
  if (id !== undefined && id !== "") {
    const valid = validLiffId(id);
    return valid ? `https://liff.line.me/${valid}` : null;
  }
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && !url.username && !url.password
      ? new URL("/cash?intent=deposit", url).toString()
      : null;
  } catch { return null; }
}
