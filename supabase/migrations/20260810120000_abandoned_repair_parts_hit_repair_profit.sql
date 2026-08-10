-- Phase 6 follow-up — the part cost of a job the customer walked away from (ADR 0011)
--
-- v_monthly_report pipe 2 only ever saw `collected` jobs, so an abandoned job took its
-- already-paid part cost out of the report entirely and the shop's profit read high
-- forever after. ADR 0003 says that money becomes the shop's loss on the day the job is
-- written off; ADR 0011 lands it in repair_profit rather than expense, because a repair
-- job owns its cost and the expenses pipe belongs to the expenses table.

-- ─────────────────────────────────────────────────────────────
-- 1) abandoning a job now stamps closed_at — the same column collecting uses.
--    Without it pipe 2 has no month to bucket the loss into.
--
--    The status guard above makes this a one-way trip: a job cannot leave 'abandoned',
--    so closed_at is always null when we get here.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_set_repair_status(uuid, text);

create function public.rpc_set_repair_status(p_job_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_steps   text[] := array['pending', 'in_progress', 'ready'];
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  select r.status into v_current
  from public.repair_jobs r
  where r.id = p_job_id
  for update;

  if not found then
    raise exception 'ไม่พบงานซ่อม' using errcode = 'P0001';
  end if;

  if v_current = p_status then
    return;
  end if;

  -- terminal states. Undoing an abandon is rare enough to stay the owner's job,
  -- against the table directly.
  if v_current in ('collected', 'abandoned') then
    raise exception 'งานนี้ปิดไปแล้ว เปลี่ยนสถานะไม่ได้' using errcode = 'P0001';
  end if;

  if p_status <> 'abandoned' and p_status <> all (v_steps) then
    raise exception 'สถานะไม่ถูกต้อง' using errcode = 'P0001';
  end if;

  -- abandon is reachable from any open state; everything else moves exactly one step
  if p_status <> 'abandoned'
     and abs(array_position(v_steps, p_status) - array_position(v_steps, v_current)) <> 1 then
    raise exception 'ข้ามขั้นตอนไม่ได้ — เดินได้ทีละขั้น' using errcode = 'P0001';
  end if;

  update public.repair_jobs r
     set status    = p_status,
         closed_at = case when p_status = 'abandoned' then now() else r.closed_at end
   where r.id = p_job_id;
end;
$$;

revoke all on function public.rpc_set_repair_status(uuid, text) from public, anon;
grant execute on function public.rpc_set_repair_status(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) jobs abandoned before the stamp existed. part_paid_at is the closest thing to a
--    write-off date they have; received_at covers the ones that never bought a part.
-- ─────────────────────────────────────────────────────────────
update public.repair_jobs
   set closed_at = coalesce(part_paid_at, received_at)
 where status = 'abandoned'
   and closed_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3) v_monthly_report — pipe 2 widened to carry the write-off. Everything else is
--    byte-for-byte the phase 1 view.
-- ─────────────────────────────────────────────────────────────
drop view if exists public.v_monthly_report;

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
  --    and the month is the month the job closed — not intake.
  --
  --    An abandoned job closes here too, earning nothing: the part was already paid
  --    for, so the month it was written off carries that loss as a negative
  --    repair_profit (ADR 0011). A job abandoned before any part was bought has no
  --    money attached to it and stays out rather than opening an empty month.
  select
    date_trunc('month', r.closed_at at time zone 'Asia/Bangkok')::date,
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

-- `authenticated` is revoked alongside `anon`: Supabase's default privileges on
-- `public` hand it write access, and dropping the view dropped the old grants with it.
revoke all on public.v_monthly_report from anon, authenticated;
grant select on public.v_monthly_report to authenticated;
