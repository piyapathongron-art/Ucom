# Online-only receipt intake

Status: local implementation and scoped verification complete; not deployed. The owner explicitly asked to disable new offline bills temporarily and prioritize the normal online flow. Independent scrutiny PASS covers this change, not the unfinished per-day deposit design.

## Bounded change

- Require online connectivity and a fresh server cash-status response at the shared intake boundary. Keep existing receiving pause/device checks.
- Remove POS fallback that treats an unknown receipt response as an accepted offline sale. Preserve cart, original receipt UUID/payload and retry recovery until a definite outcome.
- Preserve every existing queue and its replay/classification protocol, plus cached catalog/status display. No queue reset, storage-key migration or financial schema change.
- Update contradictory offline acceptance expectations. Test through a local browser with simulated Auth/catalog/receipt responses and explicit transport failures, without production writes or LINE delivery.

## Verification and tooling

Use existing Playwright local-cash tooling and runners. The local fixture must run separately from the already-running port-3002 dev server, use a fixture-only nested distDir and blank LINE/service-role configuration. No dependency is added. Inspect delegated test changes directly before accepting results. Run type checking and scoped lint; report simulated receipt responses separately from SQL financial acceptance.

No commit/push/deploy is included. Re-enabling new offline creation requires a separate reviewed change. The `/ฝากเงิน` per-day feature remains under its own [design plan](plan-line-deposit-command-2026-10-09.md).

## Results

- Existing local browser runner: five new online-only cases passed in 6.6 seconds, covering both inactive/active cash epochs, blocked offline checkout, preserved cart/stock/receipt IDs, same-payload retries and pre-existing queue/request recovery.
- Tests use controlled localhost RPC responses. They do not certify actual SQL posting/stock changes or a real server commit followed by a lost response. The prior cash SQL replay checks are a separate layer, not rerun here.
- Scoped lint and type checking passed. Old offline-creation E2E expectations and paused-offline messaging were updated but those stateful hosted-write tests were not run.
- The first browser launch failed before reaching assertions because the local fixture was unavailable. A pre-existing port-3002 Next dev server held the default build lock. Fixture-only distDir resolved the conflict without stopping that server. The created fixture server was stopped after testing, and Next-generated tsconfig changes were restored.
- No production business write, migration, LINE send, secret edit, Git mutation or deployment occurred. Session record: [online-only change log](../../.docs/SESSIONLOG-online-receipts-2026-10-09.md).
