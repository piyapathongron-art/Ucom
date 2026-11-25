-- Migration 20261125150000_sf_dealer_account (ADR 0034).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@test.local'),
  ('00000000-0000-4000-8000-000000000002', 'staff@test.local');
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-4000-8000-000000000001', 'Owner', 'owner'),
  ('00000000-0000-4000-8000-000000000002', 'Staff', 'staff');

-- Two dealer invoices: A (10,000 + 5,000), older and overdue; B (8,000), not yet due.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.rpc_receive_sf_order(jsonb_build_object('order_no', 'SO-A', 'ordered_at', current_date - 20,
  'devices', jsonb_build_array(
    jsonb_build_object('imei', 'A1', 'model_name', 'A55', 'list_price', 10000),
    jsonb_build_object('imei', 'A2', 'model_name', 'A35', 'list_price', 5000))));
select public.rpc_receive_sf_order(jsonb_build_object('order_no', 'SO-B', 'ordered_at', current_date - 10,
  'devices', jsonb_build_array(jsonb_build_object('imei', 'B1', 'model_name', 'A25', 'list_price', 8000))));
reset role;
select set_config('test.order_a', (select id::text from public.sf_orders where order_no = 'SO-A'), true);
select set_config('test.order_b', (select id::text from public.sf_orders where order_no = 'SO-B'), true);
select set_config('test.a1', (select id::text from public.device_units where imei = 'A1'), true);
select set_config('test.a2', (select id::text from public.device_units where imei = 'A2'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.rpc_set_sf_order_due_date(current_setting('test.order_a')::uuid, current_date - 8);
select public.rpc_set_sf_order_due_date(current_setting('test.order_b')::uuid, current_date + 2);

select is((select balance from public.v_sf_dealer_summary), 23000.00, 'two invoices owe 23,000');
select is((select days_overdue from public.v_sf_dealer_invoices where order_no = 'SO-A'), 8, 'invoice A is 8 days overdue');

-- Financing A1 credits its tag price; FIFO applies it to invoice A first.
select public.rpc_finance_device(current_setting('test.a1')::uuid);
select is((select balance from public.v_sf_dealer_summary), 13000.00, 'financing a phone lowers the debt by its tag price');
select is((select open_amount from public.v_sf_dealer_invoices where order_no = 'SO-A'), 5000.00, 'the credit is applied to the oldest invoice');

-- A cash sale fixes the phone's cost but leaves the debt until it is paid.
select public.rpc_create_sale(jsonb_build_object('payment_method', 'cash',
  'items', jsonb_build_array(jsonb_build_object('kind', 'device', 'device_unit_id', current_setting('test.a2'), 'unit_price', 6500))));
select is((select balance from public.v_sf_dealer_summary), 13000.00, 'a cash sale does not clear the debt');
select is((select amount_due from public.v_sf_due where order_no = 'SO-A'), 5000.00::numeric, 'v_sf_due shows the open amount of the cash-sold phone');

-- A 6,000 transfer covers invoice A and 1,000 of B.
select set_config('test.payment', public.rpc_sf_dealer_record('payment', current_date, 6000, null, 'KTB 0001', null)::text, true);
select is((select balance from public.v_sf_dealer_summary), 7000.00, 'a payment lowers the debt');
select is((select open_amount from public.v_sf_dealer_invoices where order_no = 'SO-A'), 0.00, 'invoice A is settled');
select is((select open_amount from public.v_sf_dealer_invoices where order_no = 'SO-B'), 7000.00, 'the rest goes to invoice B');
select is((select overdue_amount from public.v_sf_dealer_summary), 0.00, 'nothing overdue once A is settled');
select is((select method from public.sf_dealer_entries where id = current_setting('test.payment')::uuid), 'transfer', 'payments are transfers');

-- Void restores the balance; an adjustment needs a reason.
select public.rpc_sf_dealer_void(current_setting('test.payment')::uuid, 'บันทึกผิดยอด');
select is((select balance from public.v_sf_dealer_summary), 13000.00, 'voiding the payment restores the balance');
select throws_ok($$ select public.rpc_sf_dealer_record('adjustment', current_date, -500, null, null, '') $$,
  'P0001', null, 'an adjustment without a reason is refused');
select lives_ok($$ select public.rpc_sf_dealer_record('adjustment', current_date, -500, null, null, 'ยอดตั้งต้นตาม statement') $$,
  'an adjustment with a reason is accepted');
reset role;

-- The ledger cannot be edited, only voided.
select throws_ok($$ update public.sf_dealer_entries set amount = 1 where kind = 'adjustment' $$,
  'P0001', null, 'ledger rows cannot be edited');

-- Staff: no access to the account.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.rpc_sf_dealer_record('payment', current_date, 100, null, null, null) $$,
  '42501', null, 'staff cannot record dealer entries');
select is((select count(*) from public.v_sf_dealer_ledger)::int, 0, 'staff see no ledger rows');
reset role;

select * from finish();
rollback;
