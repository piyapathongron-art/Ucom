import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("./20260922130451_staff_stock_cost_access.sql", import.meta.url),
  "utf8",
);

assert.match(migration, /if not public\.pos_is_member\(\)/);
assert.match(migration, /and status = 'in_stock'/);
assert.match(migration, /new\.updated_by := auth\.uid\(\)/);
assert.match(migration, /revoke all on function public\.rpc_set_stock_cost/);
assert.match(migration, /null::uuid\s+as sf_order_id,\s+p\.cost/);
assert.match(migration, /d\.sf_order_id,\s+d\.cost/);
assert.doesNotMatch(migration, /profit/i);

console.log("✓ staff stock cost migration contract passed");
