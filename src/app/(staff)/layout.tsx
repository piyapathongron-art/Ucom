import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";

const links = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/stock", label: "สต็อก" },
  { href: "/repairs", label: "งานซ่อม" },
  { href: "/close-day", label: "ปิดร้าน" },
];

export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavBar links={links} onLogout={logout} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
