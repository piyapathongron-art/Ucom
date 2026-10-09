# Daily cash deposit UI and durable operation recovery

Implemented ADR 0028 in `codex/line-daily-deposits`, managed worktree `online-billing-wave-a/ucom-pos`.

- Mobile cash page fetches all version-bound pending-day pages before enabling selection. It includes unknown-day opening/reconciliation batches and reserved-only disabled lines, uses exact cents, and confirms pre-departure drawer separation and bank-bound cash.
- Handover cards distinguish pre-departure drawer cash from additional physically returned drawer cash. Authenticated handover deep links and private evidence lookup use the specific handover RPC independently of recent history.
- Cash event intents persist exact actor/epoch/action/payload under operation-v2 localStorage before dispatch. Receiving lock precedes creation/UUID lock. Corrupt, unreadable, foreign, and unowned legacy intents block new operations/intake/ACK/resume and remain visible for investigation. Matching legacy session requests retire only after validated resolution.
- Recovery uses notification-aware server execution. Success requires authenticated original actor and exact operation proof plus result equality; business entity IDs may differ from operation UUIDs. Unknown/auth failures retain intent. Authoritative rejection resets confirmation and refreshes status. Notification failures persist a separate event resend entry.
- Shared POS recovery panel includes cash events, and storage events refresh pending UI.
- Existing close-day review and confirm preserve their own close request protocol while taking the receiving/creation or UUID lock and blocking unresolved operation-v2 events.

## Checks actually executed

`node --experimental-strip-types src/lib/cash/operations.check.mts` passed. Checks cover exact money selection, unknown opening, duplicate and reserved-only rejection, corrupt intents, legacy ownership binding/refresh/retirement, and settlement result entity UUID distinct from operation UUID.

Scoped ESLint for cash UI/helpers/client/types passed. `npx tsc --noEmit --incremental false` passed. Normal incremental tsc was blocked by sandbox write permission for worktree `tsconfig.tsbuildinfo`; disabling incremental avoided this unrelated artifact write.

Parent owns integrated local SQL/HTTP/browser validation. This entry does not claim browser, hosted Auth/Storage, or LINE delivery acceptance. No production writes, commits, pushes, deployments, or new dependencies were performed.
