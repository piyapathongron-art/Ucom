import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
const container = 'ucom-cash-review-20261007';
const database = 'ucom_cash_race_' + Date.now();
const args = db => ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-U', 'postgres', '-d', db];
const run = (sql, db = database) => {
  const result = spawnSync('docker', args(db), { input: sql, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
};
run(`create database ${database} template ucom_cash_check;`, 'postgres');
for (const file of readdirSync('supabase/migrations').filter(file => file.startsWith('20261007')).sort()) {
  run(readFileSync('supabase/migrations/' + file, 'utf8'));
}
const member = `set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);`;
run(`insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');
  insert into public.profiles(id,display_name,role) values('00000000-0000-4000-8000-000000000001','LOCAL OWNER','owner');
  update public.ucom_cash_book set activation_ready=true where id;
  ${member}
  select public.rpc_cash_execute(gen_random_uuid(),null,'open',jsonb_build_object('drawer','0','pending','100',
    'device','20000000-0000-4000-8000-000000000001','deviceToken',repeat('a',64),
    'queueDrained',true,'physicallyPaused',true,'reason','Local concurrency fixture'));`);
const payment = `select public.rpc_cash_execute(gen_random_uuid(),(public.rpc_cash_status()->>'epoch')::uuid,
  'expense','{"name":"LOCAL concurrent payment","amount":"80","fund":"pending"}');`;
let release;
const locked = new Promise(resolve => { release = resolve; });
function session(sql, signal = false) {
  return new Promise(resolve => {
    const child = spawn('docker', args(database)); let output = ''; let error = '';
    child.stdout.on('data', data => { output += data; if (signal && output.includes('LOCKED')) release(); });
    child.stderr.on('data', data => { error += data; });
    child.on('close', status => resolve({ status, output, error })); child.stdin.end(sql);
  });
}
const first = session(`begin; ${member} ${payment} select 'LOCKED'; select pg_sleep(1.5); commit;`, true);
await locked;
const second = session(`${member} ${payment}`);
const [a, b] = await Promise.all([first, second]);
assert.equal(a.status, 0, a.error);
assert.notEqual(b.status, 0, 'concurrent second payment must fail');
assert.match(b.error, /เงินที่ใช้ได้ในกองนี้ไม่พอ/);
assert.equal(run("select coalesce(sum(amount),0)=20 from public.ucom_cash_movements where fund='pending';").trim(), 't');
assert.equal(run("select count(*) from public.expenses where name='LOCAL concurrent payment';").trim(), '1');
console.log('Concurrent real PostgreSQL payments: one committed, one rejected, pending=20; database=' + database);
