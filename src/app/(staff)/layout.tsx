import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";
import { buildNavLinks } from "@/app/_components/navLinks";
import { createClient } from "@/lib/supabase/server";

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  // Owner-only pages live under a separate route group with its own layout, so an
  // owner browsing a (staff) page (e.g. /pos, /consignments) would otherwise lose
  // the รายงาน/รายรับ–รายจ่าย/ตั้งค่า links until they navigate to one of those pages directly.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isOwner = false;
  let displayName = "ผู้ใช้งาน";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", user.id)
      .single();
    isOwner = profile?.role === "owner";
    displayName = profile?.display_name || displayName;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavBar links={buildNavLinks(isOwner)} onLogout={logout} displayName={displayName} role={isOwner ? "เจ้าของร้าน" : "พนักงาน"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
