# LINE daily-deposit integrated acceptance

Date: 2026-10-09. Worktree `/Users/arty/.codex/worktrees/online-billing-wave-a/ucom-pos`, branch `codex/line-daily-deposits`, base `4c235c75cfc69fa385bab0721a7ebb5b5af24d32`.

## Outcome and scope

Implemented ADR 0028: configured-group `/ฝากเงิน` navigation, authenticated mobile date selection, conserved daily allocation journal beneath all shared cash writers, physical pre-departure drawer transfer, bank reservation, private proof/partial return, owner review and immutable per-day LINE summaries. Durable actor-bound intents recover after reload without a second financial effect. Receiving/creation/UUID locks and unresolved-request gates cover mobile, POS intake/ACK/resume, legacy retry and closing.

Authoritative architecture/spec and [release inventory](../docs/pos/release-line-daily-deposits-2026-10-09.md) updated; [Thai usage guide](../docs/pos/guide-line-deposit-th.md) added. No dependencies, LIFF identity linking or chat-upload state machine added. Generated Next cash-lab tsconfig formatting/includes restored to the original file.

## Actual parent execution

- `node scripts/check-cash-allocations.mjs` final exit 0; DB `ucom_cash_daily_1791539204593`. SQL every-writer/correction/FIFO checks, real PostgREST mutations/replays, permissions/immutable history, concurrent financial operations and migration/open serialization passed. Installed function bodies matched source.
- `node src/lib/cash/operations.check.mts`, LINE deposit/Flex/webhook assertions: exit 0. Native lock order, unavailable lock/storage failure, command proof/foreign actor, legacy retirement, exact cents and multi-part messages covered.
- Final `next build`, `tsc --noEmit --incremental false`, scoped ESLint and `git diff --check`: exit 0.
- Local Playwright daily-deposit browser tests 2/2 exit 0 on fresh fixture `ucom_cash_daily_browser_20261009_final`: selection, pre-drawer, private upload, partial settlement, owner confirmation; actual committed HTTP response intentionally aborted, reload/same UUID recovery, one handover, cancellation preserving drawer.
- Close-day independent current-fund count/snapshot regression exit 0, including rerun after close guard. One abandoned background HEAD request was observed, no visible error.
- Additional corrupt unresolved deposit close guard exit 0: user-facing blocker, hidden confirmation, no close request, corrupt intent preserved. Early test failures were locator mistakes (unscoped alert and hidden DOM count), corrected to verify actual panel state.
- Screenshot visually inspected at `/tmp/ucom-cash-browser-3949-1791539232392/daily-deposit-daily-mobile-4baf5-nd-preserves-partial-return/daily-deposit-mobile.png`; 390px page had no horizontal overflow, per-day amounts and drawer/pending balances visible.

## Iterative scrutiny and corrections

Independent scrutinize final PASS for local implementation, and PASS for the final closing/intake/confirmation seams. Source findings fixed: transaction-wide migration gate with early table lock; explicit command operationId distinct from entity id; actor/epoch/action/payload/result proof; authoritative rejection; legacy binding/reimport retirement; stale day selection and changed-money physical confirmation reset. Parent reproduced the migration/open deadlock before the early table lock fix; the final suite passed without relaxing concurrency expectations.

One browser attempt used a wrong date key and another ran during a Next build that restarted the dev server; fresh post-build complete deposit suite passed. These failed attempts are not claimed as acceptance.

## Production read-only refresh

Linked project `bihgcdceovfettoxmgme`: epoch null, activationReady false, version 0; all cash operations/movements/handovers/closings/sources zero; origins not installed. Installed October migration versions recorded in release inventory. Connector access denied; safe linked CLI path used a read-only transaction, no secrets printed. No new production writes or external sends.

## Remaining boundaries

No Wave B commit/push/deploy or production migration/activation performed. Fresh production backup and immediate release config preflight remain before installation. Hosted Auth/private Storage and actual LINE group/device delivery remain unverified. Local fake Storage exercised SQL policies and in-memory uploads, not hosted infrastructure. Native local dev process stopped; fixture databases/containers retained without deletion. Production Wave A is separate and remains deployed.
