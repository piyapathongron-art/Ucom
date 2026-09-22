import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";
import { createClient } from "@/lib/supabase/server";

const links = [
  { href: "/pos", label: "หน้าขาย", icon: "pos" },
  { href: "/stock", label: "สต็อก", icon: "stock" },
  { href: "/repairs", label: "งานซ่อม", icon: "repair" },
  { href: "/close-day", label: "ปิดร้าน", icon: "close" },
  { href: "/sf-commissions", label: "ค่าคอม SF+", icon: "commission" },
  { href: "/topup", label: "เติมเงิน", icon: "topup" },
  { href: "/consignments", label: "ฝากขาย", icon: "consignment" },
  { href: "/report", label: "รายงาน", icon: "report" },
  { href: "/expenses", label: "รายจ่าย", icon: "expense" },
  { href: "/settings", label: "ตั้งค่า", icon: "settings" },
];

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavBar links={links} onLogout={logout} displayName={profile?.display_name || "เจ้าของร้าน"} role="เจ้าของร้าน" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
