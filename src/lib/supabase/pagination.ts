export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  return { from, to: from + safePageSize - 1 };
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function escapedSearchTerm(value: string): string {
  return value.trim().replace(/[\\%_,()]/g, (character) => `\\${character}`);
}

export function orIlike(fields: string[], value: string): string | null {
  const term = escapedSearchTerm(value);
  if (!term) return null;
  return fields.map((field) => `${field}.ilike.%${term}%`).join(",");
}
