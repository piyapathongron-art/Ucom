// No product photos in this shop, so every catalog type gets a line icon instead.
const PATHS = {
  all: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  phone: "M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2",
  topup: "M5 19v-3M10 19v-7M15 19V8M20 19V4",
  cable: "M8 3v4M12 3v4M6 7h8v5H6zM10 12v3a4 4 0 0 0 4 4h5",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  case: "M9 2.5h6a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3zM9 5.5h3.5V9H9z",
  film: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 10l4-4M9 15l7-7",
  headphones: "M4 15v-3a8 8 0 0 1 16 0v3M3 14h4v6H3zM17 14h4v6h-4z",
  battery: "M4 7h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM21 11v2M7 10v4M11 10v4",
  memory: "M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10 7v3M13 7v3M16 8v2",
  sim: "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8.5 11h7v6h-7zM12 11v6",
  box: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
} as const;

export type IconName = keyof typeof PATHS;

// One hue per type so the cashier can find a group by colour before reading.
export const ICON_TONE: Record<IconName, string> = {
  all: "bg-sunken text-ink-muted",
  phone: "bg-tone-sky/15 text-tone-sky",
  topup: "bg-accent/15 text-accent",
  cable: "bg-tone-orange/15 text-tone-orange",
  plug: "bg-tone-amber/15 text-tone-amber",
  case: "bg-tone-violet/15 text-tone-violet",
  film: "bg-tone-teal/15 text-tone-teal",
  headphones: "bg-tone-pink/15 text-tone-pink",
  battery: "bg-tone-green/15 text-tone-green",
  memory: "bg-tone-indigo/15 text-tone-indigo",
  sim: "bg-tone-rose/15 text-tone-rose",
  box: "bg-sunken text-ink-muted",
};

// Order matters: "สายชาร์จ" must hit cable before "ชาร์จ" hits plug.
const CATEGORY_KEYWORDS: [string, IconName][] = [
  ["สาย", "cable"],
  ["ชาร์จ", "plug"],
  ["เคส", "case"],
  ["ฟิล์ม", "film"],
  ["หูฟัง", "headphones"],
  ["แบต", "battery"],
  ["พาวเวอร์", "battery"],
  ["เมม", "memory"],
  ["แฟลช", "memory"],
  ["ซิม", "sim"],
];

// ponytail: keyword match on the category name — add an icon column to categories if owners start naming freely.
export function iconForCategory(name: string | null | undefined): IconName {
  return CATEGORY_KEYWORDS.find(([keyword]) => name?.includes(keyword))?.[1] ?? "box";
}

export function CategoryIcon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
