# Plan — Close-day digest to LINE

Decisions: ADR 0025 (digest), ADR 0026 (cash-paid repair parts). Glossary: `Cash to Send`, `Close-day Digest` in `docs/CONTEXT.md`. Card mock-up: agreed in chat 2026-09-29 (sections below).

Status (2026-09-29): implemented locally. Both migrations were applied to production and the two existing SIM products were backfilled with the approved carrier mapping. The digest RPC ran successfully as a simulated staff role in SQL, and anon HTTP access was denied. The read-only browser showed the new values and close-day total. LINE credentials and group are not configured; staff HTTP delivery and LINE delivery remain unverified.

## Prerequisites (user, outside the repo)

- Create a new LINE Official Account + Messaging API channel for the shop (not one customers follow).
- Console: enable "Allow bot to join group chats"; set webhook URL to `https://<prod>/api/line/webhook` after phase 3 deploys.
- Vercel env: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`; `LINE_GROUP_ID` after the bot replies with it.
- The card link uses Vercel's `VERCEL_PROJECT_PRODUCTION_URL`; set `LINE_APP_URL` only if the shop needs a different canonical origin.

## Phase 1 — data the digest needs (migrations; applying = R0)

1. `products.carrier_id uuid null references topup_carriers(id)` — a product with a carrier is a SIM of that carrier. Owner sets it in the stock edit form (`src/app/(staff)/stock/useStockRowEdit.ts`, `page.tsx`). Backfill existing SIM products: list them first, owner approves the mapping (prod data write = R0).
2. `repair_jobs.part_paid_from text check (in ('cash','transfer'))`; `rpc_set_part_cost` gains `p_paid_from` → **`DROP FUNCTION public.rpc_set_part_cost(uuid, numeric)` before create** (overload trap). UI: cash/transfer choice where the cost is entered (`src/app/(staff)/repairs/page.tsx`).
3. Close-day read model gets cash-paid part costs of the day (job label + amount only; no `part_cost` in `v_pos_repairs`).
4. Extract the cash-to-send formula from `useCloseDayData.ts:278` into a pure function (`close-day/cashToSend.ts`) + `cashToSend.check.mts`; add the part-cost term; close-day screen shows the new lines under "เงินออกจากลิ้นชัก".

## Phase 2 — digest data + card

5. `rpc_close_day_digest(p_date date) returns jsonb`, security definer, `pos_is_member()` gate, never selects cost/profit columns. Returns: header (date, closed_by name, closed_at, created_at, counted_cash), sales lines (product/service, `is_repair`), devices (model, IMEI last 4, price), SIMs per carrier (sold, free = price-0 lines, stock left), top-ups per carrier (sold, wallet balance, top-ups entered that day), receipts by channel (cash / transfer / ไทยช่วยไทย via receiving account), cash-out lines (expenses cash, consignment payouts cash, part costs cash), repair jobs closed, SF+ released.
6. `src/lib/line/digestFlex.ts` — pure JSON → Flex bubble + `altText` (`ปิดร้าน 28 ก.ย. · ขาย ฿5,480 · ส่ง ฿3,750 · ตรง`); max 10 lines per section sorted by amount, then "+ อีก N รายการ ฿x"; hide empty sections. One `digestFlex.check.mts` with the 28 Sep sheet as fixture (to-send must equal 3,750).

## Phase 3 — sending

7. `src/lib/line/push.ts` — `fetch` to `https://api.line.me/v2/bot/message/push` (no SDK dependency).
8. Server Action `closeDay(counted, note)` replaces the client `rpc_close_day` call in `useCloseDayData.ts`; pushes after success; returns `{ closed: true, lineSent: boolean }`. Toast on `lineSent=false`.
9. Server Action `sendCloseDayDigest(date)` + "ส่งสรุปเข้า LINE" button on any closed day (both roles). Header badge: "แก้ไข" if `closed_at > created_at`, "ส่งซ้ำ" for the button.
10. `src/app/api/line/webhook/route.ts` — verify `x-line-signature` (HMAC-SHA256, `node:crypto`), on `join` reply `groupId = C…`; ignore everything else.

## Verify (ask before each browser verify point — CLAUDE.md §3)

- `tsc` / lint / build / both `.check.mts`.
- SQL: digest RPC as staff returns no cost/profit keys; as anon denied.
- HTTP/UI: close a day on the dev server → message arrives in a test group; resend button; LINE failure path (bad token) still closes the day.
- Unverifiable until deployed: webhook `join` reply (needs public URL).
