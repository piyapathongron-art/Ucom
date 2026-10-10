import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CashStatus, CashHandover } from "@/lib/cash/types";
import CashOverview from "./cash-overview";
import CashDeposit from "./cash-deposit";

export default async function CashContent({ searchParams, isCompact = false }: {
  searchParams: Promise<{ handover?: string }>; isCompact?: boolean;
}) {
  const { handover } = await searchParams;
  const isUuid = Boolean(handover && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(handover));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(isUuid ? `/cash?handover=${handover}` : "/cash")}`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["owner", "staff"].includes(profile.role)) return <main className="p-6">บัญชีนี้ไม่มีสิทธิ์เข้าระบบร้าน</main>;
  const { data, error } = await supabase.rpc("rpc_cash_status");
  if (error || !data) return <main className="p-6"><h1 className="text-xl font-bold">เงินสดร้าน</h1><p role="alert" className="mt-4">ระบบสองกองเงินยังไม่พร้อมใช้งาน กรุณาติดต่อเจ้าของร้าน</p></main>;
  const specific = isUuid ? await supabase.rpc("rpc_cash_handover", { p_handover_id: handover! }) : null;
  if (isCompact) return <CashDeposit status={data as unknown as CashStatus} />;
  return <CashOverview status={data as unknown as CashStatus} focusedHandover={specific?.data as unknown as CashHandover | null} focusError={handover && (!isUuid || specific?.error || !specific?.data) ? "เปิดรายการนี้ไม่ได้ กรุณาตรวจลิงก์และสิทธิ์บัญชี" : undefined} />;
}
