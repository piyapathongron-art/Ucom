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

export type SfRowDraft = { id: string; imei: string; model: string; list: string; sale: string; locked: boolean };

/** A price typed in the form, or null when it is not a plain positive number ("13,990", "0", "abc"). */
export function positivePrice(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

/**
 * The problem with one editable row, or null when it can be saved. A brand-new row that is still
 * completely empty is skipped (null); an existing row must stay complete or be removed with ×.
 * Mirrors pos_sf_device_row_valid in SQL: IMEI and model required, SF tag price > 0, shop price
 * empty or > 0.
 */
export function sfRowProblem(row: SfRowDraft): string | null {
  if (row.locked) return null;
  const blank = !row.imei.trim() && !row.model.trim() && !row.list.trim() && !row.sale.trim();
  if (blank && !row.id) return null;
  if (!row.imei.trim() || !row.model.trim()) return row.id ? "ต้องมี IMEI และรุ่นเครื่อง หรือกด × เพื่อลบเครื่องนี้" : "ต้องมี IMEI และรุ่นเครื่อง";
  if (positivePrice(row.list) == null) return "ราคาป้าย SF ต้องเป็นตัวเลขมากกว่า 0";
  if (row.sale.trim() && positivePrice(row.sale) == null) return "ราคาขายต้องเป็นตัวเลขมากกว่า 0 หรือเว้นว่าง";
  return null;
}
