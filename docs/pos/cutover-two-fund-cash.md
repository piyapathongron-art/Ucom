# Two-fund cash cutover and recovery

Status: local implementation verified, including independent source scrutiny and adversarial two-tab online/offline pause checks. The owner accepted explicit receiving-POS pause on 2026-10-08. Production activation still requires hosted acceptance and separate production authorization. ADR 0027 and the API contract are authoritative.

## Before production approval

1. Review the exact target project, migration inventory, existing RPC signatures, application revision, grants and Storage policies. Draft migrations must not be applied merely because local checks passed.
2. Deploy compatible financial writers to every receiving browser. Keep `activation_ready=false` until every source path, authorization boundary, private upload and immutable closing resend has passed hosted acceptance.
3. Verify the explicit receiving-POS pause, persisted offline/cross-tab lock, drained queue and proof-bound resume. A recent queue-empty timestamp alone cannot certify that no new offline receipt exists.
4. Obtain separate approval for schema installation, deployment, readiness activation, verified opening balances, scheduler activation and a real LINE test. Record the exact scope of each approval.

## Opening procedure

1. Physically stop accepting payments on the designated receiving POS. Inventory all browser queues and unresolved request IDs, including repair and top-up receipts. Synchronize all confirmed receipts before counting cash.
2. Count actual drawer cash and sales cash pending deposit separately. Exclude cash already held by a depositor; reconcile any pre-existing custody before opening.
3. Record the designated browser UUID and generate its private device proof through the application. Never copy the private proof into documentation or another phone.
4. The owner records both verified amounts once, confirms the physical pause and drained queue, and supplies an opening reason. The server creates a new epoch and immutable opening movements atomically.
5. Old queue entries retain their original epoch, receipt time, operation UUID and actor. Already-recorded receipts replay without posting again. An unrecorded old bill included in the physical opening requires explicit owner classification before business recording; it must not increase opening cash a second time.
6. Resume receiving only using the final reviewed synchronization protocol. Compare status balances, operation history and physical counts before allowing mobile handover or closing.

## Recovery boundaries

- Before opening: a failed deployment can be reverted while the book remains disabled. Keep readiness false and verify the legacy writer paths after reverting.
- After opening: do not null the epoch, reset balances, delete movements or revert to legacy writers. That would permit untracked money and duplicate opening receipts. Pause receipt intake, preserve pending operation IDs, and roll forward with a compatible fix.
- Unknown request result: retry the identical UUID, epoch, action and payload. Do not create a replacement operation until a definite rollback/rejection is known.
- Incorrect bookkeeping: owner correction creates compensating movements linked to the registered source. An actual refund is a separate negative money movement, bounded by the original cash receipt. A physical count mismatch remains visible until an explicit reasoned reconciliation.
- LINE failure: the cash operation remains committed. Resend its stored snapshot; never recompute a historic balance or repeat the cash movement.
- Evidence dispute: review changes evidence status only. Cash is restored only after an explicitly recorded physical return or correction.

## Verification layers

Local PostgreSQL/RPC, localhost PostgREST, and browser fixtures provide implementation evidence. Fake local Auth/Storage adapters do not prove hosted Auth/Storage behavior. LINE JSON formatting does not prove external delivery. Production opening, scheduler execution and actual group delivery remain separate acceptance layers.
