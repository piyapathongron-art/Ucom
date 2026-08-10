-- Ucom POS — phase 6: repair jobs (read view + status walk + part cost)
--
-- Staff holds no RLS policy on any base table (pos_core_schema.sql), so staff needs a
-- path built for it: a `security_invoker = false` view to read, SECURITY DEFINER
-- functions to write. Owner keeps direct table access through _owner_all.
--
-- part_cost is write-only for staff (ADR 0010). Enforced the same way cost is hidden
-- everywhere else: the column is absent from the SQL staff can reach, not filtered by
-- a parameter check. `authenticated` is not a gate on its own — auth.users is shared
-- with DailyGold (ADR 0008), so every object here calls pos_is_member().

drop function if exists public.rpc_set_repair_status(uuid, text);
drop function if exists public.rpc_set_part_cost(uuid, numeric);
drop view if exists public.v_pos_repairs;

-- ─────────────────────────────────────────────────────────────
-- v_pos_repairs — the repair screen's list. No part_cost, unlike the table beneath.
-- Both roles read through this; only owner reads the table directly (to see cost).
-- ─────────────────────────────────────────────────────────────
create view public.v_pos_repairs with (security_invoker = false) as
select
  r.id,
  r.received_at,
  r.customer_name,
  r.customer_phone,
  r.device_desc,
  r.symptom,
  r.quoted_price,
  r.status,
  -- part_paid_at is here but part_cost is not: it is the only signal staff has that a
  -- cost was already entered, and without it write-only means entering it twice
  r.part_paid_at,
  r.closed_at,
  r.sale_id,
  r.note
from public.repair_jobs r
where public.pos_is_member();

-- `authenticated` must be revoked too, not just `anon`. This view reads one table with
-- a plain WHERE, which makes it auto-updatable — and Supabase's default privileges on
-- `public` already hand `authenticated` INSERT/UPDATE/DELETE. Left alone, staff could
-- `update v_pos_repairs set status = 'collected'` and, because the view is
-- security_invoker = false, that write would run as the view's owner and go straight
-- through RLS, bypassing every RPC gate above. The older views escaped this only by
-- being UNIONs (never auto-updatable), not by being revoked correctly.
revoke all on public.v_pos_repairs from anon, authenticated;
grant select on public.v_pos_repairs to authenticated;

-- ─────────────────────────────────────────────────────────────
-- rpc_set_repair_status — one step at a time, either direction, plus the manual
-- abandon (ADR 0010).
--
-- 'collected' is deliberately unreachable here: collecting the device means issuing
-- the bill, which only rpc_close_repair_job does. A job set to 'collected' without a
-- sale_id would be counted by v_monthly_report at quoted_price instead of what was actually
-- paid.
-- ─────────────────────────────────────────────────────────────
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
     set status = p_status
   where r.id = p_job_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_set_part_cost — the part arrived and was paid for (ADR 0003). Staff may write
-- this and cannot read it back; v_pos_repairs has no part_cost column.
--
-- An abandoned job still accepts a cost: the part was paid for and ADR 0003 says that
-- money becomes the shop's expense rather than vanishing. A collected job does not —
-- its bill is issued and v_monthly_report has already counted it.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_set_part_cost(p_job_id uuid, p_cost numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if p_cost is null or p_cost < 0 then
    raise exception 'ต้องระบุต้นทุนอะไหล่' using errcode = 'P0001';
  end if;

  update public.repair_jobs r
     set part_cost    = p_cost,
         part_paid_at = now()
   where r.id = p_job_id
     and r.status <> 'collected';

  if not found then
    raise exception 'ไม่พบงานซ่อม หรืองานปิดไปแล้ว' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- grants
-- ─────────────────────────────────────────────────────────────
revoke all on function public.rpc_set_repair_status(uuid, text) from public, anon;
revoke all on function public.rpc_set_part_cost(uuid, numeric)  from public, anon;

grant execute on function public.rpc_set_repair_status(uuid, text) to authenticated;
grant execute on function public.rpc_set_part_cost(uuid, numeric)  to authenticated;
