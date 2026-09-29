// Only Thai messages we raise ourselves in RPCs (plpgsql RAISE EXCEPTION => SQLSTATE P0001)
// are safe to show; anything else may leak schema/DB detail (never render raw error.message).
export const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const THAI = /[฀-๿]/;

export function toThaiError(error: unknown): string {
  if (typeof error !== "object" || error === null) return GENERIC_ERROR;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "P0001" && typeof message === "string" && THAI.test(message) ? message : GENERIC_ERROR;
}
