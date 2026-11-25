-- Migration 20261125090000_sf_consign_device_guards (PR #6).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000002', 'staff@test.local');
insert into public.profiles (id, display_name, role) values ('00000000-0000-4000-8000-000000000002', 'Staff', 'staff');

-- Fixtures written as the migration owner, bypassing RPCs.
insert into public.device_units (id, imei, model_name, acquisition, status, list_price, cost) values
  ('00000000-0000-4000-8000-0000000000d1', 'IMEI-SOLD', 'Sold phone', 'purchased', 'sold', 9000, 7000),
  ('00000000-0000-4000-8000-0000000000d2', 'IMEI-STOCK', 'Stock phone', 'purchased', 'in_stock', 9000, 7000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- 0.1 rpc_upsert_device
select throws_ok(
  $$ select public.rpc_upsert_device('{"id":"00000000-0000-4000-8000-0000000000d1","imei":"IMEI-SOLD","model_name":"Sold phone","status":"in_stock"}') $$,
  'P0001', null, 'a sold device cannot be edited back into stock');
select throws_ok(
  $$ select public.rpc_upsert_device('{"id":"00000000-0000-4000-8000-0000000000d2","imei":"IMEI-STOCK","model_name":"Stock phone","status":"sold"}') $$,
  'P0001', null, 'an in-stock device cannot be marked sold from stock');
select lives_ok(
  $$ select public.rpc_upsert_device('{"id":"00000000-0000-4000-8000-0000000000d2","imei":"IMEI-STOCK","model_name":"Stock phone","status":"written_off"}') $$,
  'in stock → written off is allowed');
select throws_ok(
  $$ select public.rpc_upsert_device('{"imei":"IMEI-NEW-SF","model_name":"M","acquisition":"sf_credit","list_price":100}') $$,
  'P0001', null, 'stock page cannot insert an SF device');
select lives_ok(
  $$ select public.rpc_upsert_device('{"imei":"IMEI-NEW","model_name":"M","list_price":100,"cost":80}') $$,
  'stock page can insert a purchased device');

-- 0.3 SF prices
select throws_ok(
  $$ select public.rpc_receive_sf_order('{"order_no":"SF-0","devices":[{"imei":"SF-A","model_name":"A55","list_price":0}]}') $$,
  'P0001', null, 'SF tag price 0 is refused');
select throws_ok(
  $$ select public.rpc_receive_sf_order('{"order_no":"SF-0","devices":[{"imei":"SF-A","model_name":"A55","list_price":"13,990"}]}') $$,
  'P0001', null, 'an unreadable SF tag price is refused');
select lives_ok(
  $$ select public.rpc_receive_sf_order('{"order_no":"SF-1","devices":[{"imei":"SF-A","model_name":"A55","list_price":13990}]}') $$,
  'a valid SF bill is received');

-- Base tables are owner-only, so ids are read as the test owner and passed in.
reset role;
select set_config('test.sf_device', (select id::text from public.device_units where imei = 'SF-A'), true);
select set_config('test.sf_order', (select id::text from public.sf_orders where order_no = 'SF-1'), true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

-- 0.2 no cost on an unpaid SF device
select throws_ok(
  format($$ select public.rpc_set_stock_cost('device', %L, 0) $$, current_setting('test.sf_device')),
  'P0001', null, 'cost cannot be set on an unpaid SF device');

-- 0.4 rpc_update_sf_order adds a row that has no id
select lives_ok(
  format($$ select public.rpc_update_sf_order(%L::jsonb) $$, jsonb_build_object(
    'id', current_setting('test.sf_order'),
    'order_no', 'SF-1',
    'devices', jsonb_build_array(
      jsonb_build_object('id', current_setting('test.sf_device'), 'imei', 'SF-A', 'model_name', 'A55', 'list_price', 13990),
      jsonb_build_object('id', '', 'imei', 'SF-B', 'model_name', 'A35', 'list_price', 9990))
  )::text),
  'editing an SF bill can add a device');
reset role;

select is((select count(*) from public.device_units where sf_order_id = (select id from public.sf_orders where order_no = 'SF-1'))::int, 2,
  'the new device belongs to the bill');

select * from finish();
rollback;
