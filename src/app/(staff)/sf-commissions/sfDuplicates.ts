// Pure helpers for the SF intake/edit dialog: which rows repeat an IMEI inside the form,
// and which rows collide with IMEIs / an order number that already exist.
const clean = (value: string) => value.trim();

/** Row indexes whose (trimmed, non-empty) IMEI also appears on another row of the same form. */
export function findDuplicateRows(imeis: string[]): Set<number> {
  const seen = new Map<string, number[]>();
  imeis.forEach((raw, index) => {
    const imei = clean(raw);
    if (imei) seen.set(imei, [...(seen.get(imei) ?? []), index]);
  });
  return new Set([...seen.values()].filter((rows) => rows.length > 1).flat());
}

/** Thai per-row messages keyed by row index. `existing` holds IMEIs already in the shop. */
export function rowMessages(imeis: string[], existing: ReadonlySet<string>): Record<number, string> {
  const repeated = findDuplicateRows(imeis);
  const out: Record<number, string> = {};
  imeis.forEach((raw, index) => {
    const imei = clean(raw);
    if (!imei) return;
    if (repeated.has(index)) out[index] = "IMEI ซ้ำกับแถวอื่นในบิลนี้";
    else if (existing.has(imei)) out[index] = "IMEI นี้มีอยู่ในระบบแล้ว";
  });
  return out;
}
