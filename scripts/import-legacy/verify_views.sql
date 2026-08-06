-- ponytail: whole file runs in one transaction that always rolls back — the fake
-- owner below is only here to satisfy the RLS gate on the views. Without the
-- rollback this leaves a role='owner' profile behind on whatever DB it is run
-- against (it did, once, on prod). Every statement below is read-only anyway.
begin;

insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into public.profiles (id, display_name, role) values
  ('00000000-0000-0000-0000-000000000001','Owner','owner') on conflict do nothing;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select 'v_sale_profit total (expect net_revenue 1454600)' as section;
select sum(net_revenue) as net_revenue, sum(profit) as profit, count(*) as bills
from public.v_sale_profit;

select 'v_monthly_report first 4 months' as section;
select month, sale_revenue, sale_profit, sf_commission, expense, net_profit
from public.v_monthly_report order by month limit 4;

select 'monthly sale_revenue must sum to 1454600' as section;
select sum(sale_revenue) as total_sale_revenue, sum(expense) as total_expense
from public.v_monthly_report;

select 'v_topup_wallet_balance' as section;
select name, commission_rate, topped_up, spent, balance
from public.v_topup_wallet_balance order by name;

rollback;
