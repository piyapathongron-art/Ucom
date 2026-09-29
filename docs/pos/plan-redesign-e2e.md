# Plan — Playwright e2e for the canvas redesign

Scope: verify `docs/pos/plan-redesign-canvas.md` at the layer users use (browser → deployed Next → live Supabase).
Status (2026-09-29): Layer 0 green. **Layer 1 written and run: 17/17 pass** (`playwright.readonly.config.ts`; 13 new `redesign-readonly.spec.ts` + 4 existing), no write calls issued. **Layer 2 executed 2026-09-29 (user-approved): 30/30 pass after fixing 3 spec-drift failures; test rows cleaned by ID, DB equals the pre-run snapshot.** W6 and the close-day RPC stay unverified. See `.docs/SESSIONLOG-redesign-canvas-2026-09-29.md`.

## Ground rules (from the repo, not invented)

- **No local stack.** `.env*` points at **production** Supabase; dev server on `http://localhost:3002` (all configs use it). Any write test = write to prod.
- Logins: `loginAs(page, "staff" | "admin")` in `tests/e2e/repairs-helpers.ts` (bare username, password `123456`).
- `playwright.config.ts` has `globalTeardown` (`tests/e2e/global-teardown.ts`) that bulk-deletes `ZZTEST%` rows (products, sales, receipts via service role…). **Deleting is R0**: it also removes leftovers from earlier runs, so its target list must be shown before every write run (Layer 2 preflight below).
- Existing configs: `playwright.readonly.config.ts` (no teardown, no writes), `playwright.acceptance.config.ts` (writes, no teardown; cleans by exact ID in the spec's `afterAll`).
- Test style: `node:assert`/Playwright only, no new runner. New specs stay ASCII where practical; Thai strings go through a shared constants file (like `TH` in `repairs-helpers.ts`).
- Physical barcode scanner: **not testable here** (keyboard-wedge simulated only). Stays "unverified" like the feature-completion plan says.

## Layer 0 — static gate (already green, re-run before each layer)

`npx tsc --noEmit`, `npm run lint`, `npm run build`, `node <each>.check.mts` (`errors`, `sfDuplicates`, `queue`, `useBarcodeScanner`).

## Layer 1 — read-only browser pass (no data changes, no approval needed beyond "run it")

New file `tests/e2e/redesign-readonly.spec.ts`, added to `testMatch` in `playwright.readonly.config.ts` together with the two existing read-only specs (whose selectors are already updated). Both roles, no writes, no teardown.

| # | Area | Assertions |
|---|---|---|
| R1 | Shell / sidebar (staff + owner) | Menu order = ขายสินค้า, สต็อก/เครื่อง, งานซ่อม, ฝากขาย & SF+, เติมเงิน (+ รายงาน, รายรับ–รายจ่าย for owner); `ปิดร้าน` in footer group; `ตั้งค่า` owner only; no `/sf-commissions` link; active item has `aria-current="page"`; logout button present; no emoji, no "STAFF DESK"/"OWNER" eyebrows |
| R2 | Tokens | Computed style: `body` font-family starts with Inter; card radius 20px; `.ucom-primary` radius ≥ 999px & `#ddff8d`/`on-accent`; table `th` bg `rgb(17,16,22)` |
| R3 | `/sf-commissions` | Redirects to `/consignments?tab=sf`, SF+ tab selected |
| R4 | `/repairs` | CTA `open-intake-form` opens dialog, Esc closes; `intake-submit` disabled until name+device; abandon dialog (`repair-abandon-*`) opens on an open job **without any part-cost text** (staff role) and cancel leaves the row unchanged; filter tabs `filter-*`; skeleton then table or empty state |
| R5 | `/stock` | Tabs `stock-kind-product/device`; CTA testid follows tab (`open-add-product` / `open-add-device`); row click opens drawer (380px), close leaves data unchanged; status chip options differ per kind; empty state with `ล้างตัวกรอง` on a no-match search; `cost-column-header` visible for both roles; **no** "รับ SF" button |
| R6 | `/consignments` | Tabs out/in/sf; CTA label/testid per tab; open dialog on each tab, validation message on empty submit (no RPC call — assert via network log); SF+ sub-chips `sf-tab-due/pending/receipts` switch content; SF dialog: scan-burst simulated by fast `keyboard.type` + Enter appends a row copying model/list price; live footer text updates; in-form duplicate IMEI shows `IMEI ซ้ำกับแถวอื่นในบิลนี้` and submit makes **no** network request to `rpc_receive_sf_order` |
| R7 | `/topup` | Wallet cards `wallet-balance-*` (3); owner sees `open-wallet-fund`, staff does not; owner dialog opens/closes; opening-balance flow uses ConfirmDialog (only if some wallet is uninitialized — else skipped, reported as skipped) |
| R8 | `/expenses` (owner) | Tabs `ledger-tab-expense/income`; columns; footer `expense-total` + `ledger-net`; date filters change totals; `open-ledger-add` dialog has date field on expense tab and none on income tab; staff opening `/expenses` is denied/redirected |
| R9 | `/close-day` | Sections render; `open-close-day-*-add` dialog has **no** date field; owner sees link to `/expenses`, staff does not; counted-cash + `close-day-confirm` opens confirm dialog showing expected/counted/diff, **Cancel** closes it (never click the confirm button in this layer) |
| R10 | `/pos` | Page loads, no `window.confirm` (register `page.on("dialog")` and fail if fired); queue banner absent when queue empty |
| R11 | `/report`, `/settings` (owner) | Load without console error; no "OWNER ONLY" text; settings rate inputs present |
| R12 | Error hygiene | For each page: `page.route` aborts/500s the first Supabase REST call → page shows the Thai `ErrorPanel` (`role="alert"`) and **no** English/`PGRST`/`relation` text; `ลองใหม่` reloads |
| R13 | Console | `page.on("console")` collects errors on every visited page; fail on any React/hydration error |

Run: `npx playwright test -c playwright.readonly.config.ts` (dev server on 3002 must be up).

## Layer 2 — write layer (production data → **R0, needs explicit approval**)

Config: extend `playwright.acceptance.config.ts` `testMatch` (no global teardown). Each spec creates data with a unique `ZZTEST-<area>-<Date.now()>` name/IMEI and deletes **only what it created, by exact ID** in `afterAll` via the service-role helper (pattern already in `consignments.spec.ts`; guard: throw if a name matches ≠ 1 row).

### Preflight (before any write run) — shown to the user

1. `select` counts of `ZZTEST%` leftovers per table (products, device_units, repair_jobs, sales, expenses, shop_income, sf_orders, consignments) → user sees what exists.
2. Confirm no queued offline bills in the test browser and wallets state (`v_pos_topup_wallet_balance`: initialized or not).
3. User picks verify mode (run myself / checklist / skip) and approves the exact list below.

### Cases (each = create → assert UI + assert DB → clean by ID)

| # | Flow | UI assertions | DB / layer-below assertions | Data created → cleanup |
|---|---|---|---|---|
| W1 | Repair intake → step status → set part cost → close & bill | dialog closes on success, toast appears, row moves; failed close keeps dialog open (simulate by aborting RPC once, retry reuses same `client_uuid`) | `repair_jobs` row, `sales` row for bill, `part_cost` written but **not** readable by staff (view has no column) | 1 repair job + 1 sale → delete sale items, sale, job |
| W2 | Repair abandon | confirm dialog, row status `ลูกค้าทิ้ง`, not deletable | status = abandoned; no reverse transition | 1 job (reuse W1 pattern) |
| W3 | Stock: add product / add device / edit via drawer / set cost / owner cost edit | drawer closes, name shown in table (`stock-name-*` text), toast; failed save keeps drawer + draft | `products`/`device_units` rows; `rpc_upsert_*` payload keeps `list_price`/`sale_price` semantics (sf_credit edits only `sale_price`) | 1 product + 1 device → delete by ID |
| W4 | SF intake (dialog) → appears in บิลค้าง highlighted → edit (locked non-`in_stock` rows) → finance → record commission → owner correct → delete-bill inline confirm | jump to due sub-tab + highlight + toast; duplicate IMEI/order_no Thai messages; existing `sf.spec.ts` report assertions still hold | `sf_orders`, `device_units`, `sf_commission_receipts` (service role cleanup) | 1–2 SF orders → delete receipts, devices, order |
| W5 | Consignment out: open → report sold → settle; return; in: open → sell in-shop → pay | action dialogs, yellow return confirm, status labels | existing `consignments.spec.ts` DB assertions (sale cost/price, no sale before sell) | already cleaned by ID in that spec |
| W6 | Top-up sale; overdraw rejected; owner wallet fund via dialog; opening-balance ConfirmDialog | balances update, overdraw shows Thai message not raw text | wallet balance math (existing `topup-live-acceptance.spec.ts`) | see note ⚠ below |
| W7 | Ledger: add expense (with date), add income (today), delete each with inline confirm; net updates | rows appear/disappear, `expense-total` and `ledger-net` change by exact amounts | `expenses`, `shop_income` rows; close-day cash totals move by the same amounts | 1 expense + 1 income → deleted by the test itself (+ by-ID safety net) |
| W8 | Close-day: add/delete expense & income via shared dialog; **close the day** → closed banner → `ปิดใหม่อีกครั้ง` | confirm dialog shows expected/counted/diff; banner text | `day_closings` row for today | **`day_closings` row is not deletable by the test** → see ⚠ |
| W9 | POS offline queue: reject a queued bill → remove via ConfirmDialog | dialog replaces `window.confirm`; banner disappears | localStorage only | none (client-side) |
| W10 | Settings: save carrier commission rate | toast, value persists after reload | `topup_carriers.commission_rate` restored to original in `afterAll` | value change → restore |

⚠ Items that need a user decision before Layer 2 (do not assume):
- **W6 wallets:** the plan for top-up sales says not to create another mock sale on the shared project without an agreed cleanup path (`plan-feature-completion-2026-09-24.md`). Proposal: reuse the exact cleanup already implemented in `topup-live-acceptance.spec.ts`, or skip W6 and mark top-up **unverified**.
- **W8 closing the day:** creates a real `day_closings` row for today on prod. Proposal: run W8 only after the shop's real closing, in re-close mode, or against an owner-chosen past date; otherwise skip the final "close" click and keep everything up to the confirm dialog (mark "close RPC unverified").
- **Default `playwright.config.ts` teardown:** do not use it for these runs (bulk wildcard delete). Keep it only if the user wants the leftover sweep, after seeing the preflight list.

## Existing specs to re-run (updated for the redesign, none executed yet)

`repairs`, `stock-staff`, `stock-owner`, `sf`, `consignments`, `expenses`, `close-day`, `offline`, `topup-live-acceptance`, `features-readonly`, `pagination-filter`, `pos`, `barcode`, `report`, `export`. Run order: readonly ones first, then write specs in the order W1→W10; stop at the first unexpected failure and diagnose (systematic-debugging) instead of retrying.

## Deliverables and reporting

1. `tests/e2e/redesign-readonly.spec.ts` (+ `testMatch` edit) — Layer 1.
2. `tests/e2e/redesign-write.spec.ts` (W1–W4, W7, W9, W10; W5/W6/W8 reuse or extend the existing specs) — only after Layer 2 approval.
3. Shared `tests/e2e/ledger-helpers.ts`/`admin-cleanup.ts` for by-ID cleanup (extract the pattern already in `consignments.spec.ts`; no new dependency).
4. `.docs/SESSIONLOG-redesign-canvas-2026-09-29.md`: per layer state "verified at browser / verified at DB / NOT verified (why)". Any skipped case counts as **unverified**; a PR stays **Draft** until then.

## Out of scope

Physical scanner, deployed-environment (Vercel) run, mobile viewport for POS (POS is wide-screen only), visual pixel diff against the canvas (compare by computed tokens + a human look at screenshots).

## Layer 2 — prepared (2026-09-29), NOT executed

Decisions taken (user: "ตามแนะนำ"): **W6 skipped** (top-up sales/wallet writes stay *unverified*; the `top up a wallet` test in `expenses.spec.ts` and `topup-live-acceptance.spec.ts` are excluded from the config); **W8 stops at the confirm dialog** (already covered in Layer 1) — the `rpc_close_day` RPC and the `day_closings` write stay *unverified*.

Prepared artifacts:
- `scripts/e2e-zztest.mts` — `list` (read-only snapshot), `cleanup --snapshot f` (**dry run by default**, `--apply` deletes only marker-matching rows absent from the snapshot, FK order).
- `tests/e2e/redesign-write.spec.ts` — W1 (failed close keeps dialog, retry reuses `client_uuid`), W3 (failed save keeps drawer draft; create → edit → reload; owner cost on its own product), W4 (SF dialog create → highlight → existing-IMEI + duplicate order_no messages with no second RPC → edit → delete), W7 (dated expense + income change totals/net exactly, deletes restore), W10 (rate save/persist/restore).
- `tests/e2e/stock-owner.spec.ts` now edits cost on a product it creates (before: it bumped a **real** product's cost by 1 and never restored it).
- `playwright.acceptance.config.ts` — 30 tests, no `globalTeardown`.

Preflight result (read-only, 2026-09-29): 0 leftover rows in all tables except `expenses` = 2 (`ZZTEST-EXP-1786790045746` ฿321 and `ZZTEST-CLOSE-1786790141445` ฿150, both dated 2026-08-15, left by earlier runs). The snapshot taken right before the run will contain them, so cleanup will NOT delete them; deleting them is a separate R0 decision.

Run procedure (only after approval):
1. `node scripts/e2e-zztest.mts list --out <scratch>/snapshot.json`
2. `npx playwright test -c playwright.acceptance.config.ts`
3. `node scripts/e2e-zztest.mts cleanup --snapshot <scratch>/snapshot.json` (dry run) → show list → `--apply`
4. `node scripts/e2e-zztest.mts list` must equal the snapshot.

Known risks of running on production: (a) `sf.spec.ts`/`repairs`/`offline` create real sales that move today's report/close-day numbers until cleaned, and `sf.spec.ts` compares report figures before/after, so a real sale rung up by the shop during the run can make it fail spuriously; (b) W10 changes a carrier commission rate for a few seconds (restored in `finally`; original value is recorded in the test annotation); (c) sales created by tests are deleted with the service role — confirm the immutable-trigger behaviour allows it in the dry run before `--apply`.
