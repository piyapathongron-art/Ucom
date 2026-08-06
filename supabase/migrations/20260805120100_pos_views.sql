-- Ucom POS — read views
--
-- Every view here is deliberately `security_invoker = false` (the Postgres default,
-- spelled out because it is load-bearing): the view runs with its owner's rights and
-- therefore bypasses RLS on the base tables. That is precisely how staff reads the
-- catalogue without holding a single grant on `products` or `device_units`.
--
-- Because RLS is bypassed, EACH VIEW MUST GATE ITSELF. `authenticated` is not a
-- sufficient check — `auth.users` is shared with DailyGold (ADR 0008), so a DailyGold
-- user holds a valid session here. The gate is pos_is_member()/pos_is_owner().
-- A view added later without one of those predicates leaks the shop's costs.

-- ─────────────────────────────────────────────────────────────
-- v_pos_catalog — what staff may see at the counter. No cost column, by design.
-- ─────────────────────────────────────────────────────────────
create view public.v_pos_catalog with (security_invoker = false) as
select
  'product'::text as kind,
  p.id,
  p.name,
  p.sku        as code,
  p.price,
  p.qty,
  c.name       as category_name
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active
  and public.pos_is_member()

union all

select
  'device'::text,
  d.id,
  d.model_name,
  d.imei,
  d.list_price,
  1,
  null
from public.device_units d
where d.status = 'in_stock'
  and public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_sale_profit — profit per bill = Σ lines − bill discount
-- ─────────────────────────────────────────────────────────────
create view public.v_sale_profit with (security_invoker = false) as
select
  s.id                as sale_id,
  s.sold_at,
  s.payment_method,
  s.receiving_account,
  s.is_imported,
  coalesce(li.gross, 0)          as gross,
  coalesce(li.item_discount, 0)  as item_discount,
  s.bill_discount,
  coalesce(li.gross, 0) - coalesce(li.item_discount, 0) - s.bill_discount
                                 as net_revenue,
  coalesce(li.cost, 0)           as total_cost,
  coalesce(li.gross, 0) - coalesce(li.item_discount, 0) - s.bill_discount
                                 - coalesce(li.cost, 0) as profit
from public.sales s
left join lateral (
  select
    sum(i.unit_price * i.qty) as gross,
    sum(i.item_discount)      as item_discount,
    sum(i.unit_cost * i.qty)  as cost
  from public.sale_items i
  where i.sale_id = s.id
) li on true
where public.pos_is_owner();

-- ─────────────────────────────────────────────────────────────
-- v_monthly_report — three pipes, then expenses subtracted
--
-- Months bucket in Asia/Bangkok, not UTC. A bill rung up at 23:30 on the last day of
-- the month is still that month's revenue for the shop owner; grouping the raw
-- timestamptz would push it into the next month.
-- ─────────────────────────────────────────────────────────────
create view public.v_monthly_report with (security_invoker = false) as
with pipe as (
  -- 1) counter sales. Bills that close a repair job are excluded here — pipe 2 owns
  --    them, and counting both would double the revenue.
  select
    date_trunc('month', sp.sold_at at time zone 'Asia/Bangkok')::date as month,
    sp.net_revenue     as sale_revenue,
    sp.profit          as sale_profit,
    0::numeric         as repair_revenue,
    0::numeric         as repair_profit,
    0::numeric         as sf_commission,
    0::numeric         as expense
  from public.v_sale_profit sp
  where not exists (
    select 1 from public.repair_jobs r where r.sale_id = sp.sale_id
  )

  union all

  -- 2) repair jobs. The part cost belongs to the job, never to expenses (ADR 0003),
  --    and the month is the month the customer collected — not intake.
  select
    date_trunc('month', r.closed_at at time zone 'Asia/Bangkok')::date,
    0, 0,
    coalesce(sp.net_revenue, r.quoted_price, 0),
    coalesce(sp.net_revenue, r.quoted_price, 0) - coalesce(r.part_cost, 0),
    0, 0
  from public.repair_jobs r
  left join public.v_sale_profit sp on sp.sale_id = r.sale_id
  where r.status = 'collected'
    and r.closed_at is not null

  union all

  -- 3) SF+ commission. The device never produces a sales bill (ADR 0002); the
  --    commission is the only money that reaches the shop.
  select
    date_trunc('month', d.financed_at at time zone 'Asia/Bangkok')::date,
    0, 0, 0, 0,
    d.commission,
    0
  from public.device_units d
  where d.status = 'financed'
    and d.financed_at is not null

  union all

  -- 4) shop expenses. Repair parts are NOT here.
  select
    date_trunc('month', e.spent_at)::date,
    0, 0, 0, 0, 0,
    e.amount
  from public.expenses e
)
select
  month,
  sum(sale_revenue)   as sale_revenue,
  sum(sale_profit)    as sale_profit,
  sum(repair_revenue) as repair_revenue,
  sum(repair_profit)  as repair_profit,
  sum(sf_commission)  as sf_commission,
  sum(expense)        as expense,
  sum(sale_profit) + sum(repair_profit) + sum(sf_commission) - sum(expense)
                      as net_profit
from pipe
-- the gate for pipes 3 and 4, which read their base tables directly rather than
-- through the already-gated v_sale_profit. Removing this exposes commissions
-- and expenses to every authenticated user in the project.
where public.pos_is_owner()
group by month
order by month desc;

-- ─────────────────────────────────────────────────────────────
-- v_topup_wallet_balance — topped up minus the cost of what has been sold
-- ─────────────────────────────────────────────────────────────
create view public.v_topup_wallet_balance with (security_invoker = false) as
select
  c.id   as carrier_id,
  c.name,
  c.commission_rate,
  coalesce(t.topped_up, 0) as topped_up,
  coalesce(u.spent, 0)     as spent,
  coalesce(t.topped_up, 0) - coalesce(u.spent, 0) as balance
from public.topup_carriers c
left join lateral (
  select sum(e.amount) as topped_up
  from public.topup_wallet_entries e
  where e.carrier_id = c.id
) t on true
left join lateral (
  select sum(i.unit_cost * i.qty) as spent
  from public.sale_items i
  where i.topup_carrier_id = c.id
) u on true
where public.pos_is_owner();

-- ─────────────────────────────────────────────────────────────
-- v_sf_due — SF order lines coming due, and what is still owed on them
-- ─────────────────────────────────────────────────────────────
create view public.v_sf_due with (security_invoker = false) as
select
  o.id       as sf_order_id,
  o.order_no,
  o.ordered_at,
  o.due_date,
  o.due_date - current_date as days_left,
  count(d.id)                                        as device_count,
  count(d.id) filter (where d.status = 'financed')   as financed_count,
  count(d.id) filter (where d.status = 'in_stock')   as unfinanced_count,
  -- ponytail: amount owed is valued at list_price when cost is still unknown —
  -- all 21 SF rows in the source file matched the device price exactly and none
  -- matched cost. Swap to a real per-order invoice amount if SF ever sends one.
  sum(coalesce(d.cost, d.list_price))
    filter (where d.status <> 'financed' and d.sf_paid_full_at is null)
                                                     as amount_due
from public.sf_orders o
left join public.device_units d on d.sf_order_id = o.id
where public.pos_is_owner()
group by o.id, o.order_no, o.ordered_at, o.due_date
order by o.due_date nulls last;

-- ─────────────────────────────────────────────────────────────
-- grants — named one by one; `public` is shared with DailyGold (ADR 0008)
-- ─────────────────────────────────────────────────────────────
revoke all on public.v_pos_catalog          from anon;
revoke all on public.v_sale_profit          from anon;
revoke all on public.v_monthly_report       from anon;
revoke all on public.v_topup_wallet_balance from anon;
revoke all on public.v_sf_due               from anon;

grant select on public.v_pos_catalog          to authenticated;
grant select on public.v_sale_profit          to authenticated;
grant select on public.v_monthly_report       to authenticated;
grant select on public.v_topup_wallet_balance to authenticated;
grant select on public.v_sf_due               to authenticated;
