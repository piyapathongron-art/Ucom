# 0027 — Separate shop drawer cash from sales cash awaiting deposit

## Status

Accepted for local implementation, 2026-10-07, after independent scrutiny and the owner's start instruction. Recommended receipt routing, separate physical counts/openings, staff reporting with owner review/corrections, transactional cash book, and one designated receiving POS are accepted. Reminder schedule remains owner-configurable and disabled until configured. Production migration, activation, deployment and external delivery require separate approval. References to proposed contracts below retain the reviewed design rationale; implementation follows [the API contract](../pos/spec-two-fund-cash-api.md).

## Context

Staff currently report bank deposits in LINE by listing daily cash amounts, attaching a receipt, and explaining the amount left over. The existing close-day digest supplies daily expected cash and counted cash separately, but the source has no bank-deposit or separate shop-drawer balance workflow. The owner clarified that shop drawer cash and sales cash awaiting deposit are tracked separately; deposit remainder goes into the shop drawer.

## Decision

- The first version will track the complete flow: track daily cash, report a bank deposit with evidence, require human confirmation, and show the cash balances.
- Track two funds separately: **Shop Drawer Cash** for cash retained for shop use, and **Pending Deposit Cash** for cash sales awaiting bank deposit.
- When recording a payment, staff may choose Shop Drawer Cash, Pending Deposit Cash, or a transfer from the shop's bank account. An outflow reduces only the chosen cash fund; a bank transfer reduces neither cash fund. This includes repair parts, which may be paid by bank transfer when expensive. A cash outflow already recorded as an expense, part payment, or consignment payout must not also be deducted as a duplicate withdrawal.
- Transfer the deposit remainder into Shop Drawer Cash. In the agreed example, THB 16,457 awaiting deposit becomes THB 16,400 deposited and THB 57 transferred to the drawer. The THB 57 is no longer pending deposit and increases the drawer balance by the same amount. This replaces the earlier interpretation that the remainder must carry into the next deposit round.
- Show the current Shop Drawer Cash balance both at shop closing and when preparing or recording a bank deposit.
- Record the bank-deposit amount and the remainder transferred to the drawer separately. Any amount allocated to neither stays pending deposit. Both allocations together must not exceed the available pending cash. For a partial-deposit example, THB 16,457 pending minus THB 10,000 deposited minus THB 57 transferred to the drawer leaves THB 6,400 pending.
- A remainder transfer is an internal cash movement, not new sales, income, or an expense.
- Staff may deposit when convenient, including daily or after several days. Reminder scheduling is separate from deposit timing and must not restrict when a deposit can be recorded.
- Rejected first-version scope: reminders and totals alone, because they leave deposit completion and remaining cash to manual tracking. Automatic interpretation of free-text messages and receipt images is not part of the accepted first-version scope.

## Proposed design contracts

These contracts are the recommended solution to the independent review. They do not authorize implementation, migration, or production activity.

### One cash book, existing business records

- Keep existing sales, repairs, expenses, and consignments as their business/reporting records. Add only the cash movements needed to derive the two fund balances; do not create a second sales or expense system.
- Each cash receipt/payment posts its fund movement exactly once, tied to its originating record and operation identity. Both writes commit together. Bank transfers post no cash movement. A closing count is an observation and must never create a receipt or reset a calculated balance.
- Fund balances are derived from opening movements and subsequent posted movements. A single cash-book lock serializes changes for this shop; it protects reservation availability and postings without maintaining a second editable balance. Every affected writer must take this lock in the same order before checking or changing availability. Reuse the repository's unique request identity and row-locking patterns.
- `toSend` is daily net cash, not the pending-deposit fund balance. Never feed `toSend` or `counted_cash` into the pending fund. Cash receipts route to the selected receipt fund; outflows debit the selected payment source once.
- After cutover, replace the operational "ยอดที่ต้องส่ง" and its single-count reconciliation with separately labelled fund balances, counts, and variance. If daily net cash is retained for analysis, label it "เงินสดเคลื่อนไหวสุทธิวันนี้" and keep it distinct from available deposit cash. This amends ADR 0014/0026 for post-cutover closing reconciliation, without changing cost ownership or cash/transfer meaning. Before cutover, their existing behavior remains in force.
- Money is finite, nonnegative input with at most two decimal places, handled exactly in satang; allocations cannot use binary floating-point approximations. Payments require a positive amount and sufficient available cash in the selected fund. No silent clamping or automatic borrowing from the other fund. Initial version uses one payment source per payment; splitting a payment requires a separate future decision.

### Deposit lifecycle and availability

Let `P` be pending cash, `H` the total of active handover reservations, and `D` drawer cash. Pending cash available in the shop is `P - H`. Handed-over cash remains part of the pending business fund, with a named custodian, but cannot be spent or reserved again. This is a custody status, not a third business cash fund.

| Event | Financial effect | Review state |
| --- | --- | --- |
| Draft deposit | None; draft does not permit physical withdrawal | Draft |
| Staff takes `T` to deposit | Reserve `T` atomically; require `0 < T <= P - H`; record staff, time, and operation ID | Cash handed over |
| Bank deposit reported and remaining cash physically returned | For this handover require `T = B + R + U`, where `B` is deposited, `R` is returned into drawer, and `U` is returned into pending cash. Post `P -= B + R`, `D += R`, release reservation `T` atomically; record evidence and actual bank-deposit time | Awaiting evidence review |
| Authorized reviewer confirms | Change verification state only; no additional debit, transfer, or reservation release | Confirmed |
| Evidence rejected | Cash stays removed from available funds as already posted; require corrected evidence or an explicit financial correction | Evidence disputed |
| Handover cancelled and all cash physically returned to pending cash | Release `T` once; pending total does not change; record actual return and actor | Returned without deposit |

- For the initial version, settlement of a handover requires all undeposited cash to have physically returned, and `B > 0`, `R >= 0`, `U >= 0`. Cash still with the custodian keeps the handover open; it must not be reported as available shop cash. The recorded bank deposit may be partial: reserve only the amount taken, leaving other cash available in the shop.
- Cash deposited before evidence review is already outside the shop. Confirmation attests that evidence and bank receipt have been reviewed; it does not cause a second cash removal. A disputed deposit requires explicit resolution and does not automatically restore cash. No bank-feed verification is claimed.
- A remainder reaches `D` only after physical return to the drawer. A preview may show projected amounts, but the balances remain unchanged until the atomic settlement succeeds. This prevents displaying cash that is still at the bank or with staff as drawer cash.
- Staff must record handover before taking cash. The design cannot track unreported physical movements; unresolved handovers are visible at closing and in the deposit view.

### Concurrency, identity, and failure behavior

- Handover, settlement, cancellation, payment, receipt, and owner correction enforce availability under the same cash-book lock. Deposit postings and remainder postings are one transaction; either all commit or none do.
- Each mutation has a unique operation ID scoped to this cash book and a bound request payload. After authenticating and authorizing the caller, replaying the same ID/payload returns the original result without effects, before rechecking today's availability. Reusing an ID with different amounts, source, or actor fails. Settlement and review state transitions are conditional, so another request ID cannot settle the same handover twice.
- LINE notification occurs after commit and is best effort. Its failure never undoes money, changes confirmation, or invites resubmission of the financial operation. "Resend notification" reads the committed operation and only sends a message.
- No offline financial queue for handover or deposit actions in the initial version. Existing offline sales retain their operation identities; an eligible post-cutover cash posting must join the replay-safe sale transaction when synchronized. It must follow the cutover/activation-epoch rule below, not the time of sync. Until synchronized, available cash is labelled as recorded cash. The designated cash-receiving POS must have an acknowledged empty cash-sale queue before closing or taking cash for deposit; a deposit phone's empty local queue is not evidence that the POS queue is empty.
- Proposed first-version topology: one designated cash-receiving POS across the shop, including cash sales for repairs/top-ups; handover/reporting phones and online owner/staff administrative actions may be separate devices. If the shop needs multiple offline cash-receiving devices, keep the feature disabled until a reliable all-device synchronization barrier is designed and approved. Do not silently enable this version under that topology.

### Every write path, corrections, and actual returns

| Origin | Required integration |
| --- | --- |
| Cash sales, including repair/top-up sale receipts and offline replay | Receipt posting in the same transaction as the sale; cash-fund routing follows the approved receipt rule |
| Staff/owner expenses | Fund selection and atomic posting, including the owner page currently using direct insert/delete |
| Repair part payments | Distinguish actual new payment from correction of an already paid part cost; preserve the original movement time |
| Incoming-consignment owner payout | Atomic fund debit with the existing locked settlement; repeated settlement stays a no-op |
| Off-bill income and commission receipts that create cash income | One linked cash receipt, avoiding duplication through both commission and income paths |
| Source edits, voids, refunds, bank/cash changes, and opening/cash-count corrections | Explicit owner-authorized correction or actual-return workflow, not an untracked table mutation |

- Protect post-cutover money fields and deletion at the database boundary. Route existing direct client writes through member/role-gated transactional RPCs, and remove their ability to bypass cash posting. Review RLS/grants and every caller before cutover. A UI selector alone is insufficient.
- Cash movement history is immutable. A correction stores actor, reason, source operation, and compensating entries; it never overwrites or deletes a posted cash movement. Corrected descriptive fields or report dates do not move cash or rewrite its original time.
- Correcting the amount/source of an already recorded movement supersedes that movement through one atomic, auditable correction. It represents a bookkeeping correction, not a new receipt or actual refund. A real cash refund/return is a separately identified movement at the time cash changes hands. The same returned amount cannot be posted by both workflows.
- A correction must preserve complete source-to-cash linkage, respect active reservations, and cannot create negative available cash. If past data cannot be corrected consistently under these rules, mark it for owner reconciliation and block the correction; do not fabricate cash or silently change a completed deposit.
- Voiding a document alone is not proof of cash return. Post-cutover financial records use an auditable void/correction workflow rather than physical deletion. Legacy pre-cutover edits do not automatically generate cash movements; an actual payment/refund occurring after cutover needs an explicit current movement.
- Staff advances and temporary personal withdrawals are excluded from this proposed first version until the owner confirms their necessity and rules. A handover to a bank depositor is the specified custody workflow, not a personal advance.

### Cutover, physical counts, and time

- Proposed start: pause cash-taking and fund-changing activity; drain every authorized cash-receiving device's offline queue and obtain server acknowledgement for all operations. Resolve unsynchronized cash repair/top-up sales as well, with no unresolved pre-system handover. Then owner counts drawer cash and pending cash at a declared Bangkok timestamp; seed each once in an atomic, replay-safe initialization and activate the new cash-book epoch. No movement may occur between counting and activation; otherwise recount. Resume only with compatible clients.
- Every new cash mutation must identify the active server-issued cash-book epoch. Old clients or queued operations without that epoch cannot silently post to the new book. A known pre-cutover source replay returns its existing business result without a new cash entry. An unexpected old/missing-epoch operation is blocked from source/cash mutation and flagged for owner classification, never assumed to be a fresh receipt because it synced late. If the owner confirms its cash was already covered by opening balances, record the business operation once with its original operation ID and an explicit opening-covered classification, with no additional cash receipt. Truly new physical money needs an explicit authorized current-epoch operation. Device clocks and sync timestamps alone cannot decide this classification.
- Do not reconstruct missing historical deposit/source attribution, replay imported receipts, or add opening-covered cash sales to the seeded amounts. Source/cash history must make the opening-covered classification auditable.
- Receipt/payment booking uses actual cash-movement time and an immutable posting sequence. Business report dates may be different and must not make a backdated record silently alter an earlier closing snapshot. A legacy record is classified before any new physical payment is posted; editing legacy descriptive/payment-method data alone cannot imply that cash changed hands.
- Proposed closing: count drawer cash and shop-held available pending cash separately when physically distinguishable; show each expected amount, actual count, and difference. Show handed-over cash and custodian separately; never include it in the cash expected to be physically in the drawer/shop. If only a combined count is possible, label that limitation and do not claim separately verified fund counts.
- Counts do not change expected money. An owner may reconcile a confirmed shortage/overage through an explicit reasoned adjustment, preserving the original count and expected balance. No automatic adjustment from a mismatch.
- Capture a closing's balances, reservations, count, and daily figures consistently under the cash-book lock, tied to a posting-sequence cutoff. Reject a stale count submission if intervening movements changed the loaded cash-book version; staff must refresh and recount. Re-closing creates a new revision rather than overwriting the previous physical count.
- Post-cutover LINE closing cards and deposit-event cards use their stored event snapshot/revision and explicit timestamp. Resends reproduce that snapshot; they do not mix a historical count with today's funds. "Current funds" and reminder cards query current balances and display their own as-of time. This amends ADR 0025's recompute-on-resend rule for new cards only; legacy cards retain their clearly identified legacy behavior.

### POS authentication, evidence, and LINE

- Proposed initial interaction: LINE cards open an authenticated mobile POS form. Reuse existing Supabase sessions, Ucom membership, and fixed-group push. Preserve the form destination across login using a validated internal return path; no arbitrary external redirect.
- Every financial mutation and evidence read checks Ucom membership and the action's approved role on the server/DB. A shared-project session, LINE group membership, display name, or uploaded receipt is not authorization. Record reporter/reviewer identities from verified sessions.
- Proposed roles: staff/owner report handover/deposit; owner reviews bank receipt, configures opening balances, and performs corrections. Keep this proposal pending owner approval; the reviewed design must not silently grant staff confirmation or financial correction rights.
- Evidence uses private storage and operation-linked authorization, validated image/file type and size, and retry-safe upload association. A failed upload cannot settle money or mark evidence verified. Abandoned uploads are retained for an approved cleanup procedure; no automatic deletion is authorized by this ADR.
- Do not expose public evidence links or mutation capabilities in the LINE group. The card links to an authenticated POS view. Continue the existing staff-safe disclosure boundary: no profit in group messages and no new unrelated cost visibility.
- Bot responses and incoming group messages cannot mutate money in this proposed first version. Reminder configuration is owner-controlled, independent of deposit timing, and should notify for actionable pending cash or overdue custody, with retry-safe delivery tracking. Exact day/time and thresholds remain owner choices.

## Alternatives and approval gates

The recommended draft is small cash-movement history plus reservations, using existing POS forms/auth and LINE delivery. Rejected as a recommendation: deriving two funds by summing daily `toSend` (wrong attribution), resetting balances to physical counts (erases variance), and authorizing money through raw group chat (adds identity/security scope). The owner may choose another design after considering these trade-offs.

Before implementation, the owner must confirm:

1. **Receipt routing:** recommend all business cash receipts (sales, repairs, off-bill income) to pending cash; alternative off-bill cash to drawer or selected per receipt.
2. **Counts and start:** recommend physically separate counts plus verified opening amounts at cutover; alternative combined counts with explicitly unverified individual splits, or beginning after the next completed deposit. Never infer balances from incomplete legacy history.
3. **Custody, roles, and corrections:** approve the proposed reservation/physical-return lifecycle, staff reporting with owner review, and explicit owner reconciliation; alternative self-confirmation needs a revised authorization design. Decide whether personal advances are actually required.
4. **Integration:** approve the proposed cash book, transactional writer coverage, immutable snapshots, and authenticated POS interaction before choosing SQL/API details. All post-cutover financial writers must support the new model together; do not partially enable balances.
5. **Reminder operation and device topology:** select day/time/threshold and approve one designated cash-receiving POS with acknowledged synchronization before closing/deposit. This is a shop-wide receiving-device boundary, not a restriction to one deposit phone. Multiple offline receiving devices require a separately reviewed synchronization barrier before activation.

## Receiving-pause decision (accepted 2026-10-08)

The owner selected an explicit receiving-POS pause before handover or closing. A recent queue-empty timestamp was rejected: a new offline receipt can arrive after acknowledgement without invalidating that timestamp on the server. The earlier decision to retain new offline receipts was superseded on 2026-10-09: prioritize ordinary online billing and temporarily disable new offline bills. Existing queued receipts and requests with unknown outcomes must remain recoverable with their original IDs/payloads; this is not authorization to delete old queues. Fresh intake must obtain current server status rather than rely on cached status. A transport failure must not optimistically clear the cart, deduct local stock or appear to complete an offline sale. Pause/version protection remains required for handover and closing.

The receiving browser persists a local pause before requesting server acknowledgement. Every tab shares the same receipt-intake lock and checks the persisted pause, including offline intake. Pause is available only after all pending receipts are resolved and the queue is drained; it certifies the current version. Server receipt writers reject new receipts while paused. Handover and closing require that explicit pause and matching version; they do not automatically resume intake. Only the designated browser's private proof can resume. Resume clears server acknowledgement before clearing the local pause; an unknown response leaves receiving blocked until online recovery succeeds. Existing committed operation retries remain idempotent while paused.

## Implementation sequence and acceptance

1. After approval, inventory and trace every relevant writer/RPC/grant and prepare the exact schema/API specification and rollback/cutover procedure. Re-read current Next.js/Supabase documentation before framework or database implementation.
2. Implement transactional cash posting/reservations and integrate all listed source paths; keep the feature disabled until attribution, correction, and permission paths are complete. Preserve pre-cutover contracts and legacy history.
3. Add mobile POS handover/deposit/review and per-fund closing displays, then LINE snapshots and independent reminders. Preserve navigation, existing owner/staff boundaries, and fixed-group delivery.
4. Verify conservation, exact money validation, no duplicate deduction, partial settlement/return, bank transfers, source corrections, replayed sale/payment/deposit requests, concurrent spending/deposits, stale counts, history resends, unauthorized access, and notification/upload failures. Include the explicit cutover case: THB 100 from a pre-cutover queued cash sale is already in a THB 1,000 opening balance; its later replay must never produce THB 1,100. Check old/missing epochs, opening-covered owner classification, acknowledged receiving-device queues, and rejection of unsupported multi-device offline topology. Reuse the repository's runners and patterns; introduce no new test framework.
5. Before enabling, verify real HTTP/RPC paths and the authorized mobile/browser/LINE layers. Production schema apply, opening writes, deploy, external messages, and cleanup require their exact separate R0 approvals; browser acceptance requires the repository's explicit verification choice. No runtime or production verification is implied by a passed document review.
