# Session log: ADR 0033 /topup (2026-11-25)

## Done

- Branch `design/0033-topup`, cut from `design/0033-foundation`, commit `26372bb`. It is Draft PR #16, based on `design/0033-foundation`.
- /topup is restyled on ADR 0033:
  - the wallet cards and the opening form;
  - the sale form, with a radiogroup for cash or transfer;
  - the fund dialog, now showing "ยอดหลังเติม";
  - the history, moved into `TopupHistory.tsx`: a table from md up and a list below md.
- The fund button is now secondary.
- The `Modal` close button is 40×40, the same change as in #15.

## Checks

- ESLint: 0 errors, 13 warnings.
- `tsc`, `next build` and all 17 `*.check.mts` pass.
- A stub harness ran at 1440 and 375 wide, as owner and as staff. Every check passed: no overflow, every control at least 40px, no console errors.
- Not run: e2e, real writes, and anything against real data.

## Open

- Left out of the canvas, so the owner can decide on each:
  - a "ใกล้หมด" state, which needs a threshold;
  - quick-amount chips.
- If the R12 harness or the auth harness is run again, `getUser()` needs a fake `sb-127-auth-token` cookie as well as the `/auth/v1/user` stub.
- Remaining routes, in order: /cash (ADR 0032 blind count), /expenses, /settings, /liff/deposit, then removing the `ucom-*` classes.
- Merging #13, #14, #15 and #16 will cause a text conflict in Step 6 of the rollout plan.
