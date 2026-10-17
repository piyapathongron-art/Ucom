import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { CashSnapshot } from "@/lib/cash/types";
import { pushCashSnapshot } from "@/lib/line/push";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (!secret || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Not configured" }, { status: 503 });
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("rpc_cash_reminder_claim", { p_now: new Date().toISOString() });
  if (error) return Response.json({ error: "Reminder unavailable" }, { status: 503 });
  if (!data) return Response.json({ sent: false, reason: "Not due" });
  const claim = data as unknown as { id: string; retryKey: string; snapshot: CashSnapshot };
  const sent = await pushCashSnapshot(claim.snapshot, "เตือนนำเงินฝากธนาคาร", false, claim.retryKey);
  const { error: finishError } = await supabase.rpc("rpc_cash_reminder_finish", { p_id: claim.id, p_sent: sent });
  return Response.json({ sent, recorded: !finishError }, { status: sent && !finishError ? 200 : 503 });
}
