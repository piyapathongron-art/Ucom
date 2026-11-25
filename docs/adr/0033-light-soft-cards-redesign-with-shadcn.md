# ADR 0033: Light "soft cards" redesign on shadcn/ui, with a limited mobile POS

Status: Accepted product decision on 2026-11-24; design approved, implementation not started.

Supersedes parts of [ADR 0015](0015-receipt-direction-and-desktop-first-responsive.md), [ADR 0018](0018-uxui-redesign-v2-direction.md), [ADR 0019](0019-dim-indigo-theme.md) and [ADR 0020](0020-edu-ai-dark-lime-redesign.md). See "What this replaces" below for the exact parts.

## Context

The current UI uses the dark-lime system from ADR 0020: dark neutral layers, a lime `#ddff8d` primary, Inter with Noto Sans Thai, and `/pos` blocked below 1024px ("หน้าขายต้องใช้จอกว้างขึ้น"). The owner went through a design grilling session and asked for a full redesign of the look and the UX, not a re-skin.

The approved design is a design canvas artifact: <https://claude.ai/artifact/N2vy7A6ETGcCCWwxWxoj3b>. It has 40 artboards across 13 pages, one page per route. Each page shows the full flow with the field labels, statuses and Thai error messages taken from the current code.

An earlier audit of the current UI found problems the rollout must fix:

- about 26 inputs that have only a placeholder and no label;
- no app-level `error.tsx`, `not-found.tsx` or `global-error.tsx`;
- `--color-ink-faint` (`#6b687a` on `#15141b`) at about 3.1:1 contrast, below WCAG AA for text;
- 104 arbitrary text sizes such as `text-[13.5px]`;
- 28px tap targets in `QtyStepper`.

## Decision

1. **Redesign the look as well as the UX.** The canvas is the visual and flow authority for every route. This is not a token swap on top of the current pages.
2. **Light base.** Page background `#f3f4f8`, white cards. There is still no dark mode and no theme toggle.
3. **Brand blue `#1d4ed8`** for the primary action, the active navigation item, focus rings and links. It is not used for statuses.
4. **"Soft cards" style:**
   - white cards with a 20–24px radius on the `#f3f4f8` background;
   - pill-shaped buttons;
   - interactive controls (buttons, inputs, selects, steppers, nav items) at least 40px tall, 44px on touch-first screens (mobile POS, LIFF).
5. **Adopt shadcn/ui** as the component base (generated into the repo, built on Radix primitives and Tailwind v4). This reverses the "no UI dependency" rule that ADR 0018 carried over from ADR 0015.
6. **Scope:** the canvas covers every route. The first rollout covers the shell (navigation and layout), `/login`, `/pos`, `/stock`, `/close-day` and `/report`, starting with the shell and `/pos`. Other routes follow page by page.
7. **POS on mobile, in a limited form.** Below `lg`, `/pos` supports search, cart and checkout. Selling a device on an SF installment and per-line discounts stay on large screens. On a small screen they are shown as unavailable with the reason, never as dead controls. This replaces the "mobile is a reading screen" rule of ADR 0015 and the "`/pos` unavailable below 1024px" consequence of ADR 0020.
8. **Font: Anuphan** (Thai and Latin) for all text, loaded through `next/font`. Money and quantities in tables and summary cards use `tabular-nums`.

### Status colours

Statuses use a text colour on a tinted background. All pairs pass WCAG AA (4.5:1) for normal text.

| Role | Text | Background |
|---|---|---|
| success | `#166534` | `#dcfce7` |
| warning | `#92400e` | `#fef3c7` |
| danger | `#b91c1c` | `#fee2e2` |
| muted text | `#4b5563` | on white or `#f3f4f8` |

The meanings stay the same as in ADR 0015: warning = needs attention (queue waiting, SF due soon), danger = error, shortage or delete, success = matches or saved. Brand blue never stands for a status.

### Rules the rollout must follow

- Tokens live in `src/app/globals.css` as shadcn CSS variables (`--background`, `--card`, `--primary`, `--muted-foreground`, `--radius`, and so on), mapped through `@theme`. Pages use tokens, not hex values.
- Every input has a visible `<label>` or an accessible name. A placeholder is never the only label.
- Add `error.tsx`, `not-found.tsx` and `global-error.tsx` at the app level, with Thai copy in the same style.
- No text colour below 4.5:1 against its background. The current `ink-faint` role either becomes the muted text colour or is removed.
- Text sizes come from the type scale. No arbitrary `text-[Npx]` values.
- Tap targets meet the minimum heights above. `QtyStepper` goes from 28px to at least 40px (44px on mobile POS).

## What this replaces

| ADR | Replaced | Still in force |
|---|---|---|
| 0015 | "Mobile is a reading screen, not a selling screen" and "`/pos` unusable on mobile by design"; IBM Plex Sans Thai and IBM Plex Mono; the receipt look (thin rules, high density) as the visual direction | No dark mode; status colours carry meaning and are reserved for statuses; tables turn into cards on narrow screens where rows do not need comparing; `tabular-nums` for money |
| 0018 | "No UI dependency"; the gold accent; "Operational Ledger 2.0" as the visual direction | Flows may change page by page; e2e specs for a page are rewritten when that page is implemented; per-page flow decisions that the canvas has not changed; checking each new flow against the real schema and RPCs before building it |
| 0019 | The dim indigo base and all its colour values; gradients on the primary button, header and login | Nothing visual. Its contrast reasoning (check every pair against AA before choosing) still applies |
| 0020 | Dark neutral layers, lime primary, Inter with Noto Sans Thai; "`/pos` remains unavailable below 1024px" | Route names; disabled, not dead, links for surfaces without an implemented contract; persistent sidebar from `lg`, drawer below it (unless the canvas shows otherwise); no schema, migration, RPC or role-policy change as part of the visual work |

All domain rules, money definitions, RPC contracts, RLS and role permissions in other ADRs are unchanged. For example, staff still never see repair cost or profit (ADR 0010, 0021), and the close-day count stays blind for staff (ADR 0032).

## Alternatives not selected

- **Re-theme only** (new tokens on the current markup): cheapest, but it would not fix the audit problems (labels, tap targets, type scale) and would not deliver the flows on the canvas.
- **Keep a dark base** with a new accent: the owner chose a light base.
- **Keep hand-written components** (the ADR 0018 rule): the redesign needs dialogs, popovers, selects, sheets and toasts with correct focus and keyboard handling. Building and testing those by hand costs more than owning generated shadcn components.
- **Full POS on mobile**, including SF installments and per-line discounts: those flows need more room and more checks than a phone gives. Too much risk for the first release.

## Consequences

- New dependencies: shadcn/ui components under `src/components/ui/`, a `components.json`, Radix packages, `class-variance-authority`, `clsx` and `tailwind-merge` (or what the current shadcn CLI installs). They are generated into the repo, so they are our code to review and keep up to date.
- Every page changes. Until the rollout finishes, pages not yet moved will look out of place next to the new shell. Each rollout step should keep that period short.
- `/pos` on mobile adds a new layout and a new set of tests. The offline queue, the sales RPC and the cart logic stay shared between layouts. The large-screen-only features need an explicit, tested "not available here" state on small screens.
- e2e specs and `data-testid`s for each page are rewritten when that page moves, as ADR 0018 already accepted.
- Anuphan's tabular figures and its Thai and Latin pairing at small sizes must be checked on real POS screens before rolling out past the shell and `/pos`. If they fail, come back to this ADR rather than mixing fonts page by page.
