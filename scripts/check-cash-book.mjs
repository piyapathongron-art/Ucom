// Local-only SQL runner. No .env or Supabase credentials are read.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const container = 'ucom-cash-review-20261007';
const run = (sql, database = 'postgres') => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], { input: sql, encoding: 'utf8' });
  if (result.status !== 0) { process.stderr.write(result.stderr ?? result.error?.message ?? 'SQL check failed'); process.exit(1); }
  return result.stdout + (result.stderr ?? '').split('\n').filter(line => /PASS|FAIL/.test(line)).join('\n');
};
const exists = run("select 1 from pg_database where datname='ucom_cash_check';");
if (!exists.includes('(1 row)')) {
  run('create database ucom_cash_check;');
  run(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
    grant usage on schema auth,storage to authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert on storage.objects to authenticated;
  `, 'ucom_cash_check');
  const directory = path.join(root, 'supabase/migrations');
  const baseline = readdirSync(directory).filter(name => name.endsWith('.sql') && name < '20261007').sort();
  for (const file of baseline) {
    run(readFileSync(path.join(directory, file), 'utf8'), 'ucom_cash_check');
    console.log('baseline:', file);
  }
}
let check = readFileSync(path.join(root, 'scripts/check-cash-book.sql'), 'utf8');
check = check.replace(/^\\ir\s+(.+)$/gm, (_, relative) => readFileSync(path.resolve(root, 'scripts', relative.trim()), 'utf8'));
if (process.argv.includes('--mutate-receipt-fund')) {
  check = check.replace("when s.source_table in ('sales','shop_income') then 'pending'", "when s.source_table in ('sales','shop_income') then 'drawer'");
}
if (process.argv.includes('--mutate-pause-guard')) {
  check = check.replace("'income') and b.receiving_paused then", "'income') and false then");
}
const output = run(check, 'ucom_cash_check');
const checks = output.split('\n').filter(line => /PASS|ROLLBACK|assert|rejected/i.test(line));
console.log(`${checks.filter(line => /PASS/.test(line)).length} SQL assertions passed`);
console.log(checks.slice(-10).join('\n'));
