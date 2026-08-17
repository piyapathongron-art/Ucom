-- Recreate v_sf_due so staff can read it, but hide amount_due from staff
drop view public.v_sf_due;

create view public.v_sf_due with (security_invoker = false) as
select
  o.id       as sf_order_id,
  o.order_no,
  o.ordered_at,
  o.note,
  count(d.id)                                        as device_count,
  count(d.id) filter (where d.status = 'financed')   as financed_count,
  count(d.id) filter (where d.status = 'in_stock')   as unfinanced_count,
  -- amount_due is derived from cost, and staff are deliberately kept away from cost everywhere else in this schema.
  case when public.pos_is_owner() then
    sum(coalesce(d.cost, d.list_price))
      filter (where d.status <> 'financed' and d.sf_paid_full_at is null)
  end as amount_due
from public.sf_orders o
left join public.device_units d on d.sf_order_id = o.id
where public.pos_is_member()
group by o.id, o.order_no, o.ordered_at, o.note;

revoke all on public.v_sf_due from anon;
grant select on public.v_sf_due to authenticated;

-- New view v_sf_order_devices
create view public.v_sf_order_devices with (security_invoker = false) as
select d.id, d.sf_order_id, d.imei, d.model_name, d.list_price, d.sale_price, d.status
from public.device_units d
where d.sf_order_id is not null and public.pos_is_member();

revoke all on public.v_sf_order_devices from anon;
grant select on public.v_sf_order_devices to authenticated;

-- rpc_update_sf_order
drop function if exists public.rpc_update_sf_order(jsonb);

create function public.rpc_update_sf_order(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_device jsonb;
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

-- rpc_delete_sf_order
drop function if exists public.rpc_delete_sf_order(uuid);

create function public.rpc_delete_sf_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.device_units
     where sf_order_id = p_id
       and (status <> 'in_stock' or sf_paid_full_at is not null)
  ) then
    raise exception 'ลบไม่ได้: บิลนี้มีเครื่องที่ปล่อย/ขายไปแล้ว' using errcode = 'P0001';
  end if;

  delete from public.device_units where sf_order_id = p_id;
  delete from public.sf_orders where id = p_id;
  
  if not found then 
    raise exception 'ไม่พบบิล SF' using errcode = 'P0001'; 
  end if;
end;
$$;

revoke all on function public.rpc_delete_sf_order(uuid) from public, anon;
grant execute on function public.rpc_delete_sf_order(uuid) to authenticated;
