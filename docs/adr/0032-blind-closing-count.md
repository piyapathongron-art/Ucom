# ADR 0032: Blind closing count with a reason for any difference

Status: Accepted product decision on 2026-10-17; UI only, no SQL or API change.

Builds on [ADR 0027](0027-track-bank-deposits-and-carry-pending-cash.md) (closing records the counted amounts and the variance against the book) and [ADR 0031](0031-departure-without-receiving-pause.md) (closing keeps the receiving-POS pause).

## Context

The close-day cash zone listed all four system balances above the count fields. Staff could copy them into the fields, so the recorded variance was usually 0 and said nothing about the money actually in the shop. A difference only became visible after the count was saved, with no place to explain it. The pause instruction, the count fields and the confirmation were one undifferentiated card, and a disabled submit did not say why.

## Decision

- **Three ordered steps** on the close-day cash card: (1) the receiving POS is paused and has acknowledged the latest version (with a "check again" button, re-checked automatically when the tab regains focus); (2) count the drawer cash and the in-shop pending cash, locked until step 1 is done; (3) review the difference and confirm.
- **Blind count for staff.** Staff do not see system balances while counting. Owners do (they reconcile, and need the figures to decide on corrections).
- **Difference shown before confirming**, as a figure per fund ("ตรง" / "ขาด ฿X" / "เกิน ฿X"). Staff see the difference only; owners also see the system figure.
- **Reason required when any difference is non-zero.** The note moves from the page into the confirmation popup, is required there when a difference exists, and is part of the payload sent with the existing `close` action (the `note` field already exists).
- **Anyone may record a new revision** after the first closing (unchanged). Each revision is stored, not editable, and sent to LINE, so the owner can see how many times a day was counted. Not restricted to owners.
- Differences use the server's own definitions: drawer = count − drawer balance; pending = count − available (in-shop) balance.

## Alternatives not selected

- Show system balances to everyone (the previous behaviour): cheap, but the variance stops measuring anything.
- Restrict new revisions to the owner after the first closing: stops staff re-counting until the difference disappears, but blocks honest corrections when the owner is away. Not chosen by the product owner; revisit if repeated revisions show up in practice.
- Enforce the blind count server-side (return balances only to owners, compute variance in the RPC): the only version that is a control rather than a convenience, and a larger change to `rpc_cash_status` and the close action.

## Consequences

- The blind count is a UI behaviour, not a security control: a staff member who opens developer tools can still read the balances the client fetches, and re-counting reveals the difference each time. It improves the quality of honest counts; it does not stop deliberate manipulation.
- A difference is stored as recorded; the closing never adjusts balances (unchanged). Owners correct with the existing adjust tools.
- The note requirement is client-side only; the RPC still accepts an empty note.
