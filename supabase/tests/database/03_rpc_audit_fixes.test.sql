-- Migration 20261125120000_rpc_audit_fixes (PR #7).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000002', 'staff@test.local');
insert into public.profiles (id, display_name, role) values ('00000000-0000-4000-8000-000000000002', 'Staff', 'staff');
insert into public.products (id, name, price, qty, cost) values
  ('00000000-0000-4000-8000-0000000000a1', 'Film', 190, 5, 40);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- 2. sale date window (cash book closed, so legacy RPCs are allowed)
select throws_ok(
  $$ select public.rpc_create_sale('{"payment_method":"cash","sold_at":"2020-01-01T10:00:00+07","items":[{"kind":"product","product_id":"00000000-0000-4000-8000-0000000000a1","qty":1,"unit_price":190}]}') $$,
  'P0001', null, 'staff cannot back-date a sale beyond 48 hours');
select throws_ok(
  $$ select public.rpc_create_sale('{"payment_method":"cash","sold_at":"infinity","items":[{"kind":"product","product_id":"00000000-0000-4000-8000-0000000000a1","qty":1,"unit_price":190}]}') $$,
  'P0001', null, 'an infinite sale date is refused');
select lives_ok(
  $$ select public.rpc_create_sale('{"payment_method":"cash","items":[{"kind":"product","product_id":"00000000-0000-4000-8000-0000000000a1","qty":1,"unit_price":190}]}') $$,
  'a sale dated now goes through');

-- 3. NaN
select throws_ok(
  $$ select public.rpc_set_stock_cost('product', '00000000-0000-4000-8000-0000000000a1', 'NaN') $$,
  '23514', null, 'NaN cost is refused by the check constraint');

-- 5. product upsert
select lives_ok(
  $$ select public.rpc_upsert_product('{"id":"00000000-0000-4000-8000-0000000000a1","name":"Film 2"}') $$,
  'an edit without price or qty is accepted');
select throws_ok(
  $$ select public.rpc_upsert_product('{"id":"00000000-0000-4000-8000-0000000000a1","name":"Film 2","qty":9,"expected_qty":5}') $$,
  'P0001', null, 'a qty save from a stale form is refused');

-- 4. repair close: service lines only
select throws_ok(
  format($$ select public.rpc_close_repair_job(%L, %L::jsonb) $$,
    public.rpc_create_repair_job('{"customer_name":"A","device_desc":"Phone","quoted_price":500}'),
    '{"payment_method":"cash","items":[{"kind":"product","product_id":"00000000-0000-4000-8000-0000000000a1","qty":1,"unit_price":190}]}'),
  'P0001', null, 'a repair bill cannot carry a product line');
reset role;

select is((select (price, qty)::text from public.products where id = '00000000-0000-4000-8000-0000000000a1'), '(190.00,4)',
  'omitted price and qty kept their values (qty 4 after the one sale)');

-- 1. abandon with the cash book open (job id read as the test owner, before switching role)
select set_config('test.job_id', (select id::text from public.repair_jobs where customer_name = 'A' limit 1), true);
update public.ucom_cash_book set epoch = gen_random_uuid(), opened_at = now();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok(
  format($$ select public.rpc_set_repair_status(%L, 'abandoned') $$, current_setting('test.job_id')),
  'a repair job can be abandoned while the cash book is open');
reset role;

select * from finish();
rollback;
