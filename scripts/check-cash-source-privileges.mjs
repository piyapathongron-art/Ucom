// Local-only transaction against the existing disposable cash baseline. No .env.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { localJwt } from './cash-browser-lab.mjs';

const migration = readFileSync(new URL('../supabase/migrations/20261009040000_cash_source_privileges.sql', import.meta.url), 'utf8');
const sql = `
begin;
do $$ begin
  if current_database()<>'ucom_cash_check' or to_regclass('public.ucom_cash_book') is not null then
    raise exception 'Refusing check outside disposable pre-cash baseline';
  end if;
end $$;
create function pg_temp.check_that(ok boolean,label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %',label; end if;
raise notice 'PASS: %',label; end $$;
create function pg_temp.denied(statement text,label text) returns void language plpgsql as $$
declare blocked boolean:=false;
begin
  begin execute statement; exception when insufficient_privilege then blocked:=true; end;
  perform pg_temp.check_that(blocked,label);
end $$;
-- Model the observed Supabase default grants that bare local Postgres lacks.
grant usage on schema public,auth to anon,authenticated;
grant all on table public.sales,public.sale_items,public.expenses,public.shop_income,
  public.repair_jobs,public.consignments,public.day_closings,public.profiles to anon,authenticated;
grant select on public.shop_income to public;
select pg_temp.check_that(has_table_privilege('anon','public.shop_income','insert')
  and has_table_privilege('authenticated','public.sales','truncate'),'unsafe baseline reproduced');
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000103');
insert into public.profiles(id,display_name,role) values
  ('00000000-0000-4000-8000-000000000101','LOCAL OWNER','owner'),
  ('00000000-0000-4000-8000-000000000102','LOCAL STAFF','staff');
insert into public.shop_income(name,amount,received_to,created_by)
  values('LOCAL EXISTING INCOME',10,'cash','00000000-0000-4000-8000-000000000101');
${process.argv.includes('--mutate-skip-migration') ? '' : migration}
select pg_temp.check_that((select relrowsecurity from pg_class where oid='public.shop_income'::regclass),
  'income RLS enabled');
select pg_temp.check_that(not exists(select 1 from unnest(array['sales','sale_items','expenses',
  'shop_income','repair_jobs','consignments','day_closings','profiles']) t
  where has_table_privilege('anon','public.'||t,'select')
    or has_table_privilege('anon','public.'||t,'insert')
    or has_table_privilege('authenticated','public.'||t,'truncate')),
  'anonymous table access and authenticated truncate removed');
set local role anon;
select pg_temp.denied('select id from public.shop_income limit 0','anonymous income read denied');
select pg_temp.denied('insert into public.shop_income(name,amount,received_to) values (''LOCAL ANON'',1,''cash'')',
  'anonymous income write denied');
select pg_temp.denied('select public.rpc_add_shop_income(''LOCAL ANON RPC'',1,''cash'')',
  'anonymous income RPC denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select pg_temp.check_that((select count(*) from public.shop_income)=0,'nonmember sees no income');
select pg_temp.denied('select public.rpc_add_shop_income(''LOCAL NONMEMBER'',1,''cash'')',
  'nonmember income RPC denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select pg_temp.check_that((select count(*) from public.shop_income)=1,'staff reads existing income');
select pg_temp.denied('insert into public.shop_income(name,amount,received_to) values (''LOCAL DIRECT'',1,''cash'')',
  'staff direct income insert denied');
select pg_temp.denied('update public.shop_income set amount=2','staff direct income update denied');
select pg_temp.denied('delete from public.shop_income','staff direct income delete denied');
do $$ declare t text; begin
  foreach t in array array['sales','sale_items','expenses','shop_income','repair_jobs','consignments','day_closings','profiles'] loop
    perform pg_temp.denied('truncate table public.'||t||' cascade','truncate denied: '||t);
  end loop;
end $$;
select public.rpc_add_shop_income('LOCAL STAFF RPC',7,'cash');
select pg_temp.check_that((select count(*) from public.shop_income where name='LOCAL STAFF RPC')=1,
  'staff income RPC still writes');
select public.rpc_delete_shop_income((select id from public.shop_income where name='LOCAL STAFF RPC'));
select pg_temp.check_that((select count(*) from public.shop_income where name='LOCAL STAFF RPC')=0,
  'staff legacy income delete RPC still works before cutover');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.check_that((select count(*) from public.shop_income)=1,'owner reads existing income');
insert into public.expenses(name,amount,spent_at,paid_from,created_by)
  values('LOCAL LEGACY EXPENSE',3,current_date,'cash','00000000-0000-4000-8000-000000000101');
select pg_temp.check_that((select count(*) from public.expenses where name='LOCAL LEGACY EXPENSE')=1,
  'owner legacy direct expense write preserved');
select public.rpc_add_shop_income('LOCAL OWNER RPC',8,'transfer');
select pg_temp.check_that((select count(*) from public.shop_income where name='LOCAL OWNER RPC')=1,
  'owner income RPC still writes');
rollback;
`;
const result = spawnSync('docker', ['exec', '-i', 'ucom-cash-review-20261007', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'ucom_cash_check'], { input: sql, encoding: 'utf8' });
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? result.error?.message ?? 'Local SQL check failed');
  process.exit(1);
}
assert.match(result.stdout, /ROLLBACK/);
const passes = result.stderr.split('\n').filter(line => /PASS:/.test(line));
console.log(passes.join('\n'));
console.log(passes.length + ' privilege checks passed; local transaction rolled back');
if (process.argv.includes('--http')) {
  // Requires the same migration installed in the disposable HTTP fixture only.
  const origin = 'http://127.0.0.1:55440';
  const member = localJwt('authenticated', '00000000-0000-4000-8000-000000000002');
  const outsider = localJwt('authenticated', '00000000-0000-4000-8000-000000000003');
  const request = (path, bearer, method = 'GET', body) => fetch(origin + path, {
    method, headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.ok([401, 403].includes((await request('/shop_income?select=id&limit=0')).status));
  assert.equal((await request('/shop_income?select=id&limit=0', member)).status, 200);
  const deniedRows = await request('/shop_income?select=id&limit=1', outsider);
  assert.equal(deniedRows.status, 200);
  assert.deepEqual(await deniedRows.json(), []);
  assert.equal((await request('/shop_income', member, 'POST', { name: 'LOCAL FORBIDDEN DIRECT', amount: 1, received_to: 'cash' })).status, 403);
  const status = await request('/rpc/rpc_cash_status', member, 'POST', {});
  assert.equal(status.status, 200);
  assert.equal((await status.json()).isOwner, false);
  console.log('Local real PostgREST HTTP checks passed: anonymous denied, member read preserved, nonmember RLS, direct income write denied, cash status RPC preserved.');
}
