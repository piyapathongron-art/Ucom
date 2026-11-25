# Session log: ADR 0033 /expenses (2026-11-25)

## Done

- Branch `design/0033-expenses`, cut from `design/0033-foundation`, commit `08a7d5a`. It is Draft PR #18, based on `design/0033-foundation`.
- /expenses is restyled on ADR 0033:
  - segmented tabs, labelled date filters and a search with a label;
  - method chips and 40px row actions;
  - a totals card;
  - cards below md, while the table and the test IDs stay as they were.
- `LedgerAddDialog`, which /close-day shares, has 48px fields and shows the cash-book hint only while the cash book is on.
- `FundSelect` is 48px, and the `Modal` close button is 40×40.

## Checks

- ESLint: 0 errors, 9 warnings (down from 13).
- `tsc`, `next build` and all 17 `*.check.mts` pass.
- A stub harness ran at 1440 and 375 wide, with the cash book on and off, on both tabs. Every check passed.
- Not run: e2e, real writes, and anything against real data.

## Open

- Remaining routes: /settings, then /liff/deposit (it uses `CashDeposit` from #17). After those, remove the `ucom-*` classes.
- Merging #13 to #18 will cause a text conflict in Step 6 of the rollout plan.
