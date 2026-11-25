# Session log: LIFF deposit polish and Step 6 merges (2026-11-25)

## Done

- **Phase A merges.** #13 to #20 are merged into `design/0033-foundation`.
  - Each rollout-plan conflict was resolved by keeping both sides, and a script checked that no lines were lost.
  - #20 was retargeted from `design/0033-cash` to foundation before it was merged.
  - Commit `2593c82` added blank lines between the merged status blocks.
  - On foundation, ESLint has 0 errors and 0 warnings, and `tsc`, `next build` and all 17 checks pass.
  - #11 (foundation → `main`, a production deploy) is still open.
- **LIFF design review.** It found three problems in the shared `CashForm` and `HandoverCard`.
- **Fixes.** They are on branch `design/0033-liff-polish` (commit `0f0c303`), in Draft PR #21 based on foundation:
  - no blocked-intent warning flash while localStorage is checked;
  - errors shown as danger alerts;
  - a live settle total.
- **Canvas.** Five v2 boards were added on the LIFF page, under the title "v2 · หลังแก้ 3 จุด". The old boards are kept.
- **Plan correction.** The ส่งสรุปเดิมเข้า LINE อีกครั้ง link does exist. Only a close-window button is missing.

## Checks

- ESLint (0 errors, 0 warnings), `tsc`, `next build` and all 17 `*.check.mts` pass.
- A stub harness ran at 375 wide.
  - The first run caught the live total turning amber on load, because `FormData` skips inputs in a disabled fieldset. That is fixed and re-checked: the total stays green through load, including when the fieldset stays disabled the whole time.
  - The other states, the alerts, the no-flash check and overflow all pass.
- Not run: a successful real submit, LINE itself, e2e and `tests/local-cash`.

## Open

- Owner decisions from the v2 boards:
  - a ปิดหน้านี้ button (`liff.closeWindow()`);
  - a step progress bar;
  - showing the chosen slip's file name.
- Merging #11 deploys production, so the timing is the owner's call.
- Remove the old `ucom-*` classes and token aliases from `globals.css`. The cash form still uses `ucom-primary`, `ucom-secondary` and `ucom-field`.
- Seven session logs are uncommitted.
