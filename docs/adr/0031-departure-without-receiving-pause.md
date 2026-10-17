# ADR 0031: Deposit departure without receiving-POS pause

Status: Accepted product decision on 2026-10-17; migration written, not applied.

Supersedes, for `handover_days` only, the receiving-pause requirement in [ADR 0027](0027-track-bank-deposits-and-carry-pending-cash.md) ("Receiving-pause decision") and the "fresh status version" and "Existing receiving pause/ACK rules apply" clauses of [ADR 0028](0028-line-deposit-day-allocations.md). Closing is unchanged.

## Context

Before staff could take selected deposit days out of the shop, `rpc_cash_execute` required the designated receiving POS to be explicitly paused with `ack_version = version`, and `payload.version` to equal the book version. Every operation increments the version, so the pause was what kept the version still while staff selected days on a phone.

In practice this meant two trips to the main POS (pause, then resume) and a manual refresh of the LIFF page. Forgetting to resume blocks all sales until someone returns to the main POS.

The pause was introduced (2026-10-08) because offline receipts could reach the server after an acknowledgement. On 2026-10-09 new offline bills were disabled (`4c235c7`, deployed with `af78a51`); `enqueue` has no remaining caller. Every new receipt now commits online under the singleton book row lock.

`ucom_cash_depart_days` already runs under that lock and rejects the departure (40001) unless every selected line equals its complete current available amount. A receipt posted after the phone loaded the days lands in its own receipt-day origin and leaves the selected lines unchanged; a pending-fund debit that consumes a selected line changes its amount and is rejected. A late replay of a pre-existing queued bill only adds available cash to its day, which matches the physical cash still in the shop.

## Decision

- `handover_days` no longer requires the receiving pause/ACK and no longer compares `payload.version` with the book version. Exact per-line amounts under the book lock are the concurrency check.
- `close` keeps the explicit pause/ACK and version check, because a closing compares whole-fund physical counts with the book at one moment.
- The client still sends `version` so a UI deployed before the migration keeps working with the old server when the POS is paused.

## Alternatives not selected

- Keep the pause and only improve the UI (re-check button, polling, plainer wording): no database change, but the two POS trips and the forgotten-resume risk remain.
- Let the phone pause the POS remotely: more moving parts, and ADR 0028 states that ordinary phones cannot acknowledge on the receiving POS's behalf.

## Consequences

- If offline bill intake is re-enabled, revisit this decision before doing so.
- `rpc_cash_pending_days` still validates its paging cursor against the version. A receipt during paging makes the load fail and the staff member reloads; typical shops have one page.
- Migration `20261017090000_handover_without_receiving_pause.sql` replaces `rpc_cash_execute` with the same signature; its body differs from the production definition dumped on 2026-10-17 only in this gate. Applying it to production is a separate, approved step. Apply it before or together with the UI that hides the pause instruction.
