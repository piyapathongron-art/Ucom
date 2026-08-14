-- One row per money event, so the report screen can drill from a day down to the
-- individual bills/jobs/devices/expenses that add up to it. v_daily_report keeps its
-- exact column list but now sums this view instead of repeating the pipe definitions:
-- a drill-down that disagrees with its own summary row is the failure this prevents.
create or replace view public.v_report_entries
with (security_invoker = false) as
with pipe as (
  -- pipe 1: sale bills. A bill that belongs to a repair job is that job's revenue,
  -- never a sale (same exclusion the report has always used).
  select
    (sp.sold_at at time zone 'Asia/Bangkok')::date as day,
    sp.sold_at                                     as occurred_at,
    'sale'::text                                   as kind,
    sp.sale_id                                     as ref_id,
    'บิลขาย'::text                                  as label,
    sp.payment_method                              as detail,
    sp.net_revenue                                 as sale_revenue,
    sp.profit                                      as sale_profit,
    0::numeric                                     as repair_revenue,
    0::numeric                                     as repair_profit,
    0::numeric                                     as sf_commission,
    0::numeric                                     as expense
  from public.v_sale_profit sp
  where not exists (
    select 1 from public.repair_jobs r where r.sale_id = sp.sale_id
  )

  union all

  -- pipe 2: repair jobs, counted on the day they closed. An abandoned job brings only
  -- its part cost (ADR 0011); a collected job bills through its sale when it has one.
  select
    (r.closed_at at time zone 'Asia/Bangkok')::date,
    r.closed_at,
    'repair'::text,
    r.id,
    r.customer_name,
    r.device_desc,
    0::numeric,
    0::numeric,
    case when r.status = 'collected'
         then coalesce(sp.net_revenue, r.quoted_price, 0::numeric)
         else 0::numeric end,
    case when r.status = 'collected'
         then coalesce(sp.net_revenue, r.quoted_price, 0::numeric)
         else 0::numeric end - coalesce(r.part_cost, 0::numeric),
    0::numeric,
    0::numeric
  from public.repair_jobs r
  left join public.v_sale_profit sp on sp.sale_id = r.sale_id
  where r.closed_at is not null
    and (r.status = 'collected' or (r.status = 'abandoned' and r.part_cost is not null))

  union all

  -- pipe 3: SF+ financing. The device price is never shop revenue (ADR 0002) — only
  -- the commission is.
  select
    (d.financed_at at time zone 'Asia/Bangkok')::date,
    d.financed_at,
    'sf'::text,
    d.id,
    'ผ่อน SF'::text,
    d.imei,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    d.commission,
    0::numeric
  from public.device_units d
  where d.status = 'financed' and d.financed_at is not null

  union all

  -- pipe 4: shop expenses, on the day they were spent.
  select
    e.spent_at,
    e.created_at,
    'expense'::text,
    e.id,
    e.name,
    e.category,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    0::numeric,
    e.amount
  from public.expenses e
)
select * from pipe where public.pos_is_owner();

-- Same columns, same numbers, one less copy of the rules.
create or replace view public.v_daily_report
with (security_invoker = false) as
select
  day,
  sum(sale_revenue)    as sale_revenue,
  sum(sale_profit)     as sale_profit,
  sum(repair_revenue)  as repair_revenue,
  sum(repair_profit)   as repair_profit,
  sum(sf_commission)   as sf_commission,
  sum(expense)         as expense,
  sum(sale_profit) + sum(repair_profit) + sum(sf_commission) - sum(expense) as net_profit
from public.v_report_entries
group by day
order by day desc;

-- Read-only, owners only: the gate is pos_is_owner() inside the view, the grant just
-- keeps anon and write privileges off it.
revoke all on public.v_report_entries from anon, authenticated;
grant select on public.v_report_entries to authenticated;
