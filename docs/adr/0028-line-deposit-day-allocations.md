# ADR 0028: LINE deposit entry with conserved daily cash allocations

Date: 2026-10-09. Status: **Accepted; implemented and independently scrutinized PASS for local integration.** SQL/HTTP, assertion checks, build and authorized mobile browser checks passed. Hosted Auth/Storage and actual LINE delivery remain unverified. This does not authorize migration application, deployment, activation or LINE sends. See [release evidence](../pos/release-line-daily-deposits-2026-10-09.md).

## Context and decisions

Extend [ADR 0027](0027-track-bank-deposits-and-carry-pending-cash.md) without replacing its accounting, member authentication, receiving-device pause, evidence or owner-review boundaries. `/ฝากเงิน` in the configured group replies with navigation to `/cash?intent=deposit`. The authenticated mobile web form selects outstanding dates; chat itself never moves money. Full LIFF identity linking and chat image ingestion are unnecessary for this version.

The accepted rules are: online-only new bills; pending spending consumes available cash FIFO; one selectable unknown-date opening batch; drawer remainder is physically separated before departure and stays in the drawer on cancellation; selected daily amounts appear in the group message. Existing queued bills retain their original receipt dates and cutover classification. Do not reconstruct opening pending cash from imported gross sales.

The engineering decision is an immutable allocation journal beneath the existing pending-fund posting/finalization boundary. Receipt origins carry a business day; consumed/reserved/restored amounts retain that origin. Mutable projections may be derived, but cannot become a second financial truth. A deposit-only table or daily sales query cannot conserve expenses, refunds, reservations and corrections.

## Receipt days and provenance

For ordinary sales, including repair and consignment collection represented by a linked sale, use `(sales.sold_at AT TIME ZONE 'Asia/Bangkok')::date`. Count the sale receipt once, never also the repair/consignment row. Off-bill income uses the existing `shop_income.received_at` date. The source is the final persisted business record, not movement creation time or client-selected deposit date. Online-only intake does not authorize overwriting an original UUID/payload date on an ambiguous retry. Covered pre-opening receipts produce no new cash allocation.

Opening pending cash and positive reconciliation without a receipt source use explicit null-day origins. Display the opening origin as “ยอดตั้งต้น / ไม่ทราบวัน”; other unattributed reconciliation as “ปรับยอด / ไม่ทราบวัน”, with its reason. FIFO puts null-day origins first, then receipt day, then original movement sequence and origin ID. Same-day origins remain individually traceable but are grouped for date selection.

Freeze the first finalized receipt day on source metadata, including transfer-paid sources with no pending origin. Positive corrections and reclassification use that frozen day. Existing guards omit sales.sold_at and shop_income.received_at: extend them to reject date-only edits after source attribution, including edits inside financial correction. A current editable source date is not sufficient provenance.

## Conservation and physical handling

Under the existing singleton book lock, `pending = available + reserved = sum outstanding origin amounts`. Every available/reserved origin is nonnegative. Negative pending spending consumes only unreserved origins FIFO. Drawer/transfer movements have no pending allocation except explicit inter-fund transitions. Posting and allocation journaling commit or roll back together.

The first form selects complete currently available date groups (and individually identified unknown-date batches), not invented gross-sales amounts. A fresh status version and each expected selected amount are mandatory. One atomic departure operation moves the requested drawer remainder from selected cash to drawer, then reserves only the remaining bank-bound cash. Allocate drawer cash FIFO within the selected origins; preserve both slices. `selectedTotal = drawerBeforeDeparture + bankBound`; bankBound must be positive. Existing receiving pause/ACK rules apply; ordinary phones cannot acknowledge the receiving POS on its behalf.

Settlement removes bank money and any additional physically returned drawer cash from the reserved origins FIFO in that order; returned pending money becomes available on its original origins/dates. `bank + drawerAfterReturn + returnedPending = bankBound`, bank > 0. Cancellation returns the entire bankBound to those original origins after physical-return confirmation. It does not undo drawerBeforeDeparture. Owner review/dispute/evidence replacement and resend have no financial effect.

## Corrections without rewriting deposited history

An expense/parts/payout correction which reverses prior pending spending restores the exact recorded un-reversed origin slices; a new pending expenditure consumes FIFO again. Source-fund switches must net and validate all movements in one transaction. Partial reversal restores original consumed slices FIFO and records which debit slices it reverses; repeated corrections cannot restore a slice twice.

An increased cash receipt preserves its recorded business day. A reduced or reclassified receipt consumes its own remaining available origin first, then other available cash FIFO where necessary; reserved cash is untouched. The current book must have enough available cash. If the original receipt was already deposited, this is a current compensating correction using today's available cash, explicitly labelled as such; neither the prior bank deposit nor its selected-day snapshot changes. Actual refunds consume available pending FIFO or the chosen drawer fund, respecting the existing refund ceiling. Positive reconciliation is unknown-date, never fictitious sales. The existing restrictions on corrections after covered-sale classification/refund remain.

## Durable client recovery

Existing CashForm pending operations are sessionStorage-only and are not scanned by PendingCashRequests/hasPendingCashRequests. Correct this gap before activation. Persist an actor-bound, versioned exact UUID/epoch/action/payload in localStorage before financial dispatch; scan it across reload/closed-tab recovery in global pending/ACK/new-intent gates. Preserve corrupt and foreign-actor records; authentication failure or actor/payload mismatch is not proof the previous attempt failed. Native per-operation/create-intent locks serialize tabs while retaining the existing receiving lock. Recover cash event requests through executeCash or explicit committed-snapshot notification so replay does not bypass LINE delivery. Preserve/import old sessionStorage UUIDs without guessing legacy ownership or deleting unverifiable intents.

## API, history and compatibility

The existing `rpc_cash_execute(uuid,uuid,text,jsonb)` signature remains. Add `handover_days` rather than silently changing `handover.amount`, which continues to mean bank-bound reservation. Detailed payloads, journal invariants and tests are in [the specification](../pos/spec-line-deposit-day-allocations.md). Every operation result persists an immutable snapshot with original selected lines, drawer-before-departure slices, bank-bound slices, event/review state, actor, timestamp and balances. Use operation results for event resends rather than reconstructing from mutable handover state. Private evidence URLs are generated after web authorization; the group receives no signed evidence URL.

Use a new additive migration; do not edit the four installed migrations. Install and enable allocation support while the cash book is unopened, before opening. Reject activation if an existing non-null epoch or cash history needs conversion: stop and obtain a separate conversion plan, rather than guess per-day history. Once allocation support is enabled, pooled legacy `handover` requests must fail closed with a refresh-required error; the new web form uses `handover_days`. All other existing money writers route through the shared allocation-aware posting boundary.

## Alternatives not selected

- Daily gross sales as selectable pending amounts: simpler display, incorrect after spending/deposits/returns; rejected.
- Separate deposit bookkeeping outside the cash ledger: duplicates balance logic and allows divergence; rejected.
- Take all cash out and return remainder afterward: valid ADR 0027 flow, but does not implement the accepted physical pre-departure separation; retained only for existing history.
- LIFF account binding or direct chat receipt upload: adds identity/conversation state without improving this authenticated form's core accounting; deferred.

## Acceptance and outstanding scope

No new owner business fork is introduced by this ADR. FIFO tie breaking and partial-reversal ordering make accepted FIFO deterministic; they are reviewable engineering rules. Scrutiny must challenge conservation, source corrections after deposit, authorization, retry behavior and LINE size handling before code. Production writes, deployment, physical opening and actual LINE acceptance remain separately scoped gates.
