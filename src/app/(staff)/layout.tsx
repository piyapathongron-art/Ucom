import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";
import { createClient } from "@/lib/supabase/server";

const staffLinks = [
  { href: "/pos", label: "หน้าขาย", icon: "pos" },
  { href: "/stock", label: "สต็อก", icon: "stock" },
  { href: "/repairs", label: "งานซ่อม", icon: "repair" },
  { href: "/close-day", label: "ปิดร้าน", icon: "close" },
  { href: "/sf-commissions", label: "ค่าคอม SF+", icon: "commission" },
  { href: "/topup", label: "เติมเงิน", icon: "topup" },
  { href: "/consignments", label: "ฝากขาย", icon: "consignment" },
];

const ownerOnlyLinks = [
  { href: "/report", label: "รายงาน", icon: "report" },
  { href: "/expenses", label: "รายจ่าย", icon: "expense" },
  { href: "/settings", label: "ตั้งค่า", icon: "settings" },
];

export default async function StaffLayout({ children }: LayoutProps<"/">) {
  // Owner-only pages live under a separate route group with its own layout, so an
  // owner browsing a (staff) page (e.g. /pos, /sf-commissions) would otherwise lose
  // the รายงาน/รายจ่าย/ตั้งค่า links until they navigate to one of those pages directly.
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
  const links = isOwner ? [...staffLinks, ...ownerOnlyLinks] : staffLinks;

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavBar links={links} onLogout={logout} displayName={displayName} role={isOwner ? "เจ้าของร้าน" : "พนักงาน"} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
