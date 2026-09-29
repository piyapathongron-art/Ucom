-- rpc_update_sf_order: allow removing mistyped device rows while editing an SF order.
-- Same signature (payload jsonb), so CREATE OR REPLACE replaces in place — no overload.
-- payload.removed_device_ids: uuid[] as jsonb array (optional). Only devices of this order that
-- are still in stock and not paid to SF can be removed; the order must keep at least one device
-- (removing everything is rpc_delete_sf_order's job).

create or replace function public.rpc_update_sf_order(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_device jsonb;
  v_remove uuid[];
  v_removed int;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'order_no', ''), '') = '' then
    raise exception 'ต้องระบุเลขที่บิล SF' using errcode = 'P0001';
  end if;

  v_order_id := (payload ->> 'id')::uuid;

  update public.sf_orders
     set order_no = payload ->> 'order_no',
         ordered_at = coalesce((payload ->> 'ordered_at')::date, ordered_at),
         note = nullif(payload ->> 'note', '')
   where id = v_order_id;

  if not found then
    raise exception 'ไม่พบบิล SF' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct value::uuid), '{}')
    into v_remove
    from jsonb_array_elements_text(coalesce(payload -> 'removed_device_ids', '[]'::jsonb));

  if cardinality(v_remove) > 0 then
    delete from public.device_units
     where id = any(v_remove)
       and sf_order_id = v_order_id
       and status = 'in_stock'
       and sf_paid_full_at is null;
    get diagnostics v_removed = row_count;

    if v_removed <> cardinality(v_remove) then
      raise exception 'ลบได้เฉพาะเครื่องที่ยังอยู่ในคลังและยังไม่ได้จ่าย SF' using errcode = 'P0001';
    end if;

    if not exists (select 1 from public.device_units where sf_order_id = v_order_id) then
      raise exception 'บิลต้องเหลืออย่างน้อย 1 เครื่อง — ถ้าจะลบทั้งบิลให้ใช้ปุ่มลบบิล' using errcode = 'P0001';
    end if;
  end if;

  for v_device in select * from jsonb_array_elements(payload -> 'devices') loop
    update public.device_units
       set imei = v_device ->> 'imei',
           model_name = v_device ->> 'model_name',
           list_price = (v_device ->> 'list_price')::numeric,
           sale_price = nullif(v_device ->> 'sale_price', '')::numeric
     where id = (v_device ->> 'id')::uuid
       and sf_order_id = v_order_id
       and status = 'in_stock';

    if not found then
      raise exception 'แก้ไขได้เฉพาะเครื่องที่ยังอยู่ในคลัง' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

revoke all on function public.rpc_update_sf_order(jsonb) from public, anon;
grant execute on function public.rpc_update_sf_order(jsonb) to authenticated;
