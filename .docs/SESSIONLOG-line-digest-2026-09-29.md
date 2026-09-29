# Session log — close-day LINE digest, 2026-09-29

## Scope and state

- Continued the accepted plan in `docs/pos/plan-close-day-line-digest.md` and ADR 0025/0026 on branch `codex/close-day-line-digest`, branched from `feat/edu-ai-reskin-and-fixes` while preserving its uncommitted design files.
- Added and applied two migrations to production project `bihgcdceovfettoxmgme`: SIM carrier and cash-paid repair part data/read model, then staff-gated `rpc_close_day_digest(date)` with the approved card fields. The Supabase connector recorded them as `20260929100202 close_day_line_digest_data` and `20260929100229 close_day_line_digest_rpc`; local file versions are `20260929094124` and `20260929094233`.
- Backfilled exactly two approved product IDs: `SIM OTC` to Ais and `SIM TRUE` to True. The guarded SQL required exactly two updated rows and the postflight read confirmed both.
- Added owner-only SIM carrier choice in stock, cash/transfer choice for repair parts, shared UI cash-to-send calculation, close-day part lines, LINE Flex formatting, push, close/resend Server Actions, and signed join webhook.
- No commit, push, deploy, LINE message, or credential change occurred.

## Verification by layer

- Pure checks passed: `cashToSend.check.mts` (paper fixture cash to send = 3,750), `digestFlex.check.mts` (28 Sep card, alt text, overflow and badges), `route.check.mts` (reject unsigned webhook and reply to valid join).
- `npx tsc --noEmit` and scoped ESLint passed. `next build --webpack` passed; the default Turbopack build failed because its CSS worker could not bind a local port under sandbox. The first webpack build also could not reach Google Fonts under sandbox; an approved rerun passed.
- Read-only Chrome check on localhost before migration: `/stock` showed the owner-only carrier selector with Ais/Dtac/True; `/repairs` showed the required cash/transfer selector; `/close-day?date=2026-09-28` selected 28 Sep but could not load data before the view existed. After migration, a fresh page load showed `SIM OTC` = Ais and `SIM TRUE` = True in their edit drawers. `/close-day?date=2026-09-29` loaded with cash to send = 21,125.55 and the LINE send button. No browser write was made.
- Production SQL postflight: new columns/views/function exist; old two-argument `rpc_set_part_cost` overload is absent; `rpc_close_day_digest` and its views are member-gated with anon denied. Calling the digest in a read-only transaction with the authenticated role and an existing staff UID returned JSON for 2026-09-29, cash to send = 21,125.55, and the approved sections without cost/profit fields. Anon HTTP POST to the RPC returned 401 / 42501.
- Authenticated staff HTTP call, HTTP close/resend, and LINE delivery are unverified. The webhook join reply requires a public deployment and LINE group.

## Pending user actions and release boundary

- The owner must create the LINE OA and Messaging API channel and configure `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, and later `LINE_GROUP_ID`. `LINE_APP_URL` is optional when Vercel provides `VERCEL_PROJECT_PRODUCTION_URL`.
- The user approved and both production migrations were applied. The Supabase connector's recorded versions differ from the local file prefixes; reconcile migration history before any future CLI `db push` rather than assuming matching versions.
- The user approved the separate R0 backfill of `products.carrier_id` on the two exact product IDs below; it was completed and verified.
- Configure LINE OA, secrets, group ID, and webhook/deployment. Then verify authenticated staff HTTP, successful delivery, resend, and a delivery failure path without losing the saved close.

## Read-only production preflight

- Target verified before write: Supabase project `bihgcdceovfettoxmgme` (`DailyGold & Ucom`), matching `.env.local` and the linked project ref. The previous live definitions and `v_pos_stock` matched the source contract used by the migrations. Postflight confirmed the new catalog objects and grants.
- Exact SIM rows in category `ซิมการ์ด`: `SIM OTC` / `SIM-00001` / `d7d4aad3-8af6-5cbb-9d0c-59ee74f780c0` and `SIM TRUE` / `SIM-00002` / `e8a6ba6a-625b-511e-a0dd-06b9bd9ccec4`. The user mapped OTC to Ais (`576982f7-3b46-413f-b154-de8ce6931896`) and TRUE to True (`83ac33ea-ddf8-41e2-bb75-85b36163566e`); the exact-ID backfill and postflight read confirmed both.
