# Master plan: online billing and LINE bank deposits

Date: 2026-10-09. Evidence basis: the latest recorded checks in this work, not a new live audit. This plan consolidates the release sequence; it does not itself authorize production actions.

## Outcome and release approach

Deliver ordinary online billing first, then the complete `/ฝากเงิน` workflow with daily outstanding amounts, pre-departure drawer separation, private evidence and owner-readable group summaries. Use two release waves so the unresolved daily-deposit design does not hold up online billing. In wave A, keep the installed two-fund book unopened and reminder configuration disabled. Do not start two-fund accounting and then retroactively guess day allocations while building wave B.

## Recorded status

| Area | Recorded state | Remaining acceptance |
| --- | --- | --- |
| Supabase project and authorization | Project resumed; bounded permission repair applied and checked | No blanket permission certification beyond reviewed scope |
| Base cash schema | Four migrations applied; eight tables, eighteen functions, ten triggers, private evidence bucket, two policies | Hosted member operations and evidence workflow |
| Cash accounting activation | activation_ready false, epoch null, no opening/financial operations at install check | Owner physical count and approved opening |
| Recovery preparation | Public schema/data backup restored locally; 17 tables / 3,695 rows matched | Refresh before further approved writes; no full Auth/Storage/off-device recovery proof |
| Online-only client | Implemented locally; five simulated browser cases, types, scoped lint and independent scrutiny PASS | Compatible release and actual hosted online billing acceptance |
| Base deposit/closing UI and LINE snapshots | Local implementation and prior fixture checks | Client deployment, hosted private Storage and actual LINE delivery |
| `/ฝากเงิน` command and day selection | Opening/cancellation recommendations accepted; ADR 0028 and detailed API design scrutiny PASS | Implementation and verification |
| Reminder | Worker/config schema exists; disabled | CRON_SECRET absent at last inspection; deploy scheduler and approve settings/activation |

No current release commit/push/deployment, new cash opening or real LINE acceptance send has occurred in this work.

## Wave A: usable online billing

### 1. Prepare the compatible release

Agent work: identify a feature-only diff against the recorded deployed baseline, preserve unrelated import/document changes, inspect dependencies and include the necessary compatible cash client components. Do not release an arbitrary dirty working tree. Check build/types/scoped lint and existing meaningful local checks. Current browser evidence uses localhost simulated receipt responses and does not prove hosted financial posting.

Result: a concrete reviewable release inventory, validation record and deployment scope. Commit/push/deploy require explicit approval when that inventory is ready. If a PR is requested, ask its language and keep it Draft until required acceptance is complete.

### 2. Deploy and accept the online-only client

Keep activation_ready false and reminders disabled. New bills require online connectivity and fresh server status. Unknown receipt outcomes retain the original UUID/payload/cart for retry; no optimistic offline sale or new offline queue. Existing queued bills remain visible/recoverable.

Check the hosted owner/staff login, catalog and billing behavior. Any agent-run test sale, stock change or production write needs an exact approved test scope; an isolated preview database is preferable where available. A Preview URL that uses the shared production DB is not isolated. Record actual cash/transfer sale acceptance and transport recovery at their respective layers. Ask the browser verification choice for each completion point under AGENTS.md.

Exit: ordinary online billing is usable on the deployed release. The two-fund book and LINE deposit/day-selection feature can remain unopened while wave B proceeds. User updates all billing browsers to the new compatible release; stale browser versions are not certified by testing a single tab.

## Wave B: complete LINE daily-deposit flow

### 3. Close the remaining business frontier and obtain scrutiny PASS

Already selected direction: `/ฝากเงิน` in the configured group opens an authenticated mobile form inside LINE; select actual outstanding day amounts; subtract pending-fund spending FIFO; set aside drawer remainder before departure; list selected amounts for each day in the group summary. Owner review remains separate from staff report.

Accepted rules under the instruction to execute this plan:

- Opening pending cash is one selectable “opening balance / unknown dates” batch; historical dates are not inferred from gross sales.
- Cancellation/partial deposit keeps the pre-departure drawer portion in the drawer and returns only unbanked carried cash to its original pending allocations. Any later move out of the drawer is a separate physically confirmed operation.

New offline bill creation is deferred. Preserve original dates for legacy receipts and recovery; do not erase old queue/epoch classification rules. Define Bangkok day attribution for normal receipts explicitly in the specification.

Agent work: revise ADR/API/implementation plan; specify allocation conservation for receipts, expenses, parts, consignment payouts, refunds, adjustments, source correction, reservation, partial deposit and return. Independently scrutinize, fix and review until PASS. No business rule is accepted merely because it is a convenient implementation shortcut.

### 4. Implement the command, form and daily allocations

- Signature-checked `/ฝากเงิน` responds only in LINE_GROUP_ID with navigation; chat messages do not mutate money or expose balances before web authentication.
- Staff uses the existing member account; first use inside LINE may require login. No LIFF/account linking or chat-upload conversation state is required for this version.
- Display each available day and its real outstanding amount, plus the opening batch if selected. Exclude reserved or already consumed amounts. Aggregate selected lines and show gross selected amount, drawer-before-departure amount and actual amount carried to bank.
- Transfer drawer portion and reserve bank-bound day allocations atomically under existing receiving pause/version protection. Keep selected-day metadata immutable for later report/review/resend.
- Upload private JPG/PNG/WebP/PDF evidence, record actual bank amount and any physically returned cash, and conserve day allocations. An upload failure cannot complete a deposit. Return pending cash to its original days; do not count it as a new sale on return day.
- Group summary shows custodian, date range followed by every selected date/amount, selected total, bank amount, drawer allocation, post-operation drawer/pending/custody balances, snapshot time and “awaiting owner review”. The button opens an authenticated evidence/review page. Owner confirmation, evidence replacement and resends do not post money again.

Use additive migrations for changed installed contracts; do not rewrite the already-applied four files or blindly push mismatched migration history. Prepare the exact additional table/function/policy/seed scope, refresh backup and obtain separate apply approval.

### 5. Verify locally, install and deploy with activation disabled

Meaningful checks: selected sums, FIFO excluding reserved cash, date returns, expense/refund/correction paths, partial deposit, pre-drawer transfer/cancellation, stale versions, duplicate UUIDs, concurrent requests, unauthorized actors, failed upload, unknown response, immutable per-day LINE snapshot and resend. Use the existing runners; no new dependency is presumed necessary.

After approval, install only the reviewed additions and read back definitions/permissions/state. Deploy the compatible client with book unopened. Hosted authenticated RPC, private evidence upload/view and mobile browser acceptance require their own scoped real-environment checks; fake Auth/Storage and mocked RPC responses do not substitute. No real LINE test until its destination and content are approved.

### 6. Open the two-fund system

User chooses one designated receiving POS. Update all relevant clients, physically pause receipts/payments, resolve and drain legacy/ambiguous receipts, and reconcile any money already with a depositor. Owner physically counts drawer and pending cash separately and confirms actual starting values; do not invent amounts or replay gross historical sales into them.

Approve the one-row readiness change, then owner opens once with the verified amounts and chosen opening-date representation. Check cash conservation and resume receiving through the designated device. Staff phones may manage deposits; they do not silently become additional receiving POS devices.

Exit: current two-fund balances reflect the verified physical opening and subsequent accepted movements, with deposit selections and closing counts using the same ledger.

### 7. Accept LINE delivery and enable reminders

Approve one concrete LINE test to the configured group. Verify the actual message, per-day figures, link, private evidence/owner review and repeat-send behavior. Keep accounting success separate from notification success; failed notification must not create another financial transaction.

Choose reminder day/time in Bangkok, minimum threshold and overdue-custody interval. Configure CRON_SECRET and the scheduler under an explicit settings/deployment scope, verify authentication and claim/retry behavior, then enable reminders. The current Friday 10:00 default is not itself authorization to activate. Service-role key Config/Needs Attention from the prior Vercel inspection is separate maintenance; do not silently rotate it during this release.

## Owner actions, in order

1. Review and approve the concrete wave-A release once the diff is prepared.
2. Later approve the exact additional migration/deploy/hosted-test scope after daily-deposit design PASS and local verification.
3. Identify the receiving POS and physically count opening drawer/pending balances when cutover is ready.
4. Approve a LINE acceptance send and choose reminder settings before activation.

No password, access token, service key or secret value needs to be sent in chat.

## Recovery limits

Before opening, keep the book disabled while reverting an unsuccessful client deployment. After opening, pause intake and roll forward using audited corrections; do not null the epoch, reset balances, delete movements or restore legacy cash writers. The existing manual public backup is a scoped local recovery artifact; it is not full project or Storage object disaster recovery coverage.

## Authoritative references

- [Online-only change and verification](plan-online-receipts-2026-10-09.md)
- [Base production installation and version mappings](plan-production-two-fund-cash-2026-10-09.md)
- [LINE command/day-allocation design and scrutiny gaps](plan-line-deposit-command-2026-10-09.md)
- [Business ADR](../adr/0027-track-bank-deposits-and-carry-pending-cash.md)
- [Cash API contract](spec-two-fund-cash-api.md)
- [Cutover runbook](cutover-two-fund-cash.md)
- [Current user guide, including availability limitations](guide-two-fund-cash.md)
