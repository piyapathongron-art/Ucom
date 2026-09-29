-- ADR 0025/0026: SIM carrier and drawer-paid repair parts for close-day.
alter table public.products
  add column carrier_id uuid references public.topup_carriers(id) on delete restrict;

alter table public.repair_jobs
  add column part_paid_from text check (part_paid_from in ('cash', 'transfer'));

-- Append the new column so CREATE OR REPLACE preserves the existing view contract.
create or replace view public.v_pos_stock with (security_invoker = false) as
select 'product'::text as kind, p.id, p.name, p.sku as code,
  c.name as category_name, p.price, p.qty,
  case when p.is_active then 'active' else 'inactive' end as status,
  null::text as acquisition, null::uuid as sf_order_id, p.cost,
  p.carrier_id
from public.products p
left join public.categories c on c.id = p.category_id
where public.pos_is_member()
union all
select 'device'::text, d.id, d.model_name, d.imei, null,
  d.list_price, 1, d.status, d.acquisition, d.sf_order_id, d.cost,
  null::uuid
from public.device_units d
where public.pos_is_member();

-- Staff can edit stock, but only an owner may assign or change a SIM carrier.
create or replace function public.rpc_upsert_product(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_category_id uuid := nullif(payload ->> 'category_id', '')::uuid;
  v_carrier_id uuid := nullif(payload ->> 'carrier_id', '')::uuid;
  v_current_carrier uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;
  if coalesce(nullif(trim(payload ->> 'name'), ''), '') = '' then
    raise exception 'ต้องระบุชื่อสินค้า' using errcode = 'P0001';
  end if;

  if v_id is not null then
    select p.carrier_id into v_current_carrier
    from public.products p where p.id = v_id for update;
    if not found then
      raise exception 'ไม่พบสินค้า' using errcode = 'P0001';
    end if;
  end if;

  if payload ? 'carrier_id' and v_carrier_id is distinct from v_current_carrier
     and not public.pos_is_owner() then
    raise exception 'เจ้าของร้านเท่านั้นที่กำหนดค่ายซิมได้' using errcode = '42501';
  end if;
  if v_id is not null then
    update public.products
       set name = payload ->> 'name',
           sku = nullif(payload ->> 'sku', ''),
           category_id = v_category_id,
           carrier_id = case when payload ? 'carrier_id' then v_carrier_id else carrier_id end,
           price = coalesce((payload ->> 'price')::numeric, 0),
           qty = coalesce((payload ->> 'qty')::int, 0),
           is_active = coalesce((payload ->> 'is_active')::boolean, true)
     where id = v_id;
    return v_id;
  end if;

  insert into public.products (name, sku, category_id, carrier_id, price, qty, is_active, cost)
  values (
    payload ->> 'name', nullif(payload ->> 'sku', ''), v_category_id,
    v_carrier_id, coalesce((payload ->> 'price')::numeric, 0),
    coalesce((payload ->> 'qty')::int, 0),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'cost')::numeric, 0)
  ) returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.rpc_set_part_cost(uuid, numeric);
create function public.rpc_set_part_cost(p_job_id uuid, p_cost numeric, p_paid_from text)
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
  if p_paid_from not in ('cash', 'transfer') or p_paid_from is null then
    raise exception 'ต้องระบุวิธีจ่ายค่าอะไหล่' using errcode = 'P0001';
  end if;
  update public.repair_jobs r
     set part_cost = p_cost, part_paid_at = now(), part_paid_from = p_paid_from
   where r.id = p_job_id and r.status <> 'collected';
  if not found then
    raise exception 'ไม่พบงานซ่อม หรืองานปิดไปแล้ว' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.rpc_set_part_cost(uuid, numeric, text) from public, anon;
grant execute on function public.rpc_set_part_cost(uuid, numeric, text) to authenticated;

-- Cost exposure is confined to this dated close-day read model, never v_pos_repairs.
create view public.v_close_day_parts with (security_invoker = false) as
select (r.part_paid_at at time zone 'Asia/Bangkok')::date as day,
  r.id, r.device_desc as job_label, r.part_cost as amount
from public.repair_jobs r
where r.part_paid_from = 'cash' and r.part_paid_at is not null
  and public.pos_is_member();
revoke all on public.v_close_day_parts from public, anon, authenticated;
grant select on public.v_close_day_parts to authenticated;
