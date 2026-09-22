-- Staff may see and set the current cost for stock that is still operational.
-- Historical sale rows retain their own unit_cost snapshots, so changing a stock cost
-- never rewrites a completed transaction or exposes a computed margin.

alter table public.products
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

alter table public.device_units
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

create or replace function public.pos_touch_stock_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.pos_touch_stock_updated_at();

drop trigger if exists device_units_touch_updated_at on public.device_units;
create trigger device_units_touch_updated_at
  before update on public.device_units
  for each row execute function public.pos_touch_stock_updated_at();

create or replace view public.v_pos_stock with (security_invoker = false) as
select
  'product'::text as kind,
  p.id,
  p.name,
  p.sku          as code,
  c.name         as category_name,
  p.price,
  p.qty,
  case when p.is_active then 'active' else 'inactive' end as status,
  null::text     as acquisition,
  null::uuid     as sf_order_id,
  p.cost
from public.products p
left join public.categories c on c.id = p.category_id
where public.pos_is_member()

union all

select
  'device'::text,
  d.id,
  d.model_name,
  d.imei,
  null,
  d.list_price,
  1,
  d.status,
  d.acquisition,
  d.sf_order_id,
  d.cost
from public.device_units d
where public.pos_is_member();

create function public.rpc_set_stock_cost(p_kind text, p_id uuid, p_cost numeric)
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
    raise exception 'ต้นทุนต้องเป็นศูนย์หรือมากกว่า' using errcode = 'P0001';
  end if;

  if p_kind = 'product' then
    update public.products set cost = p_cost where id = p_id;
  elsif p_kind = 'device' then
    update public.device_units
       set cost = p_cost
     where id = p_id
       and status = 'in_stock';
  else
    raise exception 'ชนิดสต็อกไม่ถูกต้อง' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'ไม่พบรายการที่ยังแก้ต้นทุนได้' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.rpc_set_stock_cost(text, uuid, numeric) from public, anon;
grant execute on function public.rpc_set_stock_cost(text, uuid, numeric) to authenticated;
