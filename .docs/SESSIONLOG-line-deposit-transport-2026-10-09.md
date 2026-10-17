# LINE deposit navigation and immutable summary transport

Scope: local implementation in `codex/line-daily-deposits`; no production sends or deployment.

- Signed raw-byte webhook accepts only trimmed `/ฝากเงิน` from configured group, preserving join discovery. Command returns an HTTPS navigation URI to authenticated `/cash?intent=deposit`, never financial mutations or LINE-derived membership. Malformed payloads fail safely.
- Immutable event snapshots render every original daily allocation, full original date range across years/months, explicit null-day origins, selected total, pre-departure drawer cash, bank-bound amount, actual settlement, extra drawer return, actual review state and post-operation balances. Specific handover navigation does not expose private evidence paths.
- Long selections split at 25 lines / conservative 24,000-byte budget; each emitted bubble is checked against 30,000-byte ceiling and 400-character altText. One message per request stays below LINE's maximum five. Every part preserves original event ID, totals and full date range; no financial recomputation.
- Event/part retry UUIDs are deterministic. Recovery/resend retains canonical event content. 409 counts as accepted only with `x-line-accepted-request-id`. Stop on any failure and retain the committed event for retry in the caller.

Official limits and semantics: [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/#flex-message), [push message](https://developers.line.biz/en/reference/messaging-api/#send-push-message), [retry requests](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/), [URI actions](https://developers.line.biz/en/docs/messaging-api/actions/).

LINE stores retry keys for 24 hours only. Reusing a key later can produce another delivery; deterministic IDs alone do not provide permanent notification deduplication. API acceptance also does not certify delivery to a user's device.

Executed checks: existing webhook, legacy cashFlex assertions and new deposit split/retry/mock-send assertions pass. Scoped ESLint passes. TypeScript final result recorded by parent after shared worktree changes settle. No actual LINE delivery or LINE mobile-browser test performed.
