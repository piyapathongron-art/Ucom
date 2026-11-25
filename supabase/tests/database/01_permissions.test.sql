-- Baseline permissions: anon reaches nothing; staff cannot write core tables directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'owner@test.local'),
  ('00000000-0000-4000-8000-000000000002', 'staff@test.local');
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-4000-8000-000000000001', 'Owner', 'owner'),
  ('00000000-0000-4000-8000-000000000002', 'Staff', 'staff');
insert into public.products (id, name, price, qty, cost) values
  ('00000000-0000-4000-8000-0000000000a1', 'Film', 190, 5, 40);

-- anon
set local role anon;
select throws_ok($$ select public.rpc_create_sale('{}'::jsonb) $$, '42501', null, 'anon cannot call rpc_create_sale');
select throws_ok($$ select * from public.products $$, '42501', null, 'anon cannot read products');
reset role;

-- staff: whether a direct write errors or silently matches no row, nothing may change
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(public.pos_is_member() and not public.pos_is_owner(), 'staff session is a member, not the owner');
do $$ begin
  insert into public.device_units (imei, model_name, acquisition, status, list_price) values ('X1', 'M', 'purchased', 'in_stock', 100);
exception when others then null; end $$;
do $$ begin
  update public.products set price = 1;
exception when others then null; end $$;
do $$ begin
  update public.profiles set role = 'owner' where id = '00000000-0000-4000-8000-000000000002';
exception when others then null; end $$;
reset role;

select is((select count(*) from public.device_units where imei = 'X1')::int, 0, 'staff cannot insert device_units directly');
select is((select price from public.products where id = '00000000-0000-4000-8000-0000000000a1'), 190::numeric, 'staff cannot update products directly');
select is((select role from public.profiles where id = '00000000-0000-4000-8000-000000000002'), 'staff', 'staff cannot promote themselves');

select * from finish();
rollback;
