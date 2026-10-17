# Deposit departure without receiving pause — 2026-10-17

## Decision

User selected option B from the LIFF deposit review: `handover_days` no longer requires the receiving-POS pause/ACK or a matching book version; `close` keeps both. Recorded as [ADR 0031](../docs/adr/0031-departure-without-receiving-pause.md).

## Production facts checked (read-only, `supabase db query --linked`, `begin read only`)

- Deployed `af78a51` contains `4c235c7` (new offline bills disabled); `enqueue` has no caller in `src`.
- Cash book: opened, version 1, not paused, day allocations enabled; only operation is `open` (2026-10-10 13:28 UTC); no handovers; no sales since 2026-09-30.
- `rpc_cash_execute` production body is byte-identical to the 20261009090327 migration (md5 `3b6518abdbb0ed636b78fd969a87d5c4`).
- Supabase MCP returned "no permission" for this project; the CLI linked project was used instead.

## Changes (branch `codex/line-daily-deposits` worktree, uncommitted)

- `supabase/migrations/20261017090000_handover_without_receiving_pause.sql`: full `rpc_cash_execute` replacement generated from the production body with one gate changed (`handover_days` removed from the pause/version gate). Same signature, grants re-stated. **Not applied.**
- UI: removed pause instructions and the `canHandover` gate from `cash-deposit.tsx`, `cash-overview.tsx`, `day-selection.tsx`. Payload still sends `version` for compatibility with the old server.
- `scripts/check-cash-allocations.mjs`: loads the new migration; stale-version departure assertion replaced by exact-amount mismatch; cancel-departure case now runs unpaused with a concurrent receipt; HTTP re-reserve expects 40001; body readback compares the latest definition of each function.

## Verification

- `node scripts/check-cash-allocations.mjs` (isolated Docker fixture, no production): all sections passed, including SQL, local PostgREST HTTP, concurrency and install race.
- `tsc --noEmit` and `eslint src/app/(staff)/cash` passed.
- Not run: `tests/local-cash/daily-deposit.spec.ts` (Playwright local stack), browser/phone check, production migration.

## Next

Applying the migration to production (R0) and deploying the UI need separate approval. Apply the migration before or together with the UI deploy. Pre-existing `tsconfig.json` modification left untouched.

## UX fixes after phone walkthrough (same day)

Walked the LIFF deposit flow at 375x812 in the local lab (fresh fixture DB `ucom_cash_daily_browser_ux20261017b`, fake Auth/Storage, real local PostgREST/SQL; never production). Fixed and re-walked:

1. Custodian name wiped when the drawer field changed: `DaySelection` remounted `CashForm` via `key={keys:drawer}`; key removed (the form already receives `fields` as props).
2. Rejected submit cleared the whole form with a generic error: React 19 resets uncontrolled fields after `<form action={fn}>`. `CashForm` now uses `onSubmit` + `preventDefault` and resets only on success. `toThaiError` also shows our own Thai `22023` messages (`errors.check.mts` extended). Settle form checks bank+drawer+returned against the handover amount client-side and says how much is missing/over.
3. Disabled submit looked clickable: `.ucom-primary:disabled` (opacity 0.4, not-allowed) plus a reason line ("เลือกวันที่จะนำฝากอย่างน้อย 1 วัน" or the selection error). The fieldset no longer disables inputs when only the submit is blocked.

Verified in browser: disabled button opacity 0.4 + reason shown; name kept after editing drawer; short-sum and future-date rejections keep bank/date/slip/checkbox and show a specific Thai message; corrected submit moved the handover to reported. Not verified: real phone/LIFF SDK, dark/light variants, the pause-free departure against the HTTP stack (the lab's prepare script leaves the POS paused). Open items from the review remain (cash-recovery wording, LINE card, entry points).

## Round 2 UX fixes (same day)

- Step 1 form hidden while any handover is `handed_over` (money is out); it returns once reported.
- Step 2: deposit time defaults to Bangkok now, rounded UP to the next minute (a first attempt rounded down and the server rejected it as earlier than the handover when submitted within the same minute); the confirmation checkbox now reads as one plain statement in the compact form; the required semantics are unchanged.
- Days show as "30 ก.ย. 2569" in the day list and handover card (`lineDayLabel`, checked in `operations.check.mts`).
- Recovery box: heading "มีรายการที่ต้องตรวจ", action names in Thai, and all unsent LINE notifications collapse into one count with one resend button. Button text "ยืนยันข้อมูลเดิม" kept because `daily-deposit.spec.ts` selects it.
- LINE card no longer prints the operation UUID (still in the button link); `deposit.check.mts` asserts it.

Verified in the local lab (fixture DB `..._ux20261017c`, 375x812): Thai day labels, step 1 hidden after departure, single recovery line, default time present, settle with only slip + one tick succeeded and moved the handover to reported. `tsc`, `eslint`, and the `*.check.mts` files (errors, cashFlex, deposit, digestFlex, operations) pass.
Not run: `tests/local-cash/daily-deposit.spec.ts` (selectors for step 1 after departure may need review), real phone/LIFF SDK. Not changed: pre-selecting days, live sum while typing, pinned LIFF link/announcement and the bot posting `LINE_GROUP_ID` on join (setup/ops decisions, not UI).

## Playwright run (after round-2 UI changes)

`tests/local-cash/daily-deposit.spec.ts` against a fresh `--daily` lab fixture (`ucom_cash_daily_browser_ux20261017d`, fake Auth/Storage, local PostgREST): 3 passed in 7.6s, no spec edits needed. The spec exercises the desktop `/cash?intent=deposit` overview (non-compact `DaySelection`/`HandoverCard`, `data-testid` day selectors, recovery button "ยืนยันข้อมูลเดิม"); it does not cover the compact `/liff/deposit` view (step 1 hidden while money is out, default deposit time, collapsed LINE-retry line), which was only walked by hand. `cash.spec.ts` and `online-only.spec.ts` use a different, older fixture (`ucom_cash_http_20261008`) and were not run.
