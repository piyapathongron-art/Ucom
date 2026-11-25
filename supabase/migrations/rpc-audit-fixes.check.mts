import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("./20261125120000_rpc_audit_fixes.sql", import.meta.url), "utf8");

// 1. Abandon passes the repair-collection guard without a cash operation, only while no bill exists.
assert.match(migration, /new\.status='abandoned' and old\.status not in \('collected','abandoned'\)\s+and new\.sale_id is null and old\.sale_id is null/);
assert.match(migration, /raise exception 'ต้องปิดงานซ่อมผ่านรายการรับเงินรุ่นใหม่' using errcode='42501'/, "the original guard stays for everything else");

// 2. Sale date: finite always; staff limited to 48 h back and 5 min ahead; trigger on insert and sold_at updates.
assert.match(migration, /not isfinite\(new\.sold_at\)/);
assert.match(migration, /new\.sold_at > now\(\) \+ interval '5 minutes'/);
assert.match(migration, /new\.sold_at < now\(\) - interval '48 hours'/);
assert.match(migration, /before insert or update of sold_at on public\.sales/);

// 3. NaN refused on every numeric column of every base table, without failing on existing rows.
assert.match(migration, /c\.data_type = 'numeric'/);
assert.match(migration, /t\.table_type = 'BASE TABLE'/);
assert.match(migration, /<> ''NaN''::numeric\) not valid/);

// 4. Repair close: service lines only, checked before the sale is created.
const close = migration.slice(migration.indexOf("create or replace function public.rpc_close_repair_job"));
assert.ok(close.indexOf("<> 'service'") < close.indexOf("public.rpc_create_sale(p_sale_payload)"));

// 5. Product upsert: missing keys keep their value; stale qty refused.
assert.match(migration, /qty = case when payload \? 'qty' then \(payload ->> 'qty'\)::int else qty end/);
assert.match(migration, /price = case when payload \? 'price' then \(payload ->> 'price'\)::numeric else price end/);
assert.match(migration, /payload \? 'expected_qty'\s+and \(payload ->> 'expected_qty'\)::int is distinct from v_current\.qty/);
assert.doesNotMatch(migration, /qty = coalesce\(\(payload ->> 'qty'\)::int, 0\),\s+is_active/);

// Grants on the replaced RPCs; new trigger function private.
for (const fn of ["rpc_close_repair_job(uuid, jsonb)", "rpc_upsert_product(jsonb)"]) {
  assert.ok(migration.includes(`grant execute on function public.${fn} to authenticated;`), fn);
}
assert.match(migration, /revoke all on function public\.pos_guard_sale_sold_at\(\) from public, anon, authenticated;/);
assert.match(migration, /revoke all on function public\.ucom_cash_guard_repair_collection\(\) from public,anon,authenticated;/);

console.log("✓ RPC audit fixes migration contract passed");
