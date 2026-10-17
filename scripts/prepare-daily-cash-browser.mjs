// Disposable localhost fixture. Never reads .env or contacts production.
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const database = process.env.UCOM_DAILY_BROWSER_DATABASE ?? 'ucom_cash_daily_browser_20261009';
if (!/^ucom_cash_daily_browser_[a-z0-9_]+$/.test(database)) throw new Error('Local fixture database name required');
const container = 'ucom-cash-review-20261007';
const sql = (input, db = database) => {
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], { input, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Local fixture SQL failed');
  return result.stdout.trim();
};
if (sql(`select count(*) from pg_database where datname='${database}'`, 'postgres') !== '0') {
  throw new Error('This retained fixture already exists; do not reset financial history implicitly.');
}
sql(`create database ${database} template ucom_cash_check`, 'postgres');
for (const file of readdirSync('supabase/migrations').filter(file => file.startsWith('202610')).sort()) {
  sql(readFileSync('supabase/migrations/' + file, 'utf8'));
}
const owner = '00000000-0000-4000-8000-000000000001';
const staff = '00000000-0000-4000-8000-000000000002';
const device = '20000000-0000-4000-8000-000000000001';
const proof = { device, deviceToken: 'a'.repeat(64) };
sql(`create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
  nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
insert into auth.users(id) values ('${owner}'),('${staff}');
insert into public.profiles(id,display_name,role) values
  ('${owner}','LOCAL OWNER','owner'),('${staff}','LOCAL STAFF','staff');
grant select on public.day_closings to authenticated;
update public.ucom_cash_book set activation_ready=true where id;`);
const member = statement => sql(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); ${statement}`).split('\n').at(-1);
const payload = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
member(`select public.rpc_cash_execute('${randomUUID()}',null,'open',${payload({ drawer: '1000', pending: '57', ...proof, queueDrained: true, physicallyPaused: true, reason: 'Disposable browser fixture count' })})`);
const status = () => JSON.parse(member('select public.rpc_cash_status()'));
const epoch = status().epoch;
for (const [day, amount] of [['2026-09-30', '1000'], ['2026-10-01', '500']]) {
  const id = randomUUID();
  member(`select public.rpc_cash_execute('${id}','${epoch}','sale',${payload({ ...proof, payload: { client_uuid: id, cash_epoch: epoch, sold_at: `${day}T10:00:00+07:00`, payment_method: 'cash', items: [{ kind: 'service', name: 'LOCAL DAILY SERVICE', qty: 1, unit_price: amount, unit_cost: '0', item_discount: '0' }] } })})`);
}
member(`select public.rpc_cash_pos_ack('${epoch}','${device}','${proof.deviceToken}',${status().version})`);
const result = spawnSync('docker', ['run', '-d', '--name', database.replaceAll('_', '-'), '-p', '127.0.0.1:55442:3000',
  '-e', `PGRST_DB_URI=postgres://postgres@host.docker.internal:55439/${database}`, '-e', 'PGRST_DB_SCHEMAS=public',
  '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_JWT_SECRET=ucom-local-cash-fixture-jwt-secret-20261007-32chars',
  'public.ecr.aws/supabase/postgrest:v16.1'], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Local PostgREST failed');
console.log('Retained local browser fixture:', database, 'REST localhost:55442; run cash-browser-lab.mjs --daily');
