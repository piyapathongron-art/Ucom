# Cash UX redesign — piece 3 (close-day cash zone)

Decisions: [ADR 0032](../docs/adr/0032-blind-closing-count.md) (grilling Q3–Q5, Q14, Q16–Q17).

## Changes (uncommitted)

- `CashClosing.tsx` rewritten as three steps: ① POS paused + acknowledged (button "ตรวจอีกครั้ง" plus an automatic re-check on window focus / tab visibility); ② count the two funds, locked until ① is done; ③ review and confirm, locked until both counts are filled, each with a one-line reason when disabled.
- Blind count: only owners see the system balances block; staff see nothing until the confirmation popup, which shows per fund "นับได้ ฿X · ขาด/เกิน/ตรง ฿Y" (owners also see "ระบบ ฿Z"). Definitions match the `close` action (drawer vs drawer balance, pending count vs in-shop balance).
- Reason required in the popup when any difference exists (confirm disabled until filled); optional otherwise. The note is locked into the stored payload at submit, so a retry replays the exact request. "ยอดระบบรุ่น N" removed from the popup.
- The closing note now appears in the saved-closing block and in the LINE card (`CashSnapshot.note`, `cashFlex.ts`, check added) — it was stored but never shown before, so a required reason would have been invisible.
- Anyone can still record a new revision (Q16 b); revision number shown as before.
- `tests/local-cash/daily-deposit.spec.ts`: new test for blind count → difference → required reason → saved with note.
- No SQL, RPC or server-action changes.

## Verification

- Browser, local lab (fixture `..._ux20261017i`, 375x812): owner sees balances and the three steps; staff do not see any balance; review stays disabled until counts are filled; popup shows "ขาด ฿20.00" and keeps confirm disabled until a reason is typed; cancel keeps the counts and stores nothing; after a departure (version bump) step ① shows waiting and ②/③ are locked; acknowledging the POS then a `focus` event unlocked them without pressing the button; owner confirmed a ฿7 shortfall with system figures shown, saved as revision 1 with note.
- `daily-deposit.spec.ts` on fresh fixture `..._ux20261017j`: 4 passed.
- `tsc`, `eslint`, cashFlex/deposit checks pass.
- Not verified: real POS tab switching (the focus event was dispatched, not a real tab change), LINE delivery of the note (lab has no LINE), real phone, light mode, a day with queued bills (step ① queue message).
