# Session log: ADR 0033 /liff/deposit (2026-11-25)

## Done

- Branch `design/0033-liff-deposit`, cut from `design/0033-cash` (the owner chose to stack it on #17), commit `83ad09f`. It is Draft PR #20, based on `design/0033-cash`.
- Only `LiffShell` changed:
  - loading is a white status card with a brand spinner;
  - failed is a danger-tint alert with a 48px primary ลองใหม่ and a 48px outline link to `/cash`.
- The form (`CashDeposit`) was already restyled in #17, and the signed-out view is the phone `LoginForm` from /login.
- Dropped from the canvas: the "U" tile, the progress bar, and the `LiffDone` buttons, which the code does not have.
- CI on #19 (/settings) passed 4/4 on a single read.

## Checks

- ESLint: 0 errors, 13 warnings (unchanged).
- `tsc`, `next build` and all 17 `*.check.mts` pass.
- A stub harness with a fake SDK ran at 375 and 1440 wide, covering the failed, pending and ready states. Every check passed. Alert contrast is 5.30:1.
- Not run: `motion-reduce` (could not be emulated), the real LIFF SDK in LINE, e2e and `tests/local-cash`.

## Open

- Step 6 routes are all done. Next: remove the old `ucom-*` classes and token aliases from `globals.css`. That needs every Step 6 PR merged first, or it must be stacked on all of them.
- Merge order: #11, then #13 to #19 against foundation, then #20 after #17. Each merge has the Step 6 text conflict in the rollout plan.
- Six session logs are uncommitted.
