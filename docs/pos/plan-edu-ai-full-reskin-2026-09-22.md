# Plan — full edu.ai visual reskin from Ucom POS artifact

Source: Artifact `https://claude.ai/artifact/4BDXA2i3PSwB4zmwWBHGpQ` (Design canvas, 8 screens × owner/staff, `project/ds/eduai/tokens.json`).

## Decisions locked with user (2026-09-22)

- **Scope: all 8 screens**, including Consignment and Topup which have no route yet.
- **Layout strategy: keep responsive** (mobile-first cards/stacks). The mockup is a fixed 1440px desktop layout — we adapt its visual language (color, spacing, radius, badges, buttons, table/list patterns) into the existing responsive components, not a literal pixel port. Desktop breakpoints may gain the denser table look; mobile keeps cards.
- **Consignment/Topup: UI shell only**, kept as `disabled`/"coming soon" like today. No RPC, no business logic. Consignment carries real cash/stock rules (see mockup's own note: "ฝากขายเป็นสถานะของเครื่อง... ไม่ต้องกำหนดส่วนแบ่งตอนฝาก") that need a `grill-with-docs` + ADR pass before anyone wires logic — out of scope here.

## Design vocabulary confirmed (already matches `globals.css` from ADR 0020)

Colors match exactly: `surface #1e1d27`, `sunken #111016`, `border #2b2937`, `border-strong #3a3847`, `ink #f2f1f8`, `ink-muted #a19dae`, `accent #ddff8d`, `success #4ade80`, `warning #fcd34d`. No token changes needed.

Recurring component patterns to introduce/extend in `globals.css` + `ucom-*` utility classes:
- **Status pill badges**: `border-radius: 999px`, `padding: 3px 10px`, `font: 11px/600`, bg+fg pairs — success (`#0f3322`/`#4ade80`), warning (`#392a0c`/`#fcd34d`), neutral (`sunken` bg + `border-strong` border + `ink-muted` text).
- **Segmented pill tabs**: `sunken` track, active segment `#2c2a38` bg + white text.
- **Icon chips**: 32–40px rounded-square, tinted background per item type (device/product category), emoji or stroke icon.
- **Card container**: `surface` bg, `radius-xl` (20px), soft shadow, replaces flatter current cards for panels (cart, closing panels, wallet tiles).
- **Stat tile**: `surface` bg, **dashed** border (not solid), `radius-lg` (16px), label/value/delta stack.
- **Table header row**: `sunken` bg, uppercase 11px label, bottom border — used in Stock/Repair/Consignment/Topup desktop tables (already close in `.ucom-table`).
- **Primary pill CTA**: `accent` bg, dark text, fully rounded, bold.
- **Sidebar active-item chip**: active nav item gets an accent-colored icon chip, not just a text color change (current `NavBar.tsx` only changes bg/text, no chip).

## Per-screen mapping

| Mockup | Target in repo | Current state | Work |
|---|---|---|---|
| Sidebar | [NavBar.tsx](../../src/app/_components/NavBar.tsx) | Close but no icon chip on active item, no dashed separator before ปิดร้าน | Small tweak |
| Main (POS) | [pos/Cart.tsx](../../src/app/(staff)/pos/Cart.tsx), [pos/Catalog.tsx](../../src/app/(staff)/pos/Catalog.tsx), [pos/page.tsx](../../src/app/(staff)/pos/page.tsx) | Functional, different visual detail (device row badges, cart line layout, payment method pills) | Medium restyle |
| Stock | [stock/StockRowCard.tsx](../../src/app/(staff)/stock/StockRowCard.tsx), [stock/StockTable.tsx](../../src/app/(staff)/stock/StockTable.tsx) | Functional; needs status-pill + filter-chip parity | Medium restyle |
| Repair | [repairs/page.tsx](../../src/app/(staff)/repairs/page.tsx) | Never restyled (not in git status diff) | Full restyle |
| Closing | [close-day/page.tsx](../../src/app/(staff)/close-day/page.tsx) | Partially restyled (in diff already) | Verify + finish parity (stat tiles, checklist styling) |
| Reports | [report/page.tsx](../../src/app/(owner)/report/page.tsx) | Never restyled | Full restyle |
| Reports-Bills | no current route (bills list) — check if covered inside report/page.tsx tabs | TBD | Investigate first |
| Consignment | new route `(staff)/consignment` or extend sf-commissions | Doesn't exist; SF-commissions is the closest existing concept | Build static shell only |
| Topup | new route `(staff)/topup` | Doesn't exist, disabled in NavBar | Build static shell only |

## Execution order (staged, one checkpoint per stage — not one giant diff)

1. Sidebar/NavBar chip parity + shared `globals.css` additions (pill badges, dashed stat tile, table header helpers).
2. POS (Cart + Catalog).
3. Stock (RowCard + Table).
4. Repair.
5. Closing (finish) + Reports + Reports-Bills (after confirming its current location).
6. Consignment + Topup static shells.

Each stage: edit → `npm run lint` + `tsc --noEmit` → browser check (ask permission per working agreement §3) → report, before starting the next stage. Existing e2e tests (`tests/e2e/*.spec.ts`) must keep passing — visual class changes only, no `data-testid`/text changes unless a test also needs updating (flag, don't change silently).

## Explicitly not doing

- No fixed 1440px desktop rewrite.
- No Consignment/Topup RPC, DB, or business logic.
- No touching Supabase/migrations.
