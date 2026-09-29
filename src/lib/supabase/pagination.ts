export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  return { from, to: from + safePageSize - 1 };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

// PostgREST caps one response (1000 rows by default); a money total must see every row,
// so keep asking for the next window until one comes back short. The query must be ordered.
export async function fetchAllPages<T>(
  window: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await window(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

export function escapedSearchTerm(value: string): string {
  return value.trim().replace(/[\\%_,()]/g, (character) => `\\${character}`);
}

export function orIlike(fields: string[], value: string): string | null {
  const term = escapedSearchTerm(value);
  if (!term) return null;
  return fields.map((field) => `${field}.ilike.%${term}%`).join(",");
}
