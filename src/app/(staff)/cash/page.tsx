import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CashStatus } from "@/lib/cash/types";
import CashOverview from "./cash-overview";

export default async function CashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fcash");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["owner", "staff"].includes(profile.role)) return <main className="p-6">บัญชีนี้ไม่มีสิทธิ์เข้าระบบร้าน</main>;
  const { data, error } = await supabase.rpc("rpc_cash_status");
  if (error || !data) return <main className="p-6"><h1 className="text-xl font-bold">เงินสดร้าน</h1><p role="alert" className="mt-4">ระบบสองกองเงินยังไม่พร้อมใช้งาน กรุณาติดต่อเจ้าของร้าน</p></main>;
  return <CashOverview status={data as unknown as CashStatus} />;
}
