# Session log: ADR 0033 /settings (2026-11-25)

## Done

- Branch `design/0033-settings`, cut from `design/0033-foundation`, commit `3a2bf58`. It is Draft PR #19, based on `design/0033-foundation`.
- /settings is restyled on ADR 0033:
  - three white cards, with shop info shown as muted tiles;
  - one form per carrier rate, with a linked label, a 44px `tabular-nums` input and a 44px save button;
  - a 48px backup button, errors in the danger pair, and a success-tinted summary grid.
- Forms, test IDs and button names are unchanged for e2e.
- Dropped from the canvas: the Thai table names, the "อื่น ๆ" grouping, and the file name in the summary.

## Checks

- ESLint: 0 errors, 13 warnings (unchanged).
- `tsc`, `next build` and all 17 `*.check.mts` pass.
- A stub harness ran at 1440 and 375 wide, covering a rate save and an export. Every check passed.
- Not run: e2e, real writes, and anything against real data.

## Open

- An out-of-range rate shows the browser's native `max` tooltip instead of the Thai red alert. Adding `noValidate` to the form would fix it. That is the owner's call and out of scope here.
- Next route: /liff/deposit. It uses `CashDeposit` from #17, so the owner must choose to stack it on `design/0033-cash` or wait for #17 to merge. After that, remove the `ucom-*` classes.
- Merging #13 to #19 will cause a text conflict in Step 6 of the rollout plan.
- The session logs are uncommitted.
