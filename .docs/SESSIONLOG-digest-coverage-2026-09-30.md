# SESSIONLOG — digest card coverage test (2026-09-30)

Branch `fix/sticky-sidebar-and-digest-card`. Nothing below was committed yet.

## Findings (read-only, prod, staff role via REST → `rpc_close_day_digest`, 29 Sep)

- Every value the RPC returns reaches the card (top 10 per section + "+ อีก N"); no cost/profit text.
- Gap: cash-to-send includes off-bill cash income (`v_income`) but the RPC never returned it, so
  `cash 21,670 − cash-out 744.45 = 20,925.55` ≠ `toSend 21,125.55`. `v_close_day_income` for that day
  has `cash:200 transfer:300` → the missing 200.
- Not exercised by real data: SIM sold/free, ไทยช่วยไทย > 0, cash-paid part cost, consignment payout,
  null wallet, resend badge.

## Done in the repo

- `supabase/migrations/20260930100000_close_day_digest_cash_income.sql` — `create or replace` of
  `rpc_close_day_digest`, adds `'cashIncome', v_income` (same signature). **Written, NOT applied.**
- `digestFlex.ts` — optional `cashIncome`, row "รายรับนอกบิล (เงินสด)" under รับเงินทาง; SIM section
  shows no "รวม 0" when nothing was sold.
- `digestFlex.check.mts` — full-coverage fixture (free SIM, consignment payout, off-bill income,
  null wallet, reconciliation cash + income − cash-out = toSend). Passes; `tsc` + eslint pass.

## Blocked (auto-mode classifier: production deploy) — needs the user

`supabase db query --linked -f supabase/migrations/20260930100000_close_day_digest_cash_income.sql`
was denied; nothing on prod was changed this session. Pending R0 steps:

1. Apply the migration above, then dump `prosrc` and diff against the file.
2. Reopen 30 Sep: delete the single `day_closings` row (restore values below).
3. Seed ZZTEST rows on 30 Sep (SIM sold + free, ไทยช่วยไทย bill, cash top-up, repair with cash part
   cost, consignment sell + cash payout, cash expense), then `rpc_close_day`, then re-run the probe.

### Row to be deleted in step 2 (for restore)

```json
{"id":"895aa2f6-0663-4a79-b702-3d42973fc2a5","closing_date":"2026-09-30",
 "closed_at":"2026-09-29T20:14:32.890016+00:00","closed_by":"a67a1ab3-5039-4e79-ad21-59486822b535",
 "counted_cash":100,"note":"tese","created_at":"2026-09-29T20:14:32.890016+00:00"}
```

Other 30 Sep data at inspection time: 0 sales, 0 expenses, 0 repair jobs, 0 wallet entries, 2 shop_income rows.

## Update — the blocked steps were done after the user ran the migration

- User applied `20260930100000_close_day_digest_cash_income.sql` themselves. Verified on prod:
  `prosrc` of `rpc_close_day_digest` — exactly 1 function (no overload), body identical to the file
  (whitespace-normalised); staff REST call on 29 Sep now returns `cashIncome: 200` and
  `21,670 + 200 − 744.45 = 21,125.55 = toSend`.
- Reopened 30 Sep: deleted the one `day_closings` row (`895aa2f6-…`, values above) via service role.
- Seeded 30 Sep with `ZZTEST-DIGEST-*` rows through the owner's session (RPCs only): 2 products (SIM Ais
  qty 20, accessory), SIM bill (3 sold + 2 free, cash), ไทยช่วยไทย bill (200, transfer), True top-up 100,
  repair job with cash part cost 600 + bill 1,500, consignment-in device sold 4,000 with 3,500 cash payout,
  cash expense 250. Closed via `rpc_close_day` (counted 0), then re-closed with counted 1,350 (= toSend − 50)
  → header badge "แก้ไข", "ขาด ฿50". No LINE message was sent by the agent (RPC path, not the server action).
- Result (staff role → RPC → `digestFlex`, rendered as text): every section present; sales 5,950 =
  cash 5,750 + ไทยช่วยไทย 200; cash 5,750 + income 0 − cash-out 4,350 = 1,400 = toSend; no cost/profit text.
- Pre-run snapshot of existing test rows: scratchpad `zztest-before-digest.json` (cleanup by
  `node scripts/e2e-zztest.mts cleanup --snapshot <file>`; deleting = R0, deferred to the DB reset).
- **Unverified:** the new card in the LINE app. Prod currently serves the pre-PR-#3 card layout; the new
  one appears only after PR #3 is deployed. Off-bill cash income row is exercised by the 29 Sep data and the
  fixture, not by 30 Sep (income that day is 0 cash).
- Note: 30 Sep is *today's* real business day and now carries test data and a closed status.
