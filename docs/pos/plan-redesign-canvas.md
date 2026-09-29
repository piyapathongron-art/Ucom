# Plan — Port the canvas redesign to code

Risk: **R1** (multi-file, reversible). No migrations, no RPC/DB changes. If one seems needed → stop (R0).
Source of truth: canvas artifact https://claude.ai/artifact/4BDXA2i3PSwB4zmwWBHGpQ (read boards via `project/<Board>.dc.html`), ADR 0024, `docs/CONTEXT.md`, ADR 0022, ADR 0010 (staff cannot see part cost).
Decisions are frozen in the handoff `/tmp/ucom-pos-redesign-handoff-2026-09-29.md`; this plan only sequences them.

## Baseline (verified 2026-09-29)

- `_components/`: `Modal` (md/lg, has eyebrow), `NavBar` (links come from each layout; `#2c2a38` hardcoded), `PageFrame` (mono eyebrow + bottom border), `PaginationControls`.
- Both layouts hold the link lists; `/sf-commissions` is still in `(staff)/layout.tsx`.
- `globals.css` colours match the design; `@theme` font order is Noto-first (must be Inter-first).
- `sonner` is not installed (user-approved, the only new dependency).
- `window.confirm`/`<p role="status">` occurrences: 6 (topup, pos, consignments, settings).
- Worktree already has 57 uncommitted unrelated changes → stage only files touched here, and only when asked to commit.

## Steps

Each step ends with `npx tsc --noEmit`, `npm run lint`, and the affected `*.check.mts`. Files ≤300 lines, no `any`.

1. **Shell** (`globals.css`, `layout.tsx`, `_components/*`)
   - Tokens: `brand-ink #2c2a38`, `ink-faint #6b687a`, `warning-bg #392a0c`, `success-bg #0f3322`, `on-accent #0c0b0e`, `--shadow-card`; replace hardcoded hex in code.
   - Shape: card r20 no border, pill buttons/search (999px, 13.5/700), table head `#111016` 11/600 tracking .06em, cell 14×20, dashed info box r16. Font stack Inter → Noto Sans Thai.
   - `PageFrame`: drop eyebrow + border; h1 26/32, 12.5 meta, lime pill CTA slot, 32px padding, full width. Remove `eyebrow` prop and update callers.
   - `NavBar` 240px per Sidebar board; menu order from handoff; bottom group ปิดร้าน / ตั้งค่า (owner) / user card / logout; inline SVG, no emoji. Update both layouts, drop `/sf-commissions`.
   - New shared: `Toaster` (sonner, bottom-center, token classNames, 4s success/warning, sticky error + "ลองใหม่"), `Modal` sizes sm480/md640/lg880, `ConfirmDialog` (yellow = irreversible), `Skeleton` rows (reuses real table grid, 5 rows, `motion-reduce`), `EmptyState` (no-data / no-match), `ErrorPanel`, right `Drawer` 380.
   - `lib/errors.ts` mapper: pass through only Thai messages we wrote in RPCs, else generic Thai text; never surface `error.message`. Check: `errors.check.mts`.
2. **Repairs (pilot)** — dialogs for intake/close/abandon, CTA keeps `data-testid="open-intake-form"`; abandon dialog hides part cost. **Stop and ask the user to review before continuing.**
3. **Stock** — read-only table, row → shared drawer (add + edit, CTA follows tab), kind pill tabs, dashed chips with existing status values, existing qty stepper; "รับ SF" leaves stock. Update stock e2e specs to open the drawer.
4. **ฝากขาย & SF+** — tabs ฝากออก · ฝากเข้า · SF+ (sub-chips บิลค้าง · รอค่าคอม · ยืนยันแล้ว); one SF intake/edit component (2 modes, scanner via `pos/useBarcodeScanner.ts`, row copy, live footer, duplicate check, locked non-`in_stock` rows, post-save jump + highlight + toast); consignment action dialogs; "ขายหน้าร้าน" stays here. Duplicate-IMEI logic gets `sfDuplicates.check.mts`.
   - `/sf-commissions` route: redirect vs delete → **ask user** (deleting is R0-ish). Default proposal: redirect to `/consignments?tab=sf`.
5. **Ledger + close-day + topup + POS queue + settings**
   - `/expenses` → "รายรับ–รายจ่ายนอกบิล" (tabs, method column, total/net, inline delete confirm, shared add-dialog; close-day variant has no date field).
   - Wallet balances + owner wallet funding move to `/topup`; opening-balance uses ConfirmDialog (replaces `window.confirm`).
   - Close-day: disabled button + yellow banner when queue non-empty; confirm dialog (expected/counted/diff); closed state with "ปิดใหม่อีกครั้ง"; cross-links with ledger.
   - POS: queue banner + remove-queued ConfirmDialog (replaces `window.confirm`); scan feedback stays inline.
   - Settings: token/shell only + toast; Reports: shell/token only.
6. **Cross-cutting sweep** — every `setError(error.message)` → mapper; scattered `role="status"` notices → toast; every existing `data-testid` kept; update inline-form e2e specs to click the CTA first.
7. **Verify + document** — ask user which verify mode (self-run / checklist / skip) per page; run `tsc`, `lint`, `build`, all `*.check.mts`; then `.docs/SESSIONLOG-redesign-canvas-<date>.md` (also covers the 2026-09-28/29 design session).

## Out of scope (decided)

Stock adjust-with-reason, low-stock threshold, close-day checklist, any DB/RPC change, shadcn, Reports board changes.

## Risks

- Prod Supabase behind `.env`: browser verification that writes data needs a cleanup path (see feature-completion plan).
- e2e specs are already modified in the worktree; expect selector churn in offline/stock/sf specs.
- PageFrame prop removal touches every page; do it in step 1 with a grep-driven caller update.
