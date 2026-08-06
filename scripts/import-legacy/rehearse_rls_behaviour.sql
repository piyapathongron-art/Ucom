-- Behaviour check: RLS actually hides cost from staff, RPC actually decrements stock,
-- client_uuid replay actually returns the same bill instead of double-charging.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),  -- owner
  ('00000000-0000-0000-0000-000000000002');  -- staff

insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-000000000001', 'Owner', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'Staff', 'staff');

insert into public.products (id, sku, name, cost, price, qty) values
  ('00000000-0000-0000-0000-0000000000a1', 'SKU-1', 'เคสมือถือ', 50, 100, 10);

-- ── as owner: full row visible ──────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select 'owner sees cost?' as check, cost from public.products where sku = 'SKU-1';
reset role;
reset request.jwt.claim.sub;

-- ── as staff: base table must be invisible, catalog view must hide cost ──
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select 'staff base-table row count (expect 0)' as check, count(*)
from public.products;

select 'staff catalog columns (expect no cost column, price 100)' as check, *
from public.v_pos_catalog;

-- staff calls the RPC to sell 3 units
select 'sale id from rpc' as check, public.rpc_create_sale(
  '{"payment_method":"cash","client_uuid":"test-1",
    "items":[{"kind":"product","product_id":"00000000-0000-0000-0000-0000000000a1",
              "qty":3,"unit_price":100}]}'::jsonb
) as sale_id \gset

reset role;
reset request.jwt.claim.sub;

select 'stock after sale (expect 7)' as check, qty from public.products where sku = 'SKU-1';

select 'sale_items cost recorded server-side (expect 50, not client-supplied)' as check,
       unit_cost, unit_price, qty from public.sale_items;

-- replay with the same client_uuid must NOT sell again
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select 'replay returns same sale_id (expect true)' as check,
       public.rpc_create_sale(
         '{"payment_method":"cash","client_uuid":"test-1",
           "items":[{"kind":"product","product_id":"00000000-0000-0000-0000-0000000000a1",
                     "qty":3,"unit_price":100}]}'::jsonb
       ) = :'sale_id' as replay_matches;
reset role;
reset request.jwt.claim.sub;

select 'stock after replay (expect still 7, no double sell)' as check, qty
from public.products where sku = 'SKU-1';

-- overselling must fail cleanly
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select 'oversell attempt' as check;
select public.rpc_create_sale(
  '{"payment_method":"cash",
    "items":[{"kind":"product","product_id":"00000000-0000-0000-0000-0000000000a1",
              "qty":999,"unit_price":100}]}'::jsonb
);
