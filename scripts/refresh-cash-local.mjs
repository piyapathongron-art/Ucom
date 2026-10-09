// Refresh function bodies in the disposable HTTP fixture after source changes.
// Never runs against a configurable address or production project.
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
let sql = 'begin; alter table public.ucom_cash_book add column if not exists receiving_paused boolean not null default false; drop function if exists public.rpc_cash_pos_ack(uuid,uuid,text);'; let count = 0;
for (const file of readdirSync('supabase/migrations').filter(file => file.startsWith('20261007')).sort()) {
  const source = readFileSync('supabase/migrations/' + file, 'utf8');
  for (const definition of source.match(/create (?:or replace )?function[\s\S]*?\$\$;/gi) ?? []) {
    sql += '\n' + definition.replace(/^create (?:or replace )?function/i, 'create or replace function'); count++;
  }
  sql += '\n' + (source.match(/(?:revoke|grant)[^;]*on function[^;]*;/gi) ?? []).join('\n');
}
sql += "commit; notify pgrst,'reload schema';";
const result = spawnSync('docker', ['exec', '-i', 'ucom-cash-review-20261007', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'ucom_cash_http_20261008'], { input: sql, encoding: 'utf8' });
if (result.status) { console.error(result.stderr); process.exit(1); }
console.log('Updated ' + count + ' local fixture function definitions.');
