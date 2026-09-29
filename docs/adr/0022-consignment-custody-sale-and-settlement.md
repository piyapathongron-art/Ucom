# 0022 — Consignment custody, sale, and settlement are separate events

**Status:** Accepted, 2026-09-24.

A consigned device remains one `device_units` record. Sending a shop-owned device to a partner or receiving a partner-owned device changes custody, not revenue. The agreed partner share is recorded only when a sale is confirmed, never at intake.

For **consigned out**, a partner's sale report removes the device from available stock and creates a claim, but not a Ucom Sale. Ucom records a Sale only when the partner's money actually arrives, for the amount received. For **consigned in**, Ucom records the full customer payment as a Sale when collected and records the agreed payout to the owner as a separate consignment obligation; paying that obligation later clears it without creating a general Expense.

We rejected counting a partner's reported sale as Ucom revenue before remittance, booking the owner's payout as a general shop Expense, and duplicating consigned devices as Products. Each would contradict the existing definitions of Sale, Expense, or Device Unit. State transitions and settlement must be guarded against duplicate completion; closed records are immutable.

For the first release, an outgoing partner must remit the full agreed net amount in one settlement. Partial installments are deferred: they require a separate receipt ledger and cannot be represented by repeatedly editing one Sale. A cash payout for an incoming consignment reduces the close-day cash drawer calculation, but remains distinct from a shop Expense and is not subtracted from profit a second time because the agreed payout is already the device sale's cost snapshot.
