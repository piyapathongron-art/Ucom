-- The report page needs an arbitrary date range and day/month/year quick actions, but
-- every pipe was bucketed to the month, so nothing finer than a month existed to read.
-- All four pipes carry a real timestamp already, so the day bucket is pure derivation:
-- no table changes, no new money rules.
--
-- v_daily_report becomes the single source of truth and v_monthly_report is redefined
-- as an aggregate over it. The pipes were duplicated across two views in the first
-- draft of this change; the money rules here have moved three times (ADR 0003, 0010,
-- 0011) and two copies means the next move silently disagrees between two screens.
--
-- The pipes below are byte-for-byte the ones from
-- 20260810120000_abandoned_repair_parts_hit_repair_profit.sql, with
-- `date_trunc('month', X)::date` replaced by `X::date`.

-- ─────────────────────────────────────────────────────────────
-- 1) v_daily_report — the pipes, one row per day.
-- ─────────────────────────────────────────────────────────────
drop view if exists public.v_monthly_report;
drop view if exists public.v_daily_report;

create view public.v_daily_report with (security_invoker = false) as
with pipe as (
  -- 1) counter sales. Bills that close a repair job are excluded here — pipe 2 owns
  --    them, and counting both would double the revenue.
  select
    (sp.sold_at at time zone 'Asia/Bangkok')::date as day,
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
  --    and the day is the day the job closed — not intake.
  --
  --    An abandoned job closes here too, earning nothing: the part was already paid
  --    for, so the day it was written off carries that loss as a negative
  --    repair_profit (ADR 0011). A job abandoned before any part was bought has no
  --    money attached to it and stays out rather than opening an empty day.
  select
    (r.closed_at at time zone 'Asia/Bangkok')::date,
    0, 0,
    case when r.status = 'collected'
         then coalesce(sp.net_revenue, r.quoted_price, 0)
         else 0 end,
    case when r.status = 'collected'
         then coalesce(sp.net_revenue, r.quoted_price, 0)
         else 0 end - coalesce(r.part_cost, 0),
    0, 0
  from public.repair_jobs r
  left join public.v_sale_profit sp on sp.sale_id = r.sale_id
  where r.closed_at is not null
    and (r.status = 'collected'
         or (r.status = 'abandoned' and r.part_cost is not null))

  union all

  -- 3) SF+ commission. The device never produces a sales bill (ADR 0002); the
  --    commission is the only money that reaches the shop.
  select
    (d.financed_at at time zone 'Asia/Bangkok')::date,
    0, 0, 0, 0,
    d.commission,
    0
  from public.device_units d
  where d.status = 'financed'
    and d.financed_at is not null

  union all

  -- 4) shop expenses. Repair parts are NOT here. spent_at is already a date.
  select
    e.spent_at,
    0, 0, 0, 0, 0,
    e.amount
  from public.expenses e
)
select
  day,
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
-- and expenses to every authenticated user in the project. v_monthly_report below
-- inherits this gate rather than repeating it.
where public.pos_is_owner()
group by day
order by day desc;

-- ─────────────────────────────────────────────────────────────
-- 2) v_monthly_report — same eight columns as before, now derived. net_profit sums
--    cleanly because it is a linear combination of the columns beside it.
-- ─────────────────────────────────────────────────────────────
create view public.v_monthly_report with (security_invoker = false) as
select
  date_trunc('month', day)::date as month,
  sum(sale_revenue)   as sale_revenue,
  sum(sale_profit)    as sale_profit,
  sum(repair_revenue) as repair_revenue,
  sum(repair_profit)  as repair_profit,
  sum(sf_commission)  as sf_commission,
  sum(expense)        as expense,
  sum(net_profit)     as net_profit
from public.v_daily_report
group by 1
order by 1 desc;

-- `authenticated` is revoked alongside `anon`: Supabase's default privileges on
-- `public` hand it write access, and creating a view picks those defaults up.
revoke all on public.v_daily_report from anon, authenticated;
grant select on public.v_daily_report to authenticated;

revoke all on public.v_monthly_report from anon, authenticated;
grant select on public.v_monthly_report to authenticated;
