# SESSIONLOG — canvas redesign ported to code (2026-09-29)

Branch `feat/edu-ai-reskin-and-fixes`. Nothing committed/pushed. The worktree still holds ~57 unrelated uncommitted files plus this work; stage only what belongs when asked to commit.

## What changed (R1, no migrations, no RPC/DB change)
- **Shell:** tokens (`brand-ink`, `ink-faint`, `warning-bg`, `success-bg`, `on-accent`, `shadow-card`), shapes (r20 cards, pill buttons/inputs, table head), Inter-first font; `PageFrame` (no eyebrow/border), `NavBar` 240px + `navLinks.ts`; shared `Modal` (sm/md/lg), `Drawer`, `ConfirmDialog`, `SkeletonRows`, `EmptyState`, `ErrorPanel`, `AppToaster` (`sonner`, the only new dependency), `LedgerAddDialog`; `lib/errors.ts` (`toThaiError`, never render `error.message`).
- **Repairs:** dialogs for intake / close (same `client_uuid` on retry) / abandon (no part cost, ADR 0010).
- **Stock:** read-only table + one right drawer (add/edit), kind tabs, dashed filter chips.
- **ฝากขาย & SF+:** one page with tabs out / in / SF+; consignment dialogs; `SfIntakeDialog` (create+edit, scanner via `useBarcodeScanner`, duplicate checks); `/sf-commissions` redirects to `/consignments?tab=sf` (user approved redirect over delete).
- **Ledger `/expenses`:** expense / off-bill income tabs, total + net; wallet funding moved to `/topup`.
- **close-day:** shared add dialog (no date), confirm dialog (expected/counted/diff), closed banner + re-close, ledger links (owner).
- **topup / pos / settings:** `window.confirm` → `ConfirmDialog`, notices → toasts.
- Deleted: `AddForms`, `StockRowCard`, `SfIntake`, `ExpenseTable`, `useExpensesPage`, close-day `ExpensesSection`/`IncomeSection`.

## Verification — by layer
| Layer | State |
|---|---|
| `tsc`, `lint`, `build`, 4 `*.check.mts` (`errors`, `sfDuplicates`, `queue`, `useBarcodeScanner`) | pass |
| Browser, read-only (`playwright.readonly.config.ts`) | **17/17 pass** — sidebar/tokens/redirect/dialogs/drawer/scan+duplicate/role rules/500-error hygiene/console clean; zero write calls |
| Browser + DB writes on production (`playwright.acceptance.config.ts`) | first run 27/30; the 3 failures were spec drift (stock tab default, duplicate closed-dialog testid), fixed; re-ran `consignments` + `repairs` 9/9. **All 30 pass** across the two runs |
| Cleanup | dry run listed exactly the created rows (6 sales, 13 repair jobs, 3 receipts, 5 devices, 4 SF orders, 5 products); `--apply` deleted them; `list` afterwards equals the pre-run snapshot |

## NOT verified (say so, do not assume)
- **Top-up sales / wallet funding / opening balance writes (W6)** — skipped by decision; only the dialogs' open/cancel behaviour is verified. The `top up a wallet` test in `expenses.spec.ts` is excluded from the config.
- **`rpc_close_day` / `day_closings` write (W8)** — only the confirm dialog (open/cancel) verified; ledger-in-close-day add/delete was verified.
- Physical barcode scanner (simulated fast typing only).
- Visual match against the canvas (checked by computed styles, not pixels/eyes). Stock dialog boards were not fully readable from the canvas; the drawer follows the handoff text.
- Runs were against the local dev server on :3002 (which talks to production Supabase and the *deployed* backend per CLAUDE.md), not a Vercel deploy.
- Real device viewport for POS/mobile.

## Facts worth keeping
- 2 old leftover rows remain in `expenses`: `ZZTEST-EXP-1786790045746` (฿321) and `ZZTEST-CLOSE-1786790141445` (฿150), both 2026-08-15 — left by earlier runs, deletion is a separate R0 decision.
- `playwright.config.ts` has a wildcard `globalTeardown` (deletes every `ZZTEST%`); it was not used. Use `scripts/e2e-zztest.mts list` → run → `cleanup` (dry run, then `--apply`).
- `stock-owner.spec.ts` used to bump a **real** product's cost by 1 permanently; it now creates its own product.
- Spec/UI notes: desktop row and mobile card each mount a closed confirm dialog (duplicate testids in DOM; scope to `getByRole("dialog")`); Next's route announcer is a `role="alert"` outside `main`.
- claude-mem observer is failing (org disabled subscription access) — nothing from this session is remembered there.

## Open / follow-ups
- Ledger income can only be added for "today" (`rpc_add_shop_income` takes no date).
- Close-day "over/short" in the closed banner uses the current expected cash (table stores no expected value).
- Edit-mode SF rows cannot be removed from a bill (RPC does not support it).
- PR (if opened): Draft until the unverified items above are checked; ask Thai/English before writing it.
