-- SF+ Commission Receipts — ADR 0016
-- Separates commission recording from financing. A device can now be financed without
-- supplying a commission; the commission is recorded later, per device, once the money
-- actually arrives, into sf_commission_receipts.
--
-- Gate 0 confirmed: 0 financed device_units exist in production, so no backfill is needed.

-- ─────────────────────────────────────────────────────────────
-- sf_commission_receipts — one active receipt per financed device, voided and
-- replaced atomically on correction (preserves full audit trail).
-- ─────────────────────────────────────────────────────────────
create table public.sf_commission_receipts (
  id             uuid           primary key default gen_random_uuid(),
  device_unit_id uuid           not null references public.device_units (id) on delete restrict,
  amount         numeric(12, 2) not null check (amount >= 0),
  received_on    date           not null,
  recorded_by    uuid           references public.profiles (id) on delete set null,
  recorded_at    timestamptz    not null default now(),
  voided_at      timestamptz,
  voided_by      uuid           references public.profiles (id) on delete set null,
  void_reason    text
);

alter table public.sf_commission_receipts enable row level security;

-- No direct-write policy: all writes go through SECURITY DEFINER RPCs below.
create policy sf_commission_receipts_member_read on public.sf_commission_receipts
  for select
  using (public.pos_is_member());

-- At most one active (non-voided) receipt per device.
create unique index sf_commission_receipts_one_active_per_device
  on public.sf_commission_receipts (device_unit_id)
  where (voided_at is null);

-- ─────────────────────────────────────────────────────────────
-- Remove device_financed_needs_commission — commission is no longer set at financing
-- time; the check constraint would block the new rpc_finance_device signature.
-- device_financed_needs_date stays untouched.
-- ─────────────────────────────────────────────────────────────
alter table public.device_units
  drop constraint if exists device_financed_needs_commission;

-- ─────────────────────────────────────────────────────────────
-- rpc_finance_device — drop the old (uuid, numeric) overload explicitly first so that
-- CREATE OR REPLACE does not silently create a second overload with a different
-- parameter list, which would break callers that pass a single uuid.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_finance_device(uuid, numeric);

create function public.rpc_finance_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  update public.device_units d
     set status      = 'financed',
         financed_at = now()
   where d.id         = p_device_id
     and d.status     = 'in_stock'
     and d.acquisition = 'sf_credit';

  if not found then
    raise exception 'เครื่องนี้ปล่อยผ่อนไม่ได้ — ต้องเป็นเครื่อง SF ที่อยู่ในสต็อก'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_record_sf_commission — member-callable. Records a commission receipt for a
-- financed device. amount >= 0; received_on must not be after today in Asia/Bangkok;
-- device must be financed and must not already have an active receipt.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_record_sf_commission(uuid, numeric, date);

create function public.rpc_record_sf_commission(
  p_device_unit_id uuid,
  p_amount         numeric,
  p_received_on    date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'ยอดค่าคอมต้องไม่ติดลบ' using errcode = 'P0001';
  end if;

  if p_received_on is null or p_received_on > v_today then
    raise exception 'วันที่รับเงินต้องไม่เกินวันนี้' using errcode = 'P0001';
  end if;

  -- Device must be financed
  if not exists (
    select 1 from public.device_units d
    where d.id = p_device_unit_id and d.status = 'financed'
  ) then
    raise exception 'เครื่องนี้ยังไม่ได้ปล่อยผ่อน' using errcode = 'P0001';
  end if;

  -- Must not already have an active receipt (unique partial index enforces this too,
  -- but an explicit check gives a friendlier message)
  if exists (
    select 1 from public.sf_commission_receipts r
    where r.device_unit_id = p_device_unit_id and r.voided_at is null
  ) then
    raise exception 'เครื่องนี้มีรายการค่าคอมอยู่แล้ว' using errcode = 'P0001';
  end if;

  insert into public.sf_commission_receipts
    (device_unit_id, amount, received_on, recorded_by)
  values
    (p_device_unit_id, p_amount, p_received_on, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_correct_sf_commission — owner-only. Voids the current active receipt with a
-- non-empty reason and creates its replacement atomically in one transaction.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_correct_sf_commission(uuid, text, numeric, date);

create function public.rpc_correct_sf_commission(
  p_device_unit_id uuid,
  p_void_reason    text,
  p_amount         numeric,
  p_received_on    date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_id uuid;
  v_today  date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not public.pos_is_owner() then
    raise exception 'ต้องเป็นเจ้าของร้านเท่านั้น' using errcode = '42501';
  end if;

  if coalesce(nullif(trim(p_void_reason), ''), '') = '' then
    raise exception 'ต้องระบุเหตุผลในการแก้ไข' using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount < 0 then
    raise exception 'ยอดค่าคอมต้องไม่ติดลบ' using errcode = 'P0001';
  end if;

  if p_received_on is null or p_received_on > v_today then
    raise exception 'วันที่รับเงินต้องไม่เกินวันนี้' using errcode = 'P0001';
  end if;

  -- Void the current active receipt
  update public.sf_commission_receipts r
     set voided_at   = now(),
         voided_by   = (select auth.uid()),
         void_reason = trim(p_void_reason)
   where r.device_unit_id = p_device_unit_id
     and r.voided_at is null;

  if not found then
    raise exception 'ไม่พบรายการค่าคอมที่ยังใช้งานอยู่' using errcode = 'P0001';
  end if;

  -- Create the replacement
  insert into public.sf_commission_receipts
    (device_unit_id, amount, received_on, recorded_by)
  values
    (p_device_unit_id, p_amount, p_received_on, (select auth.uid()))
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- v_sf_pending — devices financed but not yet having an active commission receipt.
-- Member-gated (staff need to see this to know what to record).
-- ─────────────────────────────────────────────────────────────
create view public.v_sf_pending with (security_invoker = false) as
select
  d.id          as device_unit_id,
  d.imei,
  d.model_name,
  d.financed_at
from public.device_units d
where d.status = 'financed'
  and d.financed_at is not null
  and not exists (
    select 1 from public.sf_commission_receipts r
    where r.device_unit_id = d.id and r.voided_at is null
  )
  and public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_sf_receipts — all active (non-voided) commission receipts with device info.
-- Member-gated.
-- ─────────────────────────────────────────────────────────────
create view public.v_sf_receipts with (security_invoker = false) as
select
  r.id,
  r.device_unit_id,
  d.imei,
  d.model_name,
  r.amount,
  r.received_on,
  r.recorded_at,
  r.recorded_by
from public.sf_commission_receipts r
join public.device_units d on d.id = r.device_unit_id
where r.voided_at is null
  and public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_report_entries — rewrite the SF pipe (pipe 3) to join the active receipt with
-- amount > 0, bucketing by received_on instead of financed_at.
-- All other pipes (sale, repair, expense) are unchanged.
-- v_close_day_sf is NOT touched.
-- ─────────────────────────────────────────────────────────────
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

  -- pipe 3: SF+ commission receipts. Recognized on the date the money was received,
  -- not the date the device was financed (ADR 0016). Only active receipts with
  -- amount > 0 appear in the report; amount = 0 closes the pending list silently.
  select
    r.received_on                                  as day,
    r.recorded_at                                  as occurred_at,
    'sf'::text                                     as kind,
    r.device_unit_id                               as ref_id,
    'ค่าคอม SF'::text                               as label,
    d.imei                                         as detail,
    0::numeric                                     as sale_revenue,
    0::numeric                                     as sale_profit,
    0::numeric                                     as repair_revenue,
    0::numeric                                     as repair_profit,
    r.amount                                       as sf_commission,
    0::numeric                                     as expense
  from public.sf_commission_receipts r
  join public.device_units d on d.id = r.device_unit_id
  where r.voided_at is null
    and r.amount > 0

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

-- ─────────────────────────────────────────────────────────────
-- Grants — explicit revoke then grant, matching prior migration style.
-- ─────────────────────────────────────────────────────────────
revoke all on public.sf_commission_receipts from anon, authenticated;
revoke all on public.v_sf_pending           from anon, authenticated;
revoke all on public.v_sf_receipts          from anon, authenticated;
revoke all on public.v_report_entries       from anon, authenticated;

grant select on public.sf_commission_receipts to authenticated;
grant select on public.v_sf_pending           to authenticated;
grant select on public.v_sf_receipts          to authenticated;
grant select on public.v_report_entries       to authenticated;

revoke all on function public.rpc_finance_device(uuid)                             from public, anon;
revoke all on function public.rpc_record_sf_commission(uuid, numeric, date)        from public, anon;
revoke all on function public.rpc_correct_sf_commission(uuid, text, numeric, date) from public, anon;

grant execute on function public.rpc_finance_device(uuid)                             to authenticated;
grant execute on function public.rpc_record_sf_commission(uuid, numeric, date)        to authenticated;
grant execute on function public.rpc_correct_sf_commission(uuid, text, numeric, date) to authenticated;
