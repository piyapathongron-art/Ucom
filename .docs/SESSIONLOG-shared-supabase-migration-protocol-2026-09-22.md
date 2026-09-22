# Session log — Shared Supabase migration protocol

## Decision recorded

- Kept the shared `DailyGold & Ucom` migration history intact.
- Recorded the scoped Ucom migration protocol in ADR 0008: no `supabase db push`, no inferred repair of historical versions, and explicit preflight/apply/postflight for each new Ucom migration.

## Evidence

- A shadow database applied every local Ucom migration successfully.
- The remote schema has no Ucom object drops relative to that shadow database.
- The remote adds DailyGold's `display_settings` table and shared privilege drift, so this repository is not the sole schema authority.

## Local-only work

- Linked the checkout to `bihgcdceovfettoxmgme` and used Docker only for read-only schema dump and shadow diff.
- No additional production migration, data write, history repair, commit, push, or deploy occurred in this session.
