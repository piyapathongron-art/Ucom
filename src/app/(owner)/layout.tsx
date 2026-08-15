import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";

const links = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/stock", label: "สต็อก" },
  { href: "/repairs", label: "งานซ่อม" },
  { href: "/close-day", label: "ปิดร้าน" },
  { href: "/sf-commissions", label: "ค่าคอม SF+" },
  { href: "/report", label: "รายงาน" },
  { href: "/expenses", label: "รายจ่าย" },
  { href: "/settings", label: "ตั้งค่า" },
];

export default function OwnerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar links={links} onLogout={logout} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
