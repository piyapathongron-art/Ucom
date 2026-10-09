# Two-fund cash production preflight

Date: 2026-10-09. Status: **All four cash migrations installed after explicit approval. SQL definitions, permissions, disabled activation/reminders and anonymous HTTP denial checked. Compatible client deployment, hosted member-write/Storage acceptance, opening and LINE delivery remain pending.**
Scope authorized: read-only production inspection and local release preparation, followed by explicit approvals for project resume, privilege repair and the four cash-feature migrations. All three operations completed. No business transaction, commit, push, deploy, opening, scheduler activation or LINE send was performed.

This document retains the initial preflight observations below, followed by later installed-state evidence. For the current overall sequence, see [the consolidated master plan](master-plan-online-billing-line-deposits-2026-10-09.md).

## Observed deployment and target

- Local public Supabase URL and linked project ref agree on `bihgcdceovfettoxmgme`.
- Supabase project metadata identifies this as **DailyGold & Ucom**, region `ap-southeast-1`. Initial status was `INACTIVE`; after explicit user approval, the restore operation succeeded and status became `ACTIVE_HEALTHY`. The separately named `ucom-pos` project was not changed.
- During `COMING_UP`, a transient SQL response showed no application tables and migration history was empty. Those responses were superseded by successful reads after `ACTIVE_HEALTHY`; they are not evidence of data loss.
- Healthy-project reads confirm 27 applied migrations, existing business tables, two profiles (one owner, one staff), 1,356 sales, and one DailyGold `display_settings` row. Counts are observations, not a backup or reconciliation certificate.
- At the initial preflight, no cash tables/functions or cash evidence bucket existed. This was superseded by the approved four-migration installation documented below.
- GitHub `main`, local HEAD, and latest successful Vercel Production deployment agree on `bab2b5ef56156ab1f480725cb8e8adf83c59b149` (2026-09-30).
- `https://ucom.vercel.app/login` returned HTTP 200 and the Thai login shell. This does not prove authentication, database availability, financial workflows, or LINE delivery.
- The immutable deployment URL redirects to Vercel login. Its deployment status is not authenticated application acceptance.
- Cash feature changes remain in the local working tree. Unrelated import/documentation changes also exist; release staging must exclude them.

## Configuration and migration gaps

- Local configuration contains Supabase anon/service keys and LINE channel secret/token/group settings. Values were not displayed. This proves local presence only.
- Owner-dashboard inspection now confirms six existing Supabase/LINE environment variables in Production and Preview. `CRON_SECRET` and `LINE_APP_URL` are absent from the unfiltered inventory. System Environment Variables access is enabled; source falls back to `VERCEL_PROJECT_PRODUCTION_URL` when `LINE_APP_URL` is absent. Configure `CRON_SECRET` under separate approval before enabling reminders.
- Vercel flags `SUPABASE_SERVICE_ROLE_KEY` as Config/Needs Attention; channel token/secret are stored as Secret. No value was revealed, classified differently or rotated. Presence does not prove key validity or LINE delivery.
- There is no checked-in scheduler configuration. Do not invoke `/api/line/cash-reminder` during read-only inspection; it can claim a delivery and send LINE.
- Live migration history confirms different applied/local timestamps for the close-day LINE migrations: applied `20260929100202` / `20260929100229`, local `20260929094124` / `20260929094233`. Choose an explicitly reconciled apply mechanism; do not blindly run `supabase db push`.

## Live dependency and authorization findings

- All nine legacy RPC dependencies exist with the expected argument counts/types: sale creation; shop income; part cost; repair collection; three consignment commands; closing; closing digest. `rpc_set_part_cost` has only the expected three-argument signature. Each is `SECURITY DEFINER`, fixes `search_path`, checks membership, permits authenticated execution, and denies anonymous execution.
- `pos_is_member()` and `pos_is_owner()` exist with profile/owner checks. Required source columns, cash/transfer constraints, and unique sale `client_uuid` are present. No new cash trigger/function name collision was found.
- **Remediated:** initially `public.shop_income` had RLS disabled and broad anonymous grants; anonymous zero-row REST GET returned HTTP 200. The approved privilege migration now enables member-read RLS and denies anonymous table access; production zero-row GET returns HTTP 401. No write exploit was attempted.
- The draft feature migrations add row guards but do not repair the original authorization configuration. The separately approved permission migration now denies anonymous access, restricts direct income writes and preserves required member reads/RPC writes. It also removes the specified TRUNCATE bypass, which row triggers cannot protect.
- The approved privilege migration also denies authenticated TRUNCATE on the eight specified source/actor tables. Legacy authenticated DML needed by the old client retains its existing RLS; source row guards still require the four cash migrations and opening.
- Before remediation, the healthy-project security advisor reported one RLS-disabled public table and 24 security-definer views. Income RLS is now enabled by verified SQL; views were not changed or certified by this migration. The view warning requires actual grant/definition review; it is not itself proof of anonymous data disclosure. [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [view guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- At initial inspection, Storage contained only the public `promo` image bucket. The approved installation later created private `ucom-cash-evidence`; its authenticated upload/view acceptance remains pending.
- Owner-dashboard inspection confirms the Free Plan has no scheduled project backup coverage and PITR is presented as an upgrade/add-on. After an initial CLI timeout, a native role-correct public-schema/data archive succeeded. Local restore exited 0 and all 17 table counts matched the archive (3,695 rows). The ignored, mode-0600 local backup and hash are recorded in the [backup preflight log](../../.docs/SESSIONLOG-cash-backup-env-preflight-2026-10-09.md). This proof uses local Auth prerequisites and does not cover Auth accounts, Storage objects, exact ownership or full project disaster recovery. Refresh the backup before a later approved apply if production data changes.
- Applied the bounded [privilege repair plan](plan-cash-source-privileges-2026-10-09.md) after explicit approval. Live migration version is `20261009034817`; local reviewed file version is `20261009040000`. Preserve this mapping alongside the older timestamp drift before any migration-history reconciliation. SQL postconditions and production anonymous HTTP denial passed; hosted authenticated acceptance remains unverified.

## Approved migration scope — installed, activation disabled

| File under `supabase/migrations/` | SHA-256 |
| --- | --- |
| `20261007104254_two_fund_cash_book.sql` | `ee3d46aae2f8b107c07f486c3834317c5ee595fe8885b61aeff25d6547d00e43` |
| `20261007104638_cash_source_guards.sql` | `280a19cd6c2c23d2d1959aed4b02bfecfb475b2abe547b5d0f2d56239a4bdfd0` |
| `20261007104639_cash_commands_and_evidence.sql` | `a90227f2ab1d37bc3d14afaf9d9cdea2a6840c13cb32ee0e5956274ef7ee8475` |
| `20261007104640_cash_reminders.sql` | `0f6ff560df5d2c164804392b3412483790a1999be0d582e272fb3e337f6c9bd1` |

Installed SQL created eight public tables, eighteen functions, ten triggers, one private `ucom-cash-evidence` bucket, and two Storage policies. New seed records are one cash-book row, one disabled reminder-config row, and one bucket row. No top-level backfill/reset/delete of existing business records occurred. Command functions can change business records when explicitly invoked after activation.

Live versions map to the reviewed local files: `20261009061359` = `20261007104254`; `20261009061409` = `20261007104638`; `20261009061418` = `20261007104639`; `20261009061433` = `20261007104640`. Do not blindly push/reconcile local history. All 18 live function bodies match their reviewed SQL bodies; all 37 prior public function fingerprints and the nine recorded business/config table counts are unchanged. Eight tables have RLS and deny direct anonymous/authenticated privileges; ten triggers are enabled. Real anonymous REST table/status/closing checks returned 401; private bucket metadata returned 400. These denial checks do not prove authenticated operations or evidence upload.

The installed cash book retains `activation_ready=false`, null epoch and version 0; reminders remain disabled. No operations, movements, sources, handovers, closings or reminder deliveries exist. Preserve these gates throughout deployment. The final four-argument `rpc_cash_pos_ack(uuid,uuid,text,bigint)` is installed without a duplicate overload.

## Release sequence and approval boundaries

1. **Resume and bounded privilege remediation completed under explicit approvals.** Owner/staff read-only browser acceptance passed, including owner access to 67 existing expenses and staff exclusion from the owner ledger. Dashboard inspection of backup coverage and production variable presence, plus scoped public-schema/data backup and local restore proof, are complete. Hosted write acceptance needs its own concrete scope. Full Auth/Storage/off-device recovery coverage remains outside this proof.
2. Prepare a feature-only release diff against `main`, preserving unrelated work. Commit/push/PR/deploy require their own explicit authorization. Ask PR language if a PR is requested.
3. **Four-migration installation completed after explicit approval.** Installed definitions, grants, disabled state and guards were read back; anonymous HTTP denial passed. Authenticated private evidence workflow still needs hosted acceptance. No legacy-data import or reset occurred. See [installation log](../../.docs/SESSIONLOG-cash-feature-install-2026-10-09.md).
4. Deploy the compatible client with activation still disabled. Verify production configuration without exposing values. Hosted authenticated HTTP/Storage/browser acceptance and any test writes require a concrete approved scope; local fixture results do not substitute for hosted acceptance.
5. Follow [the cutover runbook](cutover-two-fund-cash.md): update receiving devices, pause the primary POS, drain/verify queues, obtain owner-confirmed physical drawer and pending balances, then approve the one-row readiness change and perform the owner opening. Do not invent opening balances.
6. Approve a specific LINE acceptance send and destination separately. Configure/enable the reminder scheduler only after the flow is accepted and reminder settings are confirmed.

Before opening, deployment rollback keeps the book unopened. After opening, pause intake and roll forward with auditable corrections; do not clear the epoch, reset the ledger, or resume legacy cash writers as a rollback.

## Evidence references

- Business contract: [ADR 0027](../adr/0027-track-bank-deposits-and-carry-pending-cash.md), [API specification](spec-two-fund-cash-api.md).
- Prior local acceptance: [receiving-pause session log](../../.docs/SESSIONLOG-cash-receiving-pause-2026-10-08.md).
- This read-only inspection: [production preflight session log](../../.docs/SESSIONLOG-cash-production-preflight-2026-10-09.md).
- Approved resume and healthy-project reads: [resume preflight session log](../../.docs/SESSIONLOG-cash-production-resume-preflight-2026-10-09.md).
- Owner dashboard backup/environment inspection: [backup and environment preflight log](../../.docs/SESSIONLOG-cash-backup-env-preflight-2026-10-09.md).
- Historical migration evidence: `.docs/SESSIONLOG-line-digest-2026-09-29.md`.
