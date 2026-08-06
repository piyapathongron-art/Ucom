-- Minimal stand-in for the parts of Supabase that our migrations reference,
-- just enough for the three POS migration files to apply cleanly in plain Postgres 17.
-- Not a substitute for testing against the real project — only catches syntax/logic
-- errors in our own SQL before it touches prod.

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid()
);

-- `auth.uid()` in Supabase reads a JWT claim set per-request. Here it reads a
-- session-local setting so a psql session can pretend to be a given user.
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create role authenticated;
create role anon;
