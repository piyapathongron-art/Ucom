# Cash feature production installation — 2026-10-09

## Authorization

After automatic approval review rejected the prior attempt, the user explicitly approved the displayed four-file production installation scope and requested a complete summary and usage instructions. The authorized scope covers eight tables, eighteen functions, ten triggers, one private evidence bucket, two Storage policies, grants and three seed records. It excludes deployment, readiness activation, opening, reminders, secret edits, LINE sends and Git mutations.

## Installation

Target: DailyGold & Ucom, `bihgcdceovfettoxmgme`. Fresh reads reconfirmed no cash relations or evidence bucket and unchanged sales/expense counts before retry. All four apply_migration calls returned success.

| Reviewed local file | Live version | Name |
| --- | --- | --- |
| `20261007104254_two_fund_cash_book.sql` | `20261009061359` | `two_fund_cash_book` |
| `20261007104638_cash_source_guards.sql` | `20261009061409` | `cash_source_guards` |
| `20261007104639_cash_commands_and_evidence.sql` | `20261009061418` | `cash_commands_and_evidence` |
| `20261007104640_cash_reminders.sql` | `20261009061433` | `cash_reminders` |

File hashes match the reviewed [production plan](../docs/pos/plan-production-two-fund-cash-2026-10-09.md). Preserve live/local timestamp mappings; no blanket db push or migration-history repair was performed.

## Recovery preparation

Refreshed pre-apply public schema/data archive: `.backups/ucom-cash-pre-apply-20261009-public.dump`, 350,824 bytes, SHA-256 `dfab97abd19f0336697bf9bc6ff51218b8bf89d727c6c008e930be4bdae69f30`, mode 0600, excluded from Git. Local isolated restore exited 0 and all 17 table counts matched (3,695 rows). Auth stubs were used; no full Auth/Storage/off-device disaster recovery claim. See [preflight log](SESSIONLOG-cash-feature-apply-preflight-2026-10-09.md).

## Postconditions actually checked

- Read back all 18 live function bodies and compared them with the exact reviewed SQL bodies: all match, one installed signature per name. The ACK signature has four arguments.
- All 37 prior public function-body MD5 fingerprints unchanged.
- Recorded existing counts unchanged: sales 1,356; sale_items 1,971; expenses 67; profiles 2; display_settings 1; shop_income, repair_jobs, consignments and day_closings 0. Count preservation alone is not a full content comparison.
- Eight new tables have RLS enabled and no direct anonymous/authenticated SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges. Public RPCs retain intended authenticated execute grants; internal helpers and reminder workers deny authenticated execute. Both reminder RPCs allow service_role execute.
- Ten intended triggers exist and are enabled, including six source-table guards, repair collection, legacy closing and two immutable-ledger guards.
- Book seed: activation_ready false, epoch null, version 0, receiving_paused false. Reminder config: enabled false, Friday 10:00 Thai scheduling configuration. No financial operations or reminder delivery rows exist.
- Evidence bucket is private, maximum 10 MiB, JPG/PNG/WebP/PDF, with the two expected authenticated read/upload policies.
- Actual anonymous hosted HTTP checks: cash table GET 401; read-only status and closing RPC POST 401; private bucket metadata GET 400. No protected financial command or upload was invoked. Metadata denial does not prove authenticated Storage access.
- Persisted source/metadata evidence: [JSON snapshot](cash-feature-install-evidence-2026-10-09.json). Documentation whitespace check passed.

## Still pending

Compatible client is not deployed. Hosted authenticated cash operations, private evidence upload/view, new browser UI, readiness activation, physical owner opening balances, scheduler configuration and actual LINE delivery remain unverified/unperformed. CRON_SECRET is absent in the previously inspected Vercel inventory. Service-role key Config classification remains separate settings work. No commit, push, deployment, activation, external LINE send or business write occurred beyond the authorized migration seeds.

Prepared [user guide](../docs/pos/guide-two-fund-cash.md); it describes behavior after deployment and opening, not current live UI availability.
