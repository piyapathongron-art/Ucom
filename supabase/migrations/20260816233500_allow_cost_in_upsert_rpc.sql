-- Allow cost to be set at row creation only. Editing an existing row (id present in
-- payload) must never touch cost, regardless of what the payload contains — cost stays
-- owner-only-editable outside of creation, via the separate saveCost() direct-table-update
-- path in page.tsx (unchanged).

drop function if exists public.rpc_upsert_product(jsonb);
drop function if exists public.rpc_upsert_device(jsonb);

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

  insert into public.products (name, sku, category_id, price, qty, is_active, cost)
  values (
    payload ->> 'name',
    nullif(payload ->> 'sku', ''),
    nullif(payload ->> 'category_id', '')::uuid,
    coalesce((payload ->> 'price')::numeric, 0),
    coalesce((payload ->> 'qty')::int, 0),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'cost')::numeric, 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rpc_upsert_product(jsonb) from public, anon;
grant execute on function public.rpc_upsert_product(jsonb) to authenticated;

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
           sale_price = coalesce((payload ->> 'sale_price')::numeric, sale_price),
           status     = coalesce(nullif(payload ->> 'status', ''), status)
     where id = v_id;

    if not found then
      raise exception 'ไม่พบเครื่อง' using errcode = 'P0001';
    end if;

    return v_id;
  end if;

  insert into public.device_units (imei, model_name, acquisition, status, list_price, sale_price, cost)
  values (
    payload ->> 'imei',
    payload ->> 'model_name',
    coalesce(nullif(payload ->> 'acquisition', ''), 'purchased'),
    'in_stock',
    (payload ->> 'list_price')::numeric,
    nullif(payload ->> 'sale_price', '')::numeric,
    coalesce((payload ->> 'cost')::numeric, 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rpc_upsert_device(jsonb) from public, anon;
grant execute on function public.rpc_upsert_device(jsonb) to authenticated;
