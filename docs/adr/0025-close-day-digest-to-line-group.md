# 0025 — Close-day digest goes to one LINE group, without cost or profit

## Status

Accepted, 2026-09-29.

## Context

Every evening staff fill in a paper close-day sheet (sales lines, devices with IMEI, SIMs per carrier sold/free/left, top-up per carrier sold/wallet left, expenses, cash to send, over/short) and post a photo of it to the shop's LINE group. Everything on that sheet already exists in the system. LINE Notify was shut down in 2025, so the only channel is the Messaging API through a LINE Official Account bot.

## Decision

- **Recipient: one LINE group, fixed by env `LINE_GROUP_ID`.** The bot replies with its `groupId` when invited to a group (reply messages are free); the owner copies it into Vercel env. The bot never pushes anywhere else, so inviting it into another group leaks nothing. Rejected: broadcast to followers (anyone who adds the OA sees the shop's money) and auto-saving the groupId on join (anyone who invites the bot hijacks the destination).
- **Content: sales yes, cost and profit never.** Staff are in the group; rule 4 / ADR 0021 forbid staff seeing profit. "Sales" is the close-day number — every bill including repair bills (ADR 0014) — labelled "ยอดขายรวม (ทุกบิล)", not `/report`'s `sale_revenue`, so the group sees the same total the close-day screen shows.
- **Numbers come from `rpc_close_day_digest(p_date)`**, security definer, gated by `pos_is_member()`, returning JSON shaped like the card. The no-cost rule lives in that one SQL function (same approach as the `v_close_day_*` views) and the service-role key never sits on a path staff can call. It must use the shared cash-to-send formula, not a copy.
- **Send path: a Server Action** that runs `rpc_close_day`, then pushes best-effort. A LINE failure never fails the close; the UI shows a toast. No outbox or retry queue.
- **Resend: a "ส่งสรุปเข้า LINE" button** on any closed day, for staff and owner. Numbers are computed at send time (ADR 0004), so a resend after a backdated expense edit carries the new figures. Header says "แก้ไข" when `day_closings.closed_at > created_at` (re-close) and "ส่งซ้ำ" for a manual resend.
- **Format: Flex Message**; `altText` carries the one-line summary shown in the notification. Each section shows at most 10 lines sorted by amount, then "+ อีก N รายการ ฿x"; empty sections are hidden.

## Consequences

- A second trigger that writes `day_closings` (none today) would not send; move to a DB webhook then.
- Group push counts one message per member against the OA quota (free plan 300/month): ~3 members × 30 days fits.
- Env: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` (webhook signature), `LINE_GROUP_ID`.
