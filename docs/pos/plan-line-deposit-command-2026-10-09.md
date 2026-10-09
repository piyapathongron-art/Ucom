# LINE deposit command and day selection — implementation plan

Date: 2026-10-09. Status: **Owner accepted the consolidated plan and its recommended opening/cancellation rules by instructing execution. Online-only new billing is implemented locally. ADR 0028 and the detailed API contract passed independent design scrutiny after frozen-date and durable-recovery revisions. Command/day-allocation implementation and runtime verification remain outstanding. This design revision makes no production change.**

## Requested behavior

Staff sends `/ฝากเงิน` in the configured shop group. The bot returns an entry to a complete mobile deposit form. Staff selects still-pending cash dates, sees the aggregate amount, enters any remainder going to the drawer, reports the actual deposit and uploads its receipt. Confirmation posts an owner-readable summary to the same configured group. Owner bank/evidence review remains separate from staff reporting.

## Verified current implementation

- `src/app/api/line/webhook/route.ts` verifies signatures and handles group joins only; it has no message command handler.
- Cash status tracks pooled pending cash, reservations and source provenance, without daily outstanding allocation. Displaying daily sales as daily undeposited money would be incorrect after expenses, partial deposits and corrections.
- Existing handover reserves all money taken out; settlement allocates bank + returned drawer cash + returned pending cash. Moving drawer cash before leaving differs from that existing operation and cannot be treated as a label-only change.
- Existing Supabase member auth, safe login return paths, private evidence upload, immutable/idempotent cash commands and group snapshot push can be reused.
- Opening and deployment remain pending even though the four base migrations are installed. Installed migration files must not be retroactively edited to change live contracts.

## Proposed smallest LINE integration

`/ฝากเงิน` → reply card → authenticated mobile web form opened inside LINE. Match only the configured `LINE_GROUP_ID`; preserve signature verification. Command replies contain navigation only, not financial figures or evidence links. No financial mutation occurs in webhook handling. Existing POS member identity authorizes form actions; no LINE identity binding is needed for navigation alone. Initial login may be required because LINE's browser can have a separate session.

Flex components do not supply a full numeric/selection/upload form. URI actions open the LINE in-app browser: [Flex elements](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/), [actions](https://developers.line.biz/en/docs/messaging-api/actions/). Chat image receipt collection is possible but adds conversation-to-operation association and identity binding: [receiving messages](https://developers.line.biz/en/docs/messaging-api/receiving-messages/). LIFF is available but unnecessary solely to open an authenticated web form: [LIFF overview](https://developers.line.biz/en/docs/liff/overview/).

## Accepted direction and remaining design frontier

1. **Daily attribution:** recommend actual outstanding day allocations, spending from pending cash consumes oldest available day first. Alternative: retain a pooled total and show days only as informational references. A cash receipt/date list is not sufficient to prevent repeat deposits; reservations, deposits, returns, expenses, refunds and corrections must preserve allocation conservation. Opening cash has no inferred historical dates.
2. **Drawer remainder timing:** recommend physically setting aside and posting the drawer portion before departure; only the bank-bound portion is handed out. Alternative: preserve the current take-all/return-remainder settlement. Any pre-departure transfer must be atomic with reservation and protected by the existing receiving pause/version checks.

The owner replied “ตามนี้” after confirming the per-day message format and later instructed “ดำเนินการตาม plan เลย” after the consolidated plan restated its recommendations. The accepted design uses FIFO daily allocations, one unknown-date opening batch and retained pre-departure drawer money on cancellation. This is design authorization, not approval to apply another production migration. Precise source/date, correction, conservation and retry rules are proposed in [ADR 0028](../adr/0028-line-deposit-day-allocations.md) and [the detailed contract](spec-line-deposit-day-allocations.md); their engineering implementation awaits scrutiny.

## Proposed group summary

Show reporter/custodian, selected days with allocated amounts, selected total, actual bank deposit, drawer allocation, returned pending cash, post-operation drawer balance, pending cash still at shop/in custody, reported time and explicit “awaiting owner review” state. A button opens the authenticated receipt/review page; no public receipt image or bearer token is exposed in the group. Resends use the same committed snapshot rather than creating a new cash operation.

The accepted format lists each selected date and its allocated amount immediately after the date range; these line amounts sum to the selected total, not to gross daily sales or automatically to the bank deposit alone. Use explicit month/year across boundaries. Example: 25 Sep 316; 26 Sep 2,260; 27 Sep 480; 28 Sep 3,750; 29 Sep 5,810; 30 Sep 2,340; 1 Oct 1,501; total THB 16,457; bank THB 16,400; pre-departure drawer THB 57.

## Historical initial scrutiny and engineering revisions

Independent scrutiny verdict: **fix-then-ship, not PASS**. The smallest approach remains a LINE navigation command plus day allocations within the existing ledger. No LIFF or chat-upload state machine is required. The review identified the following missing transitions, now proposed explicitly for the next review:

- Keep day allocations conserved at the shared pending-fund posting/finalization boundary, not only in the deposit screen. Cover sale/repair/other cash receipts, expenses/parts/payouts, refunds, reconciliation, fund changes and source corrections.
- Reserve selected day amounts atomically with the handover. FIFO spending excludes reserved allocations. Oldest day is consumed first, with a stable ordering for allocations on the same day; unknown-date opening cash precedes known dates. The opening decision is now accepted; deterministic ordering is specified in ADR 0028.
- Store selectedTotal, drawerBeforeDeparture and bankBoundAmount independently. Atomically transfer the pre-departure drawer portion and reserve only bankBoundAmount. Conservation: selectedTotal = drawerBeforeDeparture + bankBoundAmount. Do not post the earlier drawer portion again during settlement.
- For partial settlement, consume the bank deposit from the oldest remaining reserved allocations, then allocate any additional physically returned drawer cash, then release returned pending allocations to their original dates. Example: reserve day A 1,000 and day B 500; deposit 1,200 and return pending 300 → day A is consumed and day B retains 300. A failed upload or stale version leaves allocation and cash unchanged.
- A cancellation releases bank-bound reservations. Q5 is now resolved: pre-departure drawer cash stays in the drawer; no silent reverse movement is permitted.
- Reversing a recorded spending allocation restores its recorded source-day allocations rather than creating a fictitious new-sale day. Unattributed positive reconciliation belongs to an explicit unknown-date allocation with its reason. A correction after deposit records current compensating movements and never edits an earlier bank-deposit snapshot. Negative changes still require enough unreserved pending cash. Owner corrections remain separate from staff deposit reports.
- Persist selected day lines and pre-departure drawer allocation on the handover. Every related event (handover/report/review/replacement evidence/resend) includes the same original selected-day metadata and a clearly timestamped balance snapshot. Distinguish “drawer before departure” from any further “drawer returned after deposit”; review and resend never post cash again.
- Assert: available + reserved = total outstanding allocations = pooled pending balance; no negative available/reserved allocation; selected lines sum to selectedTotal; settlement bank + additional returned drawer + returned pending = bankBoundAmount; original day attribution survives release; repeated operation IDs preserve one financial effect.

## Owner frontier resolved by consolidated-plan execution

- **Q3:** original recorded receipt day in Bangkok (recommended) or successful server-sync day? POS persists sold_at before offline delivery, while existing movement created_at is the server-post time, so the dates can differ.
- **Q4:** one selectable unknown-date opening allocation (recommended) or owner-provided verified per-day opening amounts? Do not infer undeposited history from gross imported sales.
- **Q5:** pre-departure drawer cash remains in the drawer on cancellation/partial settlement (recommended) or must be physically moved back? The chosen rule must match actual money handling.

The owner subsequently requested disabling new offline bills and prioritizing the normal online workflow, then accepted execution of the consolidated plan. Q3's new-offline attribution branch is deferred with offline creation; existing unresolved receipts retain their original recorded dates and recovery protocol. The plan's recommended Q4 and Q5 are accepted: one selectable unknown opening batch and pre-departure drawer money stays in the drawer. New sales use their persisted Bangkok sold_at day; off-bill receipts use persisted received_at. No substantive command/day-allocation implementation starts until the revised detailed design passes scrutiny. Do not repeatedly ask the accepted opening/cancellation choices.

## Detailed scrutiny revisions

The next contract freezes first-finalized receipt day on source metadata even for transfer-paid receipts; guards must reject date-only edits and corrections must reuse the frozen day. Deposit form recovery is not currently provided by the shared receipt scanner: CashForm uses sessionStorage while scanner/ACK checks inspect localStorage. The new design therefore requires durable actor-bound operation records, preserved legacy intents, scanner/ACK/new-intent integration, native cross-tab locks and cash-event recovery through the notification-aware server action. These are technical requirements, not new owner business choices; detailed design remains pending review.

## Final design review

Independent final verdict: **PASS for design only**, after freezing receipt-day provenance, closing the durable actor-bound recovery/scanner/notification gap and removing obsolete pending-owner wording. The initial fix-then-ship verdict above is historical. This PASS permits implementation; it does not certify application code, SQL runtime, hosted Storage, browser acceptance or actual LINE delivery. References elsewhere above to waiting for scrutiny describe the earlier gate, now satisfied.

## Next implementation sequence

1. Design scrutiny completed with final PASS. Implement against ADR 0028 and the detailed contract; re-review material departures from this design. The earlier fix-then-ship review remains historical evidence.
2. Implement additive allocation journaling at shared posting/finalization, preserving source correction and refund guards, plus member read pagination and handover_days. Before installation assert the book remains unopened; no automatic historical attribution.
3. Implement signature/group-filtered navigation command and authenticated mobile selection/pre-drawer form; retain private upload/review and immutable event resends. Add per-day rendering to every relevant LINE event without silently truncating long selections.
4. Run existing SQL/HTTP and assert checks for all writers, original-date restores, partial settlement, cancellation, concurrent/stale/replay/security paths; run authorized browser acceptance separately from hosted Storage/LINE evidence.
5. Prepare exact migration/client release inventory and refreshed backup. Applying migration, deployment, activation and actual LINE send remain separately scoped approvals. Owner physically counts and opens only after the allocation-enabled paths pass.
