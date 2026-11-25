import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("./20261125090000_sf_consign_device_guards.sql", import.meta.url),
  "utf8",
);

// 0.1: rpc_upsert_device cannot move a device out of / into sale, finance or consignment.
assert.match(migration, /if v_current\.status not in \('in_stock', 'written_off'\)/);
assert.match(migration, /if v_status is not null and v_status not in \('in_stock', 'written_off'\)/);
assert.match(migration, /if v_acquisition <> 'purchased' then/);
assert.match(migration, /for update;/);
assert.doesNotMatch(migration, /status\s+= coalesce\(nullif\(payload ->> 'status', ''\), status\)/);

// 0.2: no cost on an unpaid SF device, whichever RPC writes it; the cash sale stamps sf_paid_full_at.
assert.match(migration, /new\.acquisition = 'sf_credit'\s+and new\.sf_paid_full_at is null\s+and new\.cost is not null/);
assert.match(migration, /before insert or update of cost, sf_paid_full_at on public\.device_units/);

// 0.3: SF tag price > 0 and shop price empty or > 0, checked on receive and on edit.
assert.match(migration, /if v_list is null or v_list <= 0 then/);
assert.match(migration, /if v_sale is not null and v_sale <= 0 then/);
assert.equal(migration.match(/perform public\.pos_sf_device_row_valid\(v_device\)/g)?.length, 2);

// 0.4: rows with no id are inserted into the bill instead of failing the uuid cast.
assert.match(migration, /v_device_id := nullif\(v_device ->> 'id', ''\)::uuid;/);
assert.match(migration, /if v_device_id is null then\s+insert into public\.device_units/);

// Every replaced RPC keeps its grants; helpers stay private.
for (const fn of ["rpc_upsert_device(jsonb)", "rpc_receive_sf_order(jsonb)", "rpc_update_sf_order(jsonb)"]) {
  assert.ok(migration.includes(`grant execute on function public.${fn} to authenticated;`), fn);
}
assert.match(migration, /revoke all on function public\.pos_guard_sf_unpaid_cost\(\) from public, anon, authenticated;/);
assert.match(migration, /revoke all on function public\.pos_sf_device_row_valid\(jsonb\) from public, anon, authenticated;/);

console.log("✓ SF/consignment device guard migration contract passed");
