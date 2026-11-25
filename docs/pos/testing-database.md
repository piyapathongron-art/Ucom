# Testing migrations without touching production

Production is the shared `DailyGold & Ucom` Supabase project (ADR 0008), and `tests/e2e` runs against it. Database changes are tested on a throwaway local Supabase instead.

## In CI (every pull request)

`.github/workflows/ci.yml` has two jobs:

- **app**: `npm ci`, `npm run lint`, `next build` (including TypeScript), and every `*.check.mts` self-check under `src/` and `supabase/`.
- **database**: `supabase db start` creates a local Postgres with Supabase's `auth` and `storage` schemas and applies every migration in `supabase/migrations`, in order. `supabase test db` then runs the pgTAP files in `supabase/tests/database`.

A migration that fails to apply fails the PR before it ever reaches production.

## On your own machine

You need Docker Desktop (or Docker Engine in WSL 2). The Supabase CLI runs through `npx`, so nothing else needs installing:

```powershell
npx supabase@2.122.1 db start
```

```powershell
npx supabase@2.122.1 test db
```

```powershell
npx supabase@2.122.1 stop --no-backup
```

`db start` applies all migrations into a fresh database. To re-apply after editing a migration, run `npx supabase@2.122.1 db reset`.

## Writing a database test

- Put one file per migration or feature in `supabase/tests/database/NN_name.test.sql`.
- Wrap it in `begin; … rollback;` and declare `select plan(n);`.
- Create the users you need in `auth.users` and `public.profiles`.
- Act as a shop account with `set local role authenticated;` plus `select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);`. Go back to the test owner with `reset role;`.
- The base tables are owner-only. Read the ids you need as the test owner, and pass them in through `set_config('test.x', …, true)` / `current_setting('test.x')`.
- Use `throws_ok(sql, '<SQLSTATE>', null, 'description')` for refusals and `lives_ok(sql, 'description')` for allowed calls.

## Still to confirm

`supabase/config.toml` uses Postgres 17. Check that production matches with `SHOW server_version;` in the dashboard's SQL editor, and change `major_version` if it differs.
