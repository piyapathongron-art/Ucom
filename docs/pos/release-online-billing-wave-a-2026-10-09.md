# Wave A release candidate: online-only billing

Date: 2026-10-09. Status: **Prepared locally; not committed, pushed or deployed.**

## Exact candidate

- Baseline: `bab2b5ef56156ab1f480725cb8e8adf83c59b149` (recorded deployed/main baseline; not a new deployment audit).
- Branch: `codex/online-billing-wave-a`.
- Workspace: `/Users/arty/.codex/worktrees/online-billing-wave-a/ucom-pos`.
- 45 runtime source files, 15 check/tool/config files and 5 already-installed migration reference files. Documentation is supporting evidence and includes pending wave-B design, never implemented LINE command behavior.
- No package/dependency/lockfile change. No environment file copied; build used local placeholder public values. Vercel must rebuild using its actual Production configuration, never upload this fixture-configured build output.

## Behavior and boundaries

New bills require online connectivity and fresh cash status. Unknown outcomes retain UUID/payload/cart for retry. Existing queued bills and stock/recovery behavior remain supported. All existing cash writers use the compatible cash boundaries so the eventual cutover does not strand legacy writers. Cash book remains unopened and reminder configuration disabled according to the last recorded installation check; verify these again before deploying.

Base deposit/closing forms and snapshot notifications are included. The `/ฝากเงิน` chat command and per-day deposit selections are wave B and absent from this runtime. Do not open the cash book until wave-B allocation support and the physical cutover are accepted.

## Validation actually executed in this candidate

- Default `npm run build`: PASS, Next.js 16.3.0 Turbopack, fixture public values.
- Diagnostic `next build --webpack`: PASS.
- `tsc --noEmit`: PASS after restoring Next-generated tsconfig formatting to baseline.
- Scoped ESLint: PASS, 59 source/tool/test files.
- `node src/lib/cash/money.check.mts`: PASS.
- `node src/lib/line/cashFlex.check.mts`: PASS.
- `playwright test --config tests/local-cash/playwright.config.ts online-only.spec.ts`: 5/5 PASS, 8.0 seconds. User selected agent browser verification for this candidate.
- `git diff --check`: PASS.

Browser cases cover inactive/active book offline refusal, online recovery with unchanged receipt intent, and legacy queued/ambiguous request recovery. Their receipt responses and Auth are simulated; they do not prove hosted SQL posting, actual commit-with-lost-response idempotency, hosted Storage or real LINE delivery. Prior local cash SQL/HTTP suites were not rerun in this release preparation.

Preparation initially failed due to an out-of-root node_modules symlink, then a stale generated PostCSS build cache. Dependency copies and a fresh cache fixed the default build; application config/package scripts were not changed to bypass Turbopack. Preserved temporary links/caches reside in /private/tmp; no user process or production data was removed.

## Explicit release exclusions

AGENTS.md, docs/CONTEXT.md, legacy import scripts/docs, historical unrelated session logs, secrets/backups, and `20260930130000_close_day_digest_all_carriers.sql` are excluded. The original dirty checkout remains intact.

## Installed migration references

These files are committed references/local fixtures only, not an instruction to apply them again:

| Local version | Recorded live version |
| --- | --- |
| 20261007104254 | 20261009061359 |
| 20261007104638 | 20261009061409 |
| 20261007104639 | 20261009061418 |
| 20261007104640 | 20261009061433 |
| 20261009040000 | 20261009034817 |

See [production installation plan](plan-production-two-fund-cash-2026-10-09.md). Never run an unreviewed `db push` against divergent history.

## Next release gate

AGENTS.md sections 1 and 4 require explicit authorization for commit/push/deploy. Proposed bounded scope: commit this candidate on its named branch, push only that branch to origin, and deploy its source to Vercel project `ucom`, team `piyapathongron-3507s-projects`, Production `ucom.vercel.app`, with no cash activation, migration application, environment changes, test sale or LINE send. This direct branch deployment does not merge main; a later PR/main reconciliation needs its own instruction.

Before an authorized release, recheck candidate hashes, baseline drift, production variables and unopened cash state without exposing secrets. Hosted financial acceptance needs separate concrete write authorization. Existing owner/staff read-only acceptance cannot stand in for a sale test.

## Candidate file hashes

| File | SHA-256 |
| --- | --- |
| `next.config.ts` | `8b23e28b65da458ddd583c515cd7222e87b52e505690ab97e3b960c1080d2950` |
| `scripts/cash-browser-lab.mjs` | `ec71c54be1d6f5a5cf01bd0685f80d571519a8f4d2ab2a0e1571bf0e3257351c` |
| `scripts/check-cash-book.mjs` | `dc9c3014ee4803f29462cb0182fc161aa57bdb5c0d457b3f753b349d2f7e1c1a` |
| `scripts/check-cash-book.sql` | `f0e8fed327e163002545ed4a9f631b063381559e24a832553e3aeeae027dde38` |
| `scripts/check-cash-concurrency.mjs` | `21a9146037d32cad34ea1ab122cc6ae782c098ad7da3fdf948da0cddd427b70f` |
| `scripts/check-cash-http.mjs` | `2ba9faa67fcc7e49ba9172b88713b43192892f73c827781863fa3a58c2132844` |
| `scripts/check-cash-source-privileges.mjs` | `6affed9cd8d7f2e14b9c446e3b70df028f5ed1b051e2a79cf4b0377842f4bb2b` |
| `scripts/prepare-cash-local.mjs` | `ae6a52e8b97b61ba182450e22b32a42adf8289187250b739bcd203384370cf49` |
| `scripts/refresh-cash-local.mjs` | `194588b2676aff32baed3f5a4ce9d418a1b81b037c2e48d64be7d5f767eb4a11` |
| `src/app/(owner)/expenses/page.tsx` | `5e96b36b4e718de05b10865c16dc57e0496976b7227000a9a490de3fbe11113b` |
| `src/app/(owner)/expenses/useLedgerPage.ts` | `39fc8b280adbc99e3cb18247959a0395a3d72dc0811c38d6d22cef48e7bec02e` |
| `src/app/(staff)/cash/actions.ts` | `d34c7141dc655594b6f1f1521f81b3ee2382b95eef884c45a692b0220f250349` |
| `src/app/(staff)/cash/cash-form.tsx` | `94028d0b85782cdd756b5450230fe676a1f0b5bebc322f176a4ef6e3ace29de4` |
| `src/app/(staff)/cash/cash-overview.tsx` | `a846be00b8505414f7348850dcdad3948924a26b01b322a2234d9ea2fa95cbd3` |
| `src/app/(staff)/cash/handover-card.tsx` | `1891208bf98f6b331215c3766d0f2e31c6a46f57f9a68f19410f6c5e33653da7` |
| `src/app/(staff)/cash/owner-controls.tsx` | `bdf14599a36d511a057783fcc03eced8f7c611a1e58c4b625b7761453a4c3e74` |
| `src/app/(staff)/cash/page.tsx` | `e95561f4c630be1d688e00b0bea0afc3573bf6650956a445c556a00e2c339f39` |
| `src/app/(staff)/close-day/CashClosing.tsx` | `2171252e7c272ad297b5ed11e82f404d3ee5f0849dc0c45fbf34e5817be5a198` |
| `src/app/(staff)/close-day/LedgerSection.tsx` | `d93e171b19e59e79f924cf34891a7bb72d3990f9e20b171a617a432d88f7f3f5` |
| `src/app/(staff)/close-day/actions.ts` | `79f42e5920c613fc0fd658a7dfa511aa60715d77cbcbf50cd7266ad3500a6c3f` |
| `src/app/(staff)/close-day/page.tsx` | `90f47a92b10cce83a380adc7c77444697b01849758e68f96412115eef01969af` |
| `src/app/(staff)/close-day/useCloseDayData.ts` | `2a29439b5aa9c3fbb5382cbc17a80c65dd72e55c111e7dd37dcc18378f0856b2` |
| `src/app/(staff)/consignments/ConsignDialogs.tsx` | `d0ded785f449ea8fa27826a6bb4c9afcb2254f1185178501ae96c78089f62fc8` |
| `src/app/(staff)/consignments/ConsignmentsTab.tsx` | `c9dfd5570b0b46e22af8ec93aefc293739508409f7c915bf6bf7c3217819138a` |
| `src/app/(staff)/consignments/consignTypes.ts` | `7bd62c26e6159cb463e843a182138c2480420fada0e7b4f42e0785c11d787a24` |
| `src/app/(staff)/pos/OpeningCoveredQueue.tsx` | `ca27d42736758ff3a879cff2454438e0975bd4732969fe38d6e331c6f83d32f6` |
| `src/app/(staff)/pos/page.tsx` | `eb0d3d35a96a9dc9b8b11b9b97ee5020e73b747f3edda9035c92d3e033c3a61b` |
| `src/app/(staff)/pos/queue.ts` | `99f8a348db12a08293d990d3f3f2fa72369f455ddfad73d9370974c078427b73` |
| `src/app/(staff)/repairs/CloseJobDialog.tsx` | `b34a38b3ac1f647ae47599cbfc3b8a343924cb6d9d4a3a95b1b67f02f5d1816a` |
| `src/app/(staff)/repairs/RepairRowCard.tsx` | `5a93824c6be018059ab1485ec18d4e97f761cd7c49ee23a60d9dc8786e79b661` |
| `src/app/(staff)/repairs/RepairTable.tsx` | `0c62bf196216c0df775b1873fca06ef55f084b31aa312c318de0dff43fb1f5ef` |
| `src/app/(staff)/repairs/page.tsx` | `8bd67d1c83249eef2868b156ddae83c5aec460ea4a97628939381b6fe9d03b7c` |
| `src/app/(staff)/repairs/types.ts` | `19e62be290e6828725fc6704c390d36ca3afd4a359fdeb814e67ebc18d208531` |
| `src/app/(staff)/repairs/useRepairRowActions.ts` | `b65063a7956c90c3c4e4dfb1be3b32ef0435345ae7807ef51091c0fb3221fd60` |
| `src/app/(staff)/topup/page.tsx` | `cb3de06853a1a45f2db88bc0f8fb537fa36d7b6fceea6be32c602554f55ebd7f` |
| `src/app/_components/ConfirmDialog.tsx` | `9997c5833b048f3ad05fab2e87b6b1a4aad9443e2724b913ba47788255ab8a26` |
| `src/app/_components/LedgerAddDialog.tsx` | `dcefbd27f5da98586f14565eab60ef92f0b3aa55d60d5a42a0ffd693d9f9c182` |
| `src/app/_components/navLinks.ts` | `71b9475a2590d3db29df5f4f9537bc912d2df9ab053bc44b073060500a90dafd` |
| `src/app/api/line/cash-reminder/route.ts` | `7e8954c928b1d869aaf3055e8df5c492a1592deeff676960d548fcddc39ef23f` |
| `src/app/login/actions.ts` | `d4a336f40feb6e008d4c54db48544c5aac5b78ac4a66f105930bf527150f9180` |
| `src/app/login/page.tsx` | `d9b26a1eb5b8e4133c091850f9a4e1dee591d695d0e0e6389d241fb587976afb` |
| `src/lib/cash/FundSelect.tsx` | `4b09a925b32bfb70e89eb903e879639642800040b0067d259c8036f391485591` |
| `src/lib/cash/PendingCashRequests.tsx` | `8dacff4f4dee9a6e8a5b525e3d1ccad6195a7a5176226161c8c837c04e1f13be` |
| `src/lib/cash/client.ts` | `cdb71697939534b4fc35b03048e8ff12943049e1efffed8c2a6fef9b9c03e45c` |
| `src/lib/cash/errors.ts` | `750035fae68c8e3c5f3b81938c36f7cfbc838f21a9658f93f3efdf78567f5843` |
| `src/lib/cash/money.check.mts` | `3c4cea2fbe2deda9b2602dca0774dac164ad6918e777b759c163e74b9e64e368` |
| `src/lib/cash/money.ts` | `78af83882f5e0fe7351ab8a3d2ede6193d16739e7e9dd1337692d33bfdd5ff97` |
| `src/lib/cash/receipt.ts` | `9594332ea471f8f5d2031134c4a6fd8e76eccb21f16c9c817cb3eafd323f5d21` |
| `src/lib/cash/types.ts` | `abee9ef0f395bd48ccfab18b68506484958145070b9948e5ea38aea038457fd8` |
| `src/lib/cash/useCashStatus.ts` | `2ec7e02d6d4fd60cdd2bd7055635e9abef1ec7b1edd714ca63a21f9943564e65` |
| `src/lib/line/cashFlex.check.mts` | `f5806e06c23cbd6a4bed7db27f46c6ca4afa3e7cf42c5e19d9f8d2c5d6dd4bc9` |
| `src/lib/line/cashFlex.ts` | `64693cf7daccb4596531cf20f97353afe82e013aedff25facb6d06cd89cfa806` |
| `src/lib/line/push.ts` | `2aedc04a13672830310d93ba25dd0133fdcd10d2e3e593be9e3e5c0f2e7e0908` |
| `src/lib/safe-return.ts` | `a76876ea01776aa59d6c10ac3a2b2021e2cd0e610c0d44d52a1ce3cbc5d851de` |
| `src/lib/types/database.ts` | `520e5b4e3be0718894424c577069577f90ad33a09202d003fac0ae4aadea513a` |
| `src/proxy.ts` | `32f551c0161eccd29d7ac4aa5e2f7034809edc58419b1d6ef148afffc0868db4` |
| `supabase/migrations/20261007104254_two_fund_cash_book.sql` | `ee3d46aae2f8b107c07f486c3834317c5ee595fe8885b61aeff25d6547d00e43` |
| `supabase/migrations/20261007104638_cash_source_guards.sql` | `280a19cd6c2c23d2d1959aed4b02bfecfb475b2abe547b5d0f2d56239a4bdfd0` |
| `supabase/migrations/20261007104639_cash_commands_and_evidence.sql` | `a90227f2ab1d37bc3d14afaf9d9cdea2a6840c13cb32ee0e5956274ef7ee8475` |
| `supabase/migrations/20261007104640_cash_reminders.sql` | `0f6ff560df5d2c164804392b3412483790a1999be0d582e272fb3e337f6c9bd1` |
| `supabase/migrations/20261009040000_cash_source_privileges.sql` | `b0066dc84077d2d8df961ffae00ea37ac1459d49d5f9937b48197a3c7df342dd` |
| `tests/e2e/offline.spec.ts` | `6fb88e9c794c2d888b8634f9c2511c26778e935b665ceda954daaad690942510` |
| `tests/local-cash/cash.spec.ts` | `c89da9a84d44ed6e80f15e8cd8dc47aabc5ab6433a76f20fb5b1b5ead58eb58a` |
| `tests/local-cash/online-only.spec.ts` | `c69bc804261f3f769770f9c9a0dc906e74a1c96144810f59f4916c0bdc5e0709` |
| `tests/local-cash/playwright.config.ts` | `8b2f671e7c7bfa5340c32e974892686cc858069ef5a30ceefff5c7204f78d9f1` |
