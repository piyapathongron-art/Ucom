# Plan — Complete Ucom POS features before integrated acceptance

## Authority and scope

- The latest user direction replaces the earlier "UI shell only" limit for Top-up and Consignment. Deliver working flows, not demo numbers or disabled transaction controls.
- The Build Brief is a design input, not an instruction to overwrite existing routes, schema, or live data. Keep the current `/pos`, `/topup`, `/consignments`, `/stock`, `/repairs`, `/close-day`, `/sf-commissions`, `/report`, `/expenses`, and `/settings` URLs.
- Receipt/print-slip functionality is removed. Do not reintroduce it through checkout or repairs.
- Hold-bill is outside the Build Brief and remains deferred; it is not silently included in "complete features".
- This repository points at a shared live Supabase project. Never treat its data as disposable mock data.

## Current baseline (2026-09-24)

| Area | Existing | Completion gap |
| --- | --- | --- |
| POS, stock, repairs, close-day, SF+, reports | Implemented routes backed by live data; bounded browser transaction tests on the linked project pass for POS, stock intake, repairs, SF+ cash/finance/commission, close-day, report drill-down, expense entry, and offline product-sale replay | Keep untested edge paths explicit; do not infer deployed acceptance. |
| Barcode | Keyboard-wedge handler, catalog lookup, cart integration; focused check and browser test for off-page SKU lookup and focused-input restoration pass | Physical scanner acceptance remains unverified. |
| Top-up | Dedicated `/topup`, atomic wallet guard, owner rate editing, staff-safe wallet/history views, and POS top-up line are wired. Browser acceptance passed for a ฿50 `/topup` sale (cost ฿48.50), a ฿20 POS sale (cost ฿19.40), and rejection of a ฿2,000 overdraft with the wallet balance unchanged. Temporary ฿1,000 openings were removed afterward; postflight found zero test rows and both immutable triggers enabled. | Actual opening balances are still required before live top-up operation. Deployed acceptance remains unverified. Do not create another mock top-up sale on the shared project without a separately agreed cleanup path. |
| Consignment | Dedicated route, constrained RPCs, role-safe view, and close-day cash payout adjustment are wired; migration `20260924080711` was applied to the shared project on 2026-09-24. Browser E2E passed for out/in sale and settlement, returning both directions, restoring the correct device status, and rejecting duplicate returns. Test cases/devices were cleaned by exact ID. | Deployed acceptance remains unverified. |
| Staff cost access | Product and in-stock device cost slice of ADR 0021 is implemented/applied; SF list/sale-price editing and commission receipt recording already exist | Keep owner-only commission/cost details and do not expose profit views to staff. |

## Terms that must not be conflated

- **Top-up wallet funding**: money the shop places with a carrier; already entered by the owner in `/expenses`. It is not a customer Sale.
- **Top-up sale**: money received from a customer for a carrier recharge; already represented as a POS sale line. Its carrier cost reduces the derived wallet balance.
- **Consignment hand-off/intake**: custody changes, not a Sale. A partner reporting a sale, the shop receiving money, and paying the owner are distinct events and must not be collapsed into one status field.

## Sequence

### 0. Lock the business contracts before money/stock writes

The user accepted the recommended top-up, consignment money-recognition, and staff-editor boundaries on 2026-09-24. See ADR 0022 and ADR 0023. The user then chose full, single-payment settlement for outgoing consignment in the first release; partial installments remain deferred.

1. Confirm the consignment-out and consignment-in state transitions, who receives customer money, when the shop recognizes a Sale, when a partner is paid, and how the agreed share is recorded at sale time (never at intake).
2. Confirm whether a top-up sale is blocked when the derived carrier wallet balance is insufficient. Recommended: block atomically in the existing sale RPC, not only in the UI.
3. Confirm whether "feature complete" includes the later SF/consignment/commission staff cost editors from ADR 0021. Recommended: include only editors required for the new operational flows; do not expose profit views to staff.
4. Record decisions in an ADR before changing schema or financial RPCs.

### 1. Complete the dedicated Top-up route

1. Replace hard-coded wallets/history on `/topup` with the existing wallet view and real top-up sale data. Preserve owner-only commission/cost details; staff sees amount and operational balance only through a safe read model.
2. Reuse `rpc_create_sale` and its idempotency for a top-up sale; do not introduce a second transaction ledger for the same sale. Reuse the current payment/receiving-account rules and the existing wallet-funding entry path in `/expenses`.
3. If agreed in phase 0, add an atomic wallet-availability check in the sale RPC so concurrent tills cannot overspend a carrier wallet. Keep wallet balance derived from funding entries minus sold top-up cost.
4. Remove `PREVIEW` copy and disabled controls only when the real route and permissions are wired.

### 2. Complete Consignment in both directions

1. Design the minimum ledger/state model for custody, sale, and settlement around `device_units`; do not duplicate a device as a Product or record its cost as a general Expense.
2. Add constrained database operations for intake/hand-off, return, sale confirmation, and settlement. Guard illegal transitions and duplicate settlement; record actor and time. Keep closed records immutable.
3. Add role-safe read models and wire `/consignments` tabs to real devices, forms, statuses, and history. Staff may enter permitted operational amounts, but must not receive computed profit/report fields.
4. Ensure POS excludes `consigned_out` devices and the report recognizes only money actually received, per `docs/CONTEXT.md`.

### 3. Close functional gaps and prepare one acceptance pass

1. **Done:** Compared the Build Brief routes with the implementation and retained the established route aliases. No other missing interaction was found in this pass. The read-only E2E pass exposed a Consignment loading race under React Strict Mode; the stale-effect/request-token handling is fixed.
2. **Partially done:** Keyboard-wedge scanner logic and its focused check pass. Browser E2E confirms off-page SKU lookup, cart insertion, and focused-input restoration. Physical scanner acceptance still needs the actual device.
3. **Done for local/static and read-only browser layers:** `npm run lint`, `npx tsc --noEmit --incremental false`, both focused POS checks, `npm run build`, and the isolated read-only Playwright config pass. The browser suite covers 4 owner/staff/read-only cases and does not invoke global teardown or mutate Supabase.
4. **Done for the scoped linked-project browser flows, explicitly authorized by the user:** No preview branch was created. The earlier bounded suite passed 34 distinct transaction/browser cases covering POS, repairs, close-day, reports, SF+, stock, expenses, offline replay, consignment settlement, and keyboard-wedge simulation. The final focused suite passed 3 E2E tests: full outgoing/incoming consignment settlement; returns in both directions with duplicate-return rejection; and top-up sales through `/topup` and POS plus insufficient-wallet rejection. Two tests add new transaction coverage, bringing that count to 36; the 4 read-only cases bring total distinct browser coverage to 40. The new return test was intentionally made to expect the wrong device state and failed with `Expected: consigned_out; Received: in_stock`, then passed after restoring the correct assertion. Exact-ID cleanup and zero-marker postflight passed; the earlier two `ZZTEST` expenses were preserved. Physical scanner hardware was explicitly deferred.
5. **Done for exercised scenarios:** Re-ran the affected consignment read after the fix and repeated the full read-only suite; all 4 tests pass. Evidence is local browser against the shared project's read paths, not mutation, deployed, or hardware acceptance.

### Remaining input and safe next steps

- The scoped shared-project acceptance is complete. Keep future transaction tests bounded, with marker preflight, exact cleanup scope, and postflight; the shared database is not disposable.
- Temporary mock wallet openings and top-up test sales were used only for the approved acceptance runs. Each cleanup transaction rechecked exact IDs and absence of other wallet activity, temporarily disabled only `sale_items_topup_immutable_delete`, deleted test rows, and re-enabled the trigger before commit. Latest independent postflight found zero test openings/sales/items, both immutable triggers enabled, 452 historical top-up lines, and five historical funding entries. Real opening balances must be supplied before live top-up operation.
- Physical scanner hardware verification is explicitly deferred by the user; the browser keyboard-wedge simulation already passed.
- Run the physical scanner pass when the device is available. Keep commit, push, and deploy as separate approvals.

## Release gates

- The two listed migrations were explicitly approved and applied to the shared project on 2026-09-24; postflight confirmed the existing 452 top-up sales and five funding entries remained, and no wallet opening or consignment cases were inserted. Future schema/RPC changes still require separate approval with exact targets and postflight checks.
- Commit, push, PR, and deploy are separate approvals. The current branch has unrelated uncommitted files; stage only reviewed feature files.
- The scoped transaction acceptance is complete; physical scanner hardware remains deferred. Deployed acceptance and actual opening-balance entry remain outstanding. Keep commit, push, and deploy as separate approvals.
