import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";
import { createClient } from "@/lib/supabase/server";

const staffLinks = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/stock", label: "สต็อก" },
  { href: "/repairs", label: "งานซ่อม" },
  { href: "/close-day", label: "ปิดร้าน" },
  { href: "/sf-commissions", label: "ค่าคอม SF+" },
];

const ownerOnlyLinks = [
  { href: "/report", label: "รายงาน" },
  { href: "/expenses", label: "รายจ่าย" },
  { href: "/settings", label: "ตั้งค่า" },
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
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isOwner = profile?.role === "owner";
  }
  const links = isOwner ? [...staffLinks, ...ownerOnlyLinks] : staffLinks;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar links={links} onLogout={logout} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
