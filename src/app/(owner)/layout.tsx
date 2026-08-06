import Link from "next/link";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/stock", label: "สต็อก" },
  { href: "/repairs", label: "งานซ่อม" },
  { href: "/report", label: "รายงาน" },
  { href: "/settings", label: "ตั้งค่า" },
];

export default function OwnerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="flex items-center gap-4 border-b border-neutral-200 px-4 py-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="font-medium">
            {l.label}
          </Link>
        ))}
        <form action={logout} className="ml-auto">
          <button type="submit" className="text-neutral-500">
            ออกจากระบบ
          </button>
        </form>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
