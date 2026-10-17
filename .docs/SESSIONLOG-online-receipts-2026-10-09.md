# Temporarily disable new offline bills — 2026-10-09

## Authorization and scope

The owner explicitly requested disabling offline bills temporarily and prioritizing ordinary online billing. They chose agent-run local browser checks using test data without production writes or LINE delivery. This supersedes the earlier ADR decision to retain new offline intake; it does not authorize deleting old receipts or deploying the dirty workspace.

## Changes

- Shared intake in `src/lib/cash/client.ts` rejects offline before calling status and checks again before work. Every new intake obtains fresh server status; cached display data cannot authorize a bill. Existing pause/device locks remain.
- POS checkout applies the online requirement to all bill types. An unknown transport/RPC outcome keeps cart, client UUID and the persisted receipt payload. Removed new offline enqueue and optimistic catalog stock deductions/cart clearing. Definite errors and successful responses retain their existing treatment.
- Old queue keys/data, sync, owner classification and pending receipt retry paths remain. No localStorage data reset or shape change. POS labels its online requirement.
- Added five local browser cases and updated obsolete offline-creation acceptance expectations and the existing offline pause message. Parent read the delegated suite and config changes directly.
- Fixture launcher uses `UCOM_LOCAL_CASH_LAB=1` and a separate `.next/cash-lab` distDir; normal Next builds retain `.next`. This avoided stopping the unrelated port-3002 server. No dependency added. Generated tsconfig changes were reverted after stopping only the created lab server.
- ADR 0027, the online-only plan, user guide and pending command plan record the policy. New offline attribution is deferred; unresolved opening/drawer cancellation rules remain scoped to the future daily deposit feature.

## Verification actually performed

- `npx playwright test --config tests/local-cash/playwright.config.ts online-only.spec.ts`: 5/5 passed, 6.6 seconds. Both active/inactive book phases reject new offline bills without receipt RPC/new queue/new persisted receipt/cart clear/stock deduction; online resumes successful simulated checkout. Unknown online responses retain exact payload/UUID and retry succeeds. Existing queued and pending receipts survive reload/failure and remain recoverable.
- Auth, status, catalog and receipt responses are localhost fixtures. Browser success validates client/UI/transport semantics, not live financial SQL, real stock deduction, hosted Auth/Storage, or a server commit with a lost response. Initial five failures were ERR_CONNECTION_REFUSED before assertions; after fixture launch correction all passed.
- `npx tsc --noEmit` passed before the fixture launch and after generated-config restoration.
- Scoped ESLint passed for application, fixture config/script and affected test files.
- Independent scrutiny PASS: traced shared POS/repair/topup/income/consignment intake, fresh status, ambiguous retry payload binding, preserved legacy queue and pending recovery. Reviewer correctly bounded mocked browser evidence; no separate reviewer production writes or rerun.
- Scoped whitespace check passed.

## Remaining

Not committed, pushed or deployed. No migration or production data write, secret edit or LINE send occurred. New `/ฝากเงิน` command/per-day selection still awaits its own final rules and scrutiny PASS. This session proves only the bounded online-only client change locally; old deployed clients retain their prior behavior until an approved compatible release reaches them.
