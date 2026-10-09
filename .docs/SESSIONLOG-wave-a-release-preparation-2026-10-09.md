# Wave A release preparation

Date: 2026-10-09. Request: execute the consolidated online-billing/LINE-deposit plan.

Prepared a managed worktree at `/Users/arty/.codex/worktrees/online-billing-wave-a/ucom-pos`, branch `codex/online-billing-wave-a`, baseline `bab2b5ef56156ab1f480725cb8e8adf83c59b149`. Independently inventoried compatible writer dependencies, then copied only the selected runtime/check/installed-reference files. Read actual POS/login/proxy/LINE diffs and checked types/lint/build. Unrelated import and primary-checkout changes were preserved.

Default production build, diagnostic webpack build, types, scoped ESLint, money/LINE self-checks and five local simulated browser cases passed. Browser verification was explicitly selected for this candidate. Initial dependency symlink and stale PostCSS cache failures were resolved by correcting local preparation, without changing the build command or adding dependencies. Hosted receipt posting, real Storage and LINE delivery are unverified. No new database migration, cash opening, commit, push or deployment occurred.

Accepted the master plan's recommended unknown-date opening batch and persistent pre-departure drawer remainder under the user's execute instruction. Created ADR 0028 and daily-allocation contract through a delegated document task. Independent scrutiny requested frozen source-day provenance and durable actor-bound request recovery; both were fixed and re-reviewed to design PASS. This does not certify implementation. Wave-B implementation is absent from the wave-A runtime.

Authoritative candidate scope, hashes, commands and approval boundary: [release inventory](../docs/pos/release-online-billing-wave-a-2026-10-09.md). Overall sequence: [master plan](../docs/pos/master-plan-online-billing-line-deposits-2026-10-09.md).
