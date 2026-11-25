# Session log: ADR 0033 /cash (2026-11-25)

## Done

- Branch `design/0033-cash`, cut from `design/0033-foundation`, commit `a6cc42c`. It is Draft PR #17, based on `design/0033-foundation`.
- /cash is restyled on ADR 0033. The change is visual only: the cash logic and RPCs are untouched.
  - Owner page: it now uses `PageFrame`, with balance tiles, review cards and the owner tools.
  - Staff page, which /liff/deposit also uses: day cards, the summary box, the slip form and the handover card.
- Shared classes live in `cash/cash-styles.ts`. The `Modal` close button is 40×40.

## Checks

- ESLint: 0 errors, 13 warnings.
- `tsc`, `next build` and all 17 `*.check.mts` pass.
- A harness rendered `CashOverview` and `CashDeposit` with a fake status at 1440 and 375 wide. Everything passed except one problem, which is now fixed but not re-measured: the owner-tool modals overflowed at 375.
- Not run: the server component with real data, any real submit, `tests/local-cash`, and e2e.

## Open

- **ADR 0032 conflict.** Staff /cash and /liff/deposit show the drawer and pending balances, which are the figures close-day hides from staff. The owner chose to keep them for now and needs to decide later.
- Remaining routes: /expenses, /settings, /liff/deposit (shares `CashDeposit`, so it already has the new cards), then removing the `ucom-*` classes.
- Merging #13 to #17 will cause a text conflict in Step 6 of the rollout plan.
