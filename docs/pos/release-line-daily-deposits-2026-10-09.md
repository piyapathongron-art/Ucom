# LINE daily-deposit release record

Date: 2026-10-09. Branch: `codex/line-daily-deposits`; base: `4c235c75cfc69fa385bab0721a7ebb5b5af24d32`.
Status: local implementation complete; independent scrutiny PASS. The owner approved backup, this migration, branch-only commit/push and deployment. Production migration is installed and read back; commit/push/deployment are in progress. Book activation and live LINE verification remain excluded.

## Staff workflow

1. Send `/ฝากเงิน` in the configured shop LINE group. The bot replies with the authenticated mobile form. LINE's browser may require the existing POS login.
2. On the primary POS, resolve existing receipts and pause receiving. Refresh the phone; select available dates or the explicitly unknown-date opening balance. Each date shows its outstanding amount, not gross sales.
3. Enter the remainder physically placed in the drawer before leaving. Review selected total, drawer remainder and bank-bound amount; confirm physical separation and custodian. The operation moves the drawer portion and reserves the remainder atomically. Resume receiving on the primary POS after handover.
4. Deposit the bank-bound cash. Open the handover, enter actual bank amount, additional drawer cash returned after departure and any undeposited cash returned to the pending fund. These three amounts must equal bank-bound cash. Add deposit time and private JPG/PNG/WebP/PDF evidence; confirm physical returns.
5. The bot sends a committed-event summary to the configured group, including the full date range followed by every selected day's amount, selected total, both drawer stages, bank deposit, returned pending, current drawer/shop/in-custody balances and owner-review state.
6. Owner checks evidence and bank records, then confirms or disputes. Review/evidence replacement/resend has no additional cash effect. Cancelled handovers release the bank-bound portion to its original days; pre-departure drawer money remains in the drawer.

Do not move physical money twice after a timeout. Reload and use “ยืนยันข้อมูลเดิม”; the original actor, UUID and exact intent are retained. Financial success with LINE failure retains an event notification retry separately.

## Exact release scope

- One additive migration: `supabase/migrations/20261009090327_daily_cash_allocations.sql`.
- Two new append-only tables: `ucom_cash_origins`, `ucom_cash_allocations`; RLS enabled and direct client privileges revoked.
- Columns on `ucom_cash_book` (allocation flag), `ucom_cash_sources` (frozen receipt day), `ucom_cash_handovers` (original selected lines and pre-departure drawer).
- Sixteen created/replaced functions covering allocation posting/conservation/FIFO, immutable guards, source finalization, execute/status and member read RPCs. Existing execute signature is preserved.
- Mobile cash selection, specific handover lookup, private evidence/report/review, durable actor-bound recovery and receiving/intake/closing gates.
- LINE webhook navigation command and immutable multi-part day summaries with deterministic event/part retry keys. Existing group configuration and member authorization remain the boundary; no LIFF identity binding or chat image ingestion.
- Checks and retained local Auth/Storage/PostgREST fixtures. No production money rows are created by this migration.

The migration locks the cash book table before row preflight and all DDL in a single transaction. It rejects an opened book or existing cash operations/history. Do not backfill opening day amounts from historical sales. If production has opened since the last read-only check, stop and prepare a separately reviewed migration path.

## Executed verification

- `node scripts/check-cash-allocations.mjs`: parent rerun PASS on retained local DB `ucom_cash_daily_1791539204593`. All receipt/spending writers, corrections/reclassification, original-day restoration, reservation/partial settlement/cancellation, pagination, permissions, immutable history, real PostgREST financial mutations/replay, concurrent spending/departure and concurrent migration/open passed. Installed function bodies match source.
- `node src/lib/cash/operations.check.mts`: PASS for exact cents, selection, actor/intent/result proof, corrupt storage and legacy binding/refresh/retirement.
- LINE deposit/webhook/Flex assertions: PASS, including 110 daily lines without omission, group/signature/origin filters and retry-key behavior.
- `next build`, no-incremental TypeScript and scoped ESLint: PASS.
- Authorized localhost Playwright daily-deposit suite: selection of two dates, pre-drawer 57, private upload, bank 1,200/returned pending 243, owner confirmation; committed response dropped then reload/replay produces one handover; cancellation retains pre-drawer 3. PASS 2/2 on fresh retained fixture `ucom_cash_daily_browser_20261009_final`.
- Close-day browser regression: PASS with current drawer/pending counts and immutable closing snapshot. A cancelled background HEAD request was recorded; no user-facing failure occurred.
- Additional browser guard: PASS for corrupt unresolved deposit blocking closing review, leaving the confirmation hidden and creating no closing request. Native lock/unsupported lock/storage-failure assertions passed. Final build, TypeScript and scoped lint were rerun after this guard.

An earlier browser attempt failed from a test selector typo. Another failed while a simultaneous Next build restarted the dev server; its evidence link step was rerun in the full fresh-fixture suite after the build and passed. A real migration/open lock inversion failed the original SQL concurrency check; an early table lock fixed the cause and the full check passed. These failed attempts are not counted as acceptance.

## Rollout gates

Read-only refresh at 2026-10-09 17:02 Bangkok: linked Supabase project `bihgcdceovfettoxmgme`; epoch null, activationReady false, version 0, receiving unpaused; operations/movements/handovers/closings/sources all zero; daily origins not installed. Installed October migrations: `20261009034817`, `20261009061359`, `20261009061409`, `20261009061418`, `20261009061433`. The connector denied access; linked CLI credentials executed only a read-only transaction and returned aggregate state, with no secret output. This refresh does not replace the backup and deployment/config preflight immediately before approved installation.

Approved installation: refreshed custom-format public/schema-history archive `.backups/ucom-wave-b-20261009T101758Z-public-history.dump` (473,057 bytes; SHA-256 `ad9503c2d6f8eb0e49d369f5ad91cfb07dc68fe666ae8d8759ae216107e7170b`, mode 0600, Git-ignored). Isolated restore `ucom_wave_b_restore_20261009t101758z` passed all 26 archive table counts, 3,729 rows, using Auth UUID stubs. This is scoped public/schema-history recovery, not full Auth/Storage/off-device recovery. Applied only migration `20261009090327`, SHA-256 `d37dbac68c922e34190f47f16998e71e06d37bed85ab225e5cea6774f830fead`, with its history entry in the same transaction and PostgREST schema reload. All 16 installed function bodies matched source; both new tables have RLS and no anon/authenticated direct privileges. Post-state remains epoch null, activationReady false, version 0, reminders disabled and all cash history counts zero. No migration-history remapping, activation, financial operation or LINE send occurred.

1. Read-only production preflight: exact Supabase project, installed migration history/function signatures, unopened book and absent cash history; fresh recoverable schema/data backup. Confirm correct Vercel production project and configured LINE group/app origin without exposing secrets.
2. Approve this migration and release inventory explicitly. Apply only the reviewed migration; read back installed function bodies, columns, grants and invariant state. Keep cash activation disabled.
3. Approve exact commit/push/deployment. Deploy the tested application revision; verify production navigation/auth read-only before any financial operation.
4. Authorize a bounded real LINE command/send and hosted private-Storage verification separately. Local mocked HTTP proves request construction, not group/device delivery or hosted Storage access.
5. Owner physically counts drawer and pending cash, resolves old receipts and explicitly approves activation/opening. Opening pending appears as unknown date; subsequent receipts use frozen original Bangkok business dates.

LINE retry keys provide a 24-hour retry window; they are not permanent delivery deduplication. No offline bill creation, LIFF binding, chat-upload conversation state or bank automatic matching is added.
