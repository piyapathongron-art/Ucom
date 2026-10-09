const DEFINITE_CODES = new Set(["P0001", "22023", "22003", "23502", "23503", "23505", "23514", "40001", "40P01"]);

// Missing/connection/HTTP errors leave the original operation available for replay.
export function isDefiniteCashError(error: { code?: string; message?: string }): boolean {
  return typeof error.code === "string" && DEFINITE_CODES.has(error.code);
}
