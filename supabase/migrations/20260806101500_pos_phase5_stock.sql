-- Ucom POS — phase 5: stock (products + device units + SF intake)
--
-- Staff gets full add/edit on products and device_units EXCEPT cost/commission — those
-- stay owner-only. RLS on these tables is all-or-nothing per role (_owner_all in
-- pos_core_schema.sql), so column-level hiding for staff has to happen the same way
-- rpc_create_sale hides cost: through a SECURITY DEFINER function whose SQL never
-- touches the column, not through a parameter check. Owner still edits cost directly
-- against the table (existing _owner_all RLS already allows it) — no RPC for that.

drop function if exists public.rpc_upsert_product(jsonb);
drop function if exists public.rpc_upsert_device(jsonb);
drop function if exists public.rpc_receive_sf_order(jsonb);

-- ─────────────────────────────────────────────────────────────
-- v_pos_stock — list view for the stock screen. No cost/commission, unlike the
-- underlying tables. Both roles read through this; only owner reads the tables
-- directly (to see cost).
-- ─────────────────────────────────────────────────────────────
create view public.v_pos_stock with (security_invoker = false) as
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
  null::uuid     as sf_order_id
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
  d.sf_order_id
from public.device_units d
where public.pos_is_member();

revoke all on public.v_pos_stock from anon;
grant select on public.v_pos_stock to authenticated;

-- ─────────────────────────────────────────────────────────────
-- rpc_upsert_product — add/edit a counted-stock product. cost is never read from or
-- written by this function; new products get the column's default (0) until the owner
-- sets a real cost directly on the table.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_upsert_product(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'name', ''), '') = '' then
    raise exception 'ต้องระบุชื่อสินค้า' using errcode = 'P0001';
  end if;

  if v_id is not null then
    update public.products
       set name        = payload ->> 'name',
           sku         = nullif(payload ->> 'sku', ''),
           category_id = nullif(payload ->> 'category_id', '')::uuid,
           price       = coalesce((payload ->> 'price')::numeric, 0),
           qty         = coalesce((payload ->> 'qty')::int, 0),
           is_active   = coalesce((payload ->> 'is_active')::boolean, true)
     where id = v_id;

    if not found then
      raise exception 'ไม่พบสินค้า' using errcode = 'P0001';
    end if;

    return v_id;
  end if;

  insert into public.products (name, sku, category_id, price, qty, is_active)
  values (
    payload ->> 'name',
    nullif(payload ->> 'sku', ''),
    nullif(payload ->> 'category_id', '')::uuid,
    coalesce((payload ->> 'price')::numeric, 0),
    coalesce((payload ->> 'qty')::int, 0),
    coalesce((payload ->> 'is_active')::boolean, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_upsert_device — add/edit a single device unit outside of SF intake (e.g. a
-- purchased device). cost/commission are never read from or written by this function.
-- Setting status to 'financed'/'sold' through here is not blocked in application logic
-- because the table constraints already reject it (device_financed_needs_commission) —
-- those transitions belong to rpc_finance_device / rpc_create_sale.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_upsert_device(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'imei', ''), '') = ''
     or coalesce(nullif(payload ->> 'model_name', ''), '') = '' then
    raise exception 'ต้องระบุ IMEI และรุ่นเครื่อง' using errcode = 'P0001';
  end if;

  if v_id is not null then
    update public.device_units
       set imei       = payload ->> 'imei',
           model_name = payload ->> 'model_name',
           list_price = coalesce((payload ->> 'list_price')::numeric, list_price),
           status     = coalesce(nullif(payload ->> 'status', ''), status)
     where id = v_id;

    if not found then
      raise exception 'ไม่พบเครื่อง' using errcode = 'P0001';
    end if;

    return v_id;
  end if;

  insert into public.device_units (imei, model_name, acquisition, status, list_price)
  values (
    payload ->> 'imei',
    payload ->> 'model_name',
    coalesce(nullif(payload ->> 'acquisition', ''), 'purchased'),
    'in_stock',
    (payload ->> 'list_price')::numeric
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_receive_sf_order — bulk intake: one SF order + its device units, one transaction.
-- All devices land as acquisition='sf_credit', cost=null (unknown until the order is
-- paid off — ADR-aligned with CONTEXT.md's SF Credit definition).
-- ─────────────────────────────────────────────────────────────
create function public.rpc_receive_sf_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_device   jsonb;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'order_no', ''), '') = '' then
    raise exception 'ต้องระบุเลขที่บิล SF' using errcode = 'P0001';
  end if;

  if coalesce(jsonb_array_length(payload -> 'devices'), 0) = 0 then
    raise exception 'ต้องมีเครื่องอย่างน้อย 1 เครื่อง' using errcode = 'P0001';
  end if;

  insert into public.sf_orders (order_no, ordered_at, due_date, note)
  values (
    payload ->> 'order_no',
    coalesce((payload ->> 'ordered_at')::date, current_date),
    nullif(payload ->> 'due_date', '')::date,
    nullif(payload ->> 'note', '')
  )
  returning id into v_order_id;

  for v_device in select * from jsonb_array_elements(payload -> 'devices') loop
    insert into public.device_units (
      imei, model_name, acquisition, status, list_price, sf_order_id
    ) values (
      v_device ->> 'imei',
      v_device ->> 'model_name',
      'sf_credit',
      'in_stock',
      (v_device ->> 'list_price')::numeric,
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- grants
-- ─────────────────────────────────────────────────────────────
revoke all on function public.rpc_upsert_product(jsonb)   from public, anon;
revoke all on function public.rpc_upsert_device(jsonb)    from public, anon;
revoke all on function public.rpc_receive_sf_order(jsonb) from public, anon;

grant execute on function public.rpc_upsert_product(jsonb)   to authenticated;
grant execute on function public.rpc_upsert_device(jsonb)    to authenticated;
grant execute on function public.rpc_receive_sf_order(jsonb) to authenticated;
