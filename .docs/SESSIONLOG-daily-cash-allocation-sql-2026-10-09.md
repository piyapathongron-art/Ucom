# Daily cash allocation SQL implementation

Date: 2026-10-09 (Asia/Bangkok). Branch: `codex/line-daily-deposits`.

## Scope

New additive migration `supabase/migrations/20261009090327_daily_cash_allocations.sql`, created using the discovered `supabase migration new` CLI. Installed migrations remain unchanged. Adds immutable origins/allocation journal, frozen receipt dates, allocation-aware shared posting/finalization, paginated member pending-day read, daily departure, exact reserved-origin settlement/return, immutable event results and member handover/event lookup. Actor-bound replay remains unchanged.

The migration refuses an opened/nonempty cash book. Its explicit transaction acquires the singleton book table's ACCESS EXCLUSIVE lock before row preflight to prevent a DDL lock upgrade deadlock with a concurrent opener. This is installation-only; ordinary cash commands retain their existing singleton row serialization.

## Executed verification

`node scripts/check-cash-allocations.mjs` passed against newly created local Docker PostgreSQL and real PostgREST fixtures. No `.env` read or production request occurs. Latest successful database: `ucom_cash_daily_1791539065124`. REST container: `ucom-cash-daily-rest-1791539082559` (stopped, preserved). Test script retains databases for evidence.

Executed receipt-day grouping, opening unknown batch, FIFO expense consumption and repeated partial reversal, expense/repair-part/consignment-payout fund switches, nested repair/consignment sale attribution, shop-income correction, frozen transfer-source reclassification, after-deposit compensating source correction, pending/drawer refunds and refund ceiling, positive/negative reconciliation, more than 100 selectable batches, version/cursor rejection, physical separation/pause gates, reserved-only spending/correction rejection, partial settlement and full cancellation, operation replay/actor binding, invalid evidence rollback and immutable historical event reads. Real HTTP checks execute departure/settlement and replay, not only reads. Concurrent departure/spending preserves allocation conservation. Installed function bodies were read back and compared with migration source. Concurrent installation/open completed with conserved provenance after fixing the discovered DDL deadlock. Existing-open installation rejects. Direct client grants and immutable operation/source metadata guards checked.

`npx eslint scripts/check-cash-allocations.mjs` passed after the final coverage additions. SQL fixture evidence insertion does not certify hosted Storage upload policies.

## Findings corrected during verification

Test-only decimal-string comparison normalization, ambiguous PL/pgSQL JSON aliases, evidence fixture path/bucket mismatch, test string replacement of dollar quotes, and migration/open DDL lock upgrade deadlock. An initial local PostgREST v14 container transport stalled; the runner now uses the already installed/proven v16.1 image with a loopback-only port and bounded requests.

## Local browser fixture coordination

Updated only `ucom_cash_daily_browser_20261009` function definitions/guards with `ucom_cash_post`, `rpc_cash_execute`, `rpc_cash_operation_snapshot`, committed-operation immutability and frozen-source metadata guards, then requested schema reload. No full migration was reapplied to this opened fake fixture, and no rows were deleted. Lookup exposes explicit `operationId` distinct from entity `id`; recovery must compare original actor/epoch/action/payload/operationId. Other member event inspection omits the original payload.

## Remaining boundaries

No commit, push, deployment, production migration, physical activation or real LINE send performed by this implementation task. Parent browser and independent scrutiny acceptance remain separate. Hosted member RPC/private Storage and financial acceptance require approved live scope.
