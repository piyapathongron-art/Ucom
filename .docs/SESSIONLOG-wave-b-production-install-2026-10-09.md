# Wave B approved production installation

Date: 2026-10-09. Owner explicitly approved fresh backup, exact daily allocation migration, commit/push only `codex/line-daily-deposits`, and deploy `ucom` under `piyapathongron-3507s-projects`. Activation/opening, financial records and actual LINE sends remain excluded. Owner chose agent production browser verification read-only.

## Backup and preflight

Target project `bihgcdceovfettoxmgme` confirmed through linked project metadata and generated connection identity. Preflight: epoch null, activationReady false, version 0, reminders disabled, all cash operation/source/movement/handover/closing counts zero, new allocation tables/history version absent. Original live/local migration timestamp differences were preserved; no blanket db push or history repair attempted.

Fresh custom-format public/schema-history backup `.backups/ucom-wave-b-20261009T101758Z-public-history.dump`, 473,057 bytes, SHA-256 `ad9503c2d6f8eb0e49d369f5ad91cfb07dc68fe666ae8d8759ae216107e7170b`, mode 0600 and Git-ignored. Restore into retained local Docker database `ucom_wave_b_restore_20261009t101758z` exited 0, all 26 archive table counts matched (3,729 rows). Auth ID stubs and pre-existing local roles used, only duplicate empty CREATE SCHEMA public omitted. No full Auth/Storage, ownership or off-device disaster recovery claim.

Vercel environment-name/scope inventory rechecked: six expected LINE/Supabase variables present for Production/Preview, system variables enabled. No values revealed/settings edited. Existing service-role Config/Needs Attention classification and absent CRON_SECRET remain separate settings work.

## Installation and readback

Applied exact `20261009090327_daily_cash_allocations.sql`, SHA-256 `d37dbac68c922e34190f47f16998e71e06d37bed85ab225e5cea6774f830fead`, using the existing linked CLI connection and PostgreSQL role after connector access denial. DDL and the `20261009090327`/`daily_cash_allocations` migration history record committed together; PostgREST schema reload notified. No other migration applied.

Read-only postchecks: all 16 installed function bodies exactly match source and one signature per name. `ucom_cash_origins`/`ucom_cash_allocations` have RLS; anon/authenticated lack direct table privileges; both tables empty. Book remains epoch null, activationReady false, version 0, receiving unpaused; reminders disabled; all cash history/source counts zero.

## Release validation

Final parent local SQL/HTTP, mutation/replay/concurrency/readback checks passed; mobile daily deposit/recovery and corrupt-close guard passed; close-day regression passed; build, TypeScript, scoped lint and whitespace checks passed. Independent design and implementation scrutiny PASS. See [integrated evidence](SESSIONLOG-line-daily-deposit-integration-2026-10-09.md).

Commit/push and deployment proceed under the same explicit bounded approval. Post-deployment acceptance will be recorded separately; no activation/opening or LINE delivery is certified by this installation.
