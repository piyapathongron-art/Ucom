export type NavLink = { href: string; label: string; icon: string };

const mainLinks: NavLink[] = [
  { href: "/pos", label: "ขายสินค้า", icon: "pos" },
  { href: "/stock", label: "สต็อก/เครื่อง", icon: "stock" },
  { href: "/repairs", label: "งานซ่อม", icon: "repair" },
  { href: "/consignments", label: "ฝากขาย & SF+", icon: "consignment" },
  { href: "/topup", label: "เติมเงิน", icon: "topup" },
];

// Owner-only entries: report + ledger sit with the main list, settings sits in the footer group.
export function buildNavLinks(isOwner: boolean) {
  const main = isOwner
    ? [...mainLinks, { href: "/report", label: "รายงาน", icon: "report" }, { href: "/expenses", label: "รายรับ–รายจ่าย", icon: "expense" }]
    : mainLinks;
  const footer: NavLink[] = [{ href: "/close-day", label: "ปิดร้าน", icon: "close" }];
  if (isOwner) footer.push({ href: "/settings", label: "ตั้งค่า", icon: "settings" });
  return { main, footer };
}
