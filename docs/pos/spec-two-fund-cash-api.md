# Two-fund cash API contract

Approved for local implementation by the owner's "start" instruction on 2026-10-07. ADR 0027 remains authoritative. Production activation is separately gated.

## API

- `rpc_cash_status()` returns balances as THB decimal strings, `epoch`, `version`, `asOf`, `openedAt`, `isOwner`, `activationReady`, `receivingDevice`, `ackVersion`, `ackAt`, reminder settings, recent handovers (100), closings (30), movements (50), and owner-only registered sources (100). Disabled books return null epoch. `rpc_cash_closing(p_date date)` retrieves all immutable revisions for a specific date, independently of the recent-history limit.
- `rpc_cash_execute(p_operation_id uuid, p_epoch uuid|null, p_action text, p_payload jsonb)` returns `{id: string, snapshot?: Snapshot}`. UUIDs and identical payloads survive retries. All active mutations lock the book and authorize before replay. Errors are mapped to safe Thai messages in the app.
- `rpc_cash_pos_ack(p_epoch uuid, p_device uuid, p_device_token text, p_version bigint)` explicitly pauses the designated receiving browser and certifies the current drained-queue version. The private proof is locally persisted random 256-bit data; only its SHA-256 hash is stored server-side. Status includes `isReceivingPaused`. Handover/closing require this pause and the matching version, without automatic heartbeat ACK or timestamp expiry. The receiving browser persists a fail-closed pause before the request and shares a native lock across all receipt-intake tabs, including offline intake. The expected version prevents a delayed pause request from succeeding after resume has advanced the version.
- `rpc_cash_pos_resume(p_epoch uuid, p_device uuid, p_device_token text)` advances the book version and clears server pause and acknowledgement using the designated browser proof. Only after confirmed server success may the client clear its local pause. Handover/closing never automatically resume receiving. New sale, repair collection, consignment receipt and off-bill income are rejected while paused; already committed identical operation retries remain valid. The owner accepted this protocol on 2026-10-08.

## Payloads

`open`: `{drawer, pending, device, deviceToken, queueDrained: true, physicallyPaused: true, reason}` (owner only; initializes epoch once). Device UUID and private proof persist locally on the receiving POS. A separate server-controlled `activation_ready` flag defaults false; schema installation alone cannot enable cash accounting.

`handover`: `{amount, custodian, version}`. Creates a reservation; staff/owner. `return`: `{handoverId, reason, physicallyReturned: true}` releases a reservation without a deposit.

`settle`: `{handoverId, bank, drawer, returned, depositedAt, evidencePath, physicallyReturned: true}`. Evidence must already exist in private bucket `ucom-cash-evidence`, path `USER_UUID/HANDOVER_UUID/UPLOAD_UUID.jpg|png|webp|pdf`, maximum 10 MiB. Requires bank > 0 and exact reservation = bank + drawer + returned. Handover fields: `{id, amount, custodian, state, createdAt, bank, drawer, returned, depositedAt, evidencePath, reviewNote, snapshot}`. States `handed_over`, `reported`, `confirmed`, `disputed`, `returned`.

`review`: `{handoverId, confirmed: boolean, reason}` (owner; no cash effect). `evidence`: `{handoverId, evidencePath, reason}` replaces disputed evidence and returns to reported (no cash effect).

`close`: `{version, drawerCount, pendingCount, note}` creates immutable date/revision snapshot with balances/counts/variance under book lock; both counts mandatory, stale versions rejected. Snapshot includes `id`, `date`, `revision`, `asOf`, `version`, `drawer`, `pending`, `reserved`, `available`, `drawerCount`, `pendingCount`, `drawerVariance`, `pendingVariance`, `daily` (legacy digest at snapshot time). LINE resends read this stored snapshot.

`adjust`: `{sourceOperationId, fund: drawer|pending, amount: signed decimal, kind: reconciliation|refund, reason}` owner only; immutable entry linked to original operation, actual refund distinct from source correction.

`correct`: `{table: expenses|shop_income|repair_jobs|sales|consignments, id, amount, fund: drawer|pending|transfer, reason}` owner only; corrects registered source bookkeeping through compensating movements, preserves original movement time. Legacy unregistered sources require explicit reconciliation, never automatic cash inference.

`reminder`: `{enabled, weekday: 0..6, time: HH:mm, minimum, overdueHours}` owner settings, Bangkok zone; disabled until configured. Scheduler endpoint `/api/line/cash-reminder` protected by `CRON_SECRET` and configured externally after approval; persisted retry IDs and fixed LINE group only.

## Existing writers

`sale`: `{payload: existing rpc_create_sale payload, device, deviceToken}`; operation UUID = client_uuid, queued payload carries immutable cash_epoch, receiving_device and receiving_token from time of receipt. Known pre-cutover sale replay returns original without cash. `covered_sale` owner-only, old payload + originalActor + reason explicitly classified opening-covered. Replaying the same owner-classified bill by its original staff actor returns the existing result without another cash entry.

`expense`: `{name, amount, fund, date?}`; staff date today, owner can choose reporting date. `income`: `{name, amount, fund: pending|transfer}`. `part`: `{id, amount, fund}` actual first payment; already-paid parts need owner correction, original part_paid_at preserved.

`repair_close`: `{id, payload, device, deviceToken}`; `consign_sell`: `{id, amount, share, method, account, device, deviceToken}`; `consign_settle`: `{id, method, account, device, deviceToken}`; `consign_pay`: `{id, fund}`. Cash receipts always pending; expense/part/payout choose drawer, pending, transfer. Legacy writers are available only before opening; guarded after opening. Physical source deletes blocked after opening, descriptive edits remain possible. Cash source triggers register provenance; final posting happens after sale items exist, in the same wrapper transaction. Repair collection requires the nested receipt UUID to equal the operation UUID and cannot reuse an unrelated existing sale.

Private evidence uploads use a prepared signed upload directly to Storage, avoiding server-action body limits. Registered object metadata, path ownership, handover authorization and bucket constraints are checked before settlement. Auth/Storage browser fixtures are not evidence of hosted Supabase Storage delivery.

## Implementation ownership

Root: SQL, authorization, transactional accounting, private storage policies, runtime SQL checks. Writer agent: existing UI writers, offline epoch/device/ack protocol, two-fund closing integration, typed database RPC entries and reusable cash client. Cash UI agent: `/cash` mobile forms/server actions, login destination preservation, LINE snapshot builder/push and reminder endpoint. Agents share this contract; changes must be coordinated before callers diverge.
