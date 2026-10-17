// Disposable local fixture only. Does not read .env or contact Supabase.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const container = 'ucom-cash-review-20261007';
export const database = 'ucom_cash_http_20261008';
const run = (sql, db = 'postgres') => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], { input: sql, encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr || 'Local PostgreSQL failed');
  return result.stdout;
};
if (!run(`select 1 from pg_database where datname='${database}';`).includes('(1 row)')) {
  run(`create database ${database} template ucom_cash_check;`);
  const files = readdirSync('supabase/migrations').filter(file => file.startsWith('20261007')).sort();
  for (const file of files) run(readFileSync('supabase/migrations/' + file, 'utf8'), database);
  run(`
    create or replace function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role')$$;
    insert into auth.users(id) values
      ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
    insert into public.profiles(id,display_name,role) values
      ('00000000-0000-4000-8000-000000000001','LOCAL OWNER','owner'),
      ('00000000-0000-4000-8000-000000000002','LOCAL STAFF','staff');
    update public.ucom_cash_book set activation_ready=true where id;
    set role authenticated;
    select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
    select public.rpc_cash_execute(gen_random_uuid(),null,'open',jsonb_build_object(
      'drawer','1000','pending','16457','device','20000000-0000-4000-8000-000000000001',
      'deviceToken',repeat('a',64),'queueDrained',true,'physicallyPaused',true,'reason','Local-only physically counted fixture'));
    select public.rpc_cash_pos_ack((public.rpc_cash_status()->>'epoch')::uuid,
      '20000000-0000-4000-8000-000000000001',repeat('a',64),(public.rpc_cash_status()->>'version')::bigint);
  `, database);
}
// Supabase applies project default table grants; bare PostgreSQL fixture does not.
// Keep existing member-read RLS and grant only the read used by the legacy summary.
run('grant select on public.day_closings to authenticated;', database);
console.log('Local cash HTTP fixture prepared:', database);
