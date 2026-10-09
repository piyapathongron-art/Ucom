# Proposed two-fund cash and LINE implementation plan

Date: 2026-10-07 (Asia/Bangkok).

Status: implementation authorized on 2026-10-07 with the recommended defaults after independent ADR scrutiny. All business cash receipts go to pending cash; physically separate counts and verified openings; staff report and owner verifies/corrects; one designated receiving POS. Reminder day/time remain configurable and disabled until configured. Exact API: [spec-two-fund-cash-api.md](./spec-two-fund-cash-api.md). Production activity remains separately gated.

## Intended flow

1. Track Shop Drawer Cash and Pending Deposit Cash separately. Payments select either cash fund or a shop-bank transfer; transfers change neither cash fund.
2. LINE shows drawer and pending cash at closing/deposit time and opens an authenticated mobile POS form. Money is changed through authorized POS operations, not chat commands.
3. Reserve cash before staff take it to the bank. Record the actual bank deposit, remainder physically returned into the drawer, and unused cash returned to pending cash. Apply all allocations atomically; evidence review does not remove money again.
4. Preserve calculated balances, actual counts, variance, and cash with a depositor separately. Store event snapshots/revisions so an old closing resend cannot show today's balance as yesterday's count.
5. Begin with verified opening cash, cleared/server-acknowledged receiving-POS queues, and compatible clients. Missing/old activation epochs never create duplicate opening-covered cash receipts.

## Approval gate

Obtain the owner's choices for receipt routing; actual counting and opening method; custody/confirmation/correction roles; the proposed cash book and POS integration; reminder settings and receiving-device topology. The recommended values and alternatives are recorded in the ADR. A proposed single receiving POS is a shop-wide limitation that must be accepted or redesigned before activation.

## Execution after approval

1. Inventory all financial writers, offline replay paths, RPCs, RLS/grants, and source-to-cash linkage. Write the exact SQL/API contract and cutover/rollback procedure before changing schema or clients.
2. Implement transactional cash movements, reservations, correction history, and idempotency across every listed source path. Keep the feature disabled while any writer can bypass the cash-book model.
3. Implement mobile reporting/review, per-fund closing/counts, private evidence access, validated login return navigation, LINE snapshots/resends, and independent reminders.
4. Run the ADR's acceptance matrix using the repository's existing test patterns, then approved real HTTP/RPC and mobile/browser/LINE checks. Document the reached verification layer precisely.
5. Activate only after compatible clients, queue/cutover checks, verified opening cash, and the exact production approvals. Schema apply, production writes, deploy, external sends, and cleanup remain separately authorized actions.

## Current evidence and remaining gate (2026-10-08)

Draft migrations and application integration are implemented locally. Real local PostgreSQL acceptance passes 65 assertions; localhost HTTP and concurrent-write checks pass. Approved browser fixture verification reached mobile deposit/evidence/review and separate two-count closing. Hosted Auth/Storage and real LINE delivery remain unverified. See the [session log](../../.docs/SESSIONLOG-two-fund-cash-2026-10-08.md) and [cutover procedure](./cutover-two-fund-cash.md).

The owner selected explicit receiving-POS pause on 2026-10-08, preserving offline sales outside the pause. Implementation, independent source scrutiny, 76 local SQL assertions, real localhost HTTP and adversarial two-tab online/offline browser checks passed. See [pause verification](../../.docs/SESSIONLOG-cash-receiving-pause-2026-10-08.md). Production remains disabled pending the separately authorized hosted acceptance layers.
