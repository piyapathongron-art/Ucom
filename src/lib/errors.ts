// Only Thai messages we raise ourselves in RPCs (plpgsql RAISE EXCEPTION => SQLSTATE P0001, or
// 22023 for invalid input) are safe to show; a 22023 message must START with Thai, so Postgres' own English
// text that merely echoes a Thai value stays hidden; anything else may leak schema/DB detail (never render raw error.message).
export const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";

const THAI = /[฀-๿]/;
const THAI_START = /^[฀-๿]/;

export function toThaiError(error: unknown): string {
  if (typeof error !== "object" || error === null) return GENERIC_ERROR;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof message !== "string") return GENERIC_ERROR;
  return (code === "P0001" && THAI.test(message)) || (code === "22023" && THAI_START.test(message)) ? message : GENERIC_ERROR;
}
