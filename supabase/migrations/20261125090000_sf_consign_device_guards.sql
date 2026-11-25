-- SF+ and consignment device guards (plan-redesign-0033-rollout.md, step 0.1–0.4).
--
-- 1. rpc_upsert_device no longer changes a device's lifecycle. It only edits devices that are in
--    stock or written off, only moves between those two statuses, and only inserts purchased
--    devices. Selling, financing and consignment keep their own RPCs. Before this, any member
--    could send status = 'in_stock' for a sold, financed or reported-sold device and sell it again,
--    or mark a device sold with no Sale.
-- 2. A cost cannot be written on an SF device that has not been paid to SF (ADR 0017). Its cost
--    is set only by the cash sale itself, which stamps sf_paid_full_at in the same statement.
--    Enforced by a trigger, so no RPC (rpc_set_stock_cost or a future one) can get round it.
-- 3. SF tag price (list_price, the debt to SF) must be > 0, and a shop sale price, when given,
--    must be > 0, on receive and on edit.
-- 4. rpc_update_sf_order can add devices to a bill (rows with no id), which the edit dialog has
--    always offered but the RPC rejected with a uuid cast error.
--
-- Same signatures, so CREATE OR REPLACE keeps grants. Nothing here changes stored data.
--
-- Before applying, look for rows the new rules would have refused (read-only):
--   select id, imei, model_name, status, cost, list_price, sale_price
--     from public.device_units
--    where acquisition = 'sf_credit' and sf_paid_full_at is null
--      and (cost is not null or list_price is null or list_price <= 0 or sale_price <= 0);
-- Rows found there need the owner's decision; the trigger does not touch existing values.

-- ─────────────────────────────────────────────────────────────
-- 1. rpc_upsert_device: details only, no lifecycle changes
-- ─────────────────────────────────────────────────────────────
create or replace function public.rpc_upsert_device(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_status text := nullif(payload ->> 'status', '');
  v_acquisition text := coalesce(nullif(payload ->> 'acquisition', ''), 'purchased');
  v_current public.device_units%rowtype;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'imei', ''), '') = ''
     or coalesce(nullif(payload ->> 'model_name', ''), '') = '' then
    raise exception 'ต้องระบุ IMEI และรุ่นเครื่อง' using errcode = 'P0001';
  end if;

  if v_id is not null then
    select * into v_current from public.device_units where id = v_id for update;

    if not found then
      raise exception 'ไม่พบเครื่อง' using errcode = 'P0001';
    end if;

    if v_current.status not in ('in_stock', 'written_off') then
      raise exception 'แก้ไขได้เฉพาะเครื่องที่อยู่ในคลังหรือตัดจำหน่ายแล้ว' using errcode = 'P0001';
    end if;

    if v_status is not null and v_status not in ('in_stock', 'written_off') then
      raise exception 'เปลี่ยนสถานะนี้จากหน้าสต็อกไม่ได้ ให้ใช้หน้าขาย หน้าฝากขาย หรือหน้า SF+' using errcode = 'P0001';
    end if;

    -- The SF tag price is the debt to SF; it is edited on the SF bill, not here.
    if v_current.acquisition = 'sf_credit'
       and (payload ->> 'list_price') is not null
       and (payload ->> 'list_price')::numeric is distinct from v_current.list_price then
      raise exception 'ราคาป้าย SF แก้ได้ที่บิล SF เท่านั้น' using errcode = 'P0001';
    end if;

    update public.device_units
       set imei       = payload ->> 'imei',
           model_name = payload ->> 'model_name',
           list_price = coalesce((payload ->> 'list_price')::numeric, list_price),
           sale_price = coalesce((payload ->> 'sale_price')::numeric, sale_price),
           status     = coalesce(v_status, status)
     where id = v_id;

    return v_id;
  end if;

  -- SF devices come in through rpc_receive_sf_order and consigned-in devices through
  -- rpc_consignment_open_in; both need their bill or case.
  if v_acquisition <> 'purchased' then
    raise exception 'เพิ่มเครื่องจากหน้าสต็อกได้เฉพาะเครื่องซื้อขาด' using errcode = 'P0001';
  end if;

  insert into public.device_units (imei, model_name, acquisition, status, list_price, sale_price, cost)
  values (
    payload ->> 'imei',
    payload ->> 'model_name',
    'purchased',
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

-- ─────────────────────────────────────────────────────────────
-- 2. No cost on an SF device that is not paid to SF (ADR 0017)
-- ─────────────────────────────────────────────────────────────
create function public.pos_guard_sf_unpaid_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.acquisition = 'sf_credit'
     and new.sf_paid_full_at is null
     and new.cost is not null
     and (tg_op = 'INSERT' or new.cost is distinct from old.cost) then
    raise exception 'เครื่อง SF ที่ยังไม่ได้จ่าย SF ยังไม่มีต้นทุน ต้นทุนจะเท่ากับราคาป้ายเมื่อขายสด' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.pos_guard_sf_unpaid_cost() from public, anon, authenticated;

create trigger device_units_guard_sf_unpaid_cost
  before insert or update of cost, sf_paid_full_at on public.device_units
  for each row execute function public.pos_guard_sf_unpaid_cost();

-- ─────────────────────────────────────────────────────────────
-- 3. Shared SF device row validation
-- ─────────────────────────────────────────────────────────────
create function public.pos_sf_device_row_valid(v_device jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_list numeric;
  v_sale numeric;
begin
  if coalesce(btrim(v_device ->> 'imei'), '') = '' or coalesce(btrim(v_device ->> 'model_name'), '') = '' then
    raise exception 'ทุกแถวต้องมี IMEI และรุ่นเครื่อง' using errcode = 'P0001';
  end if;

  begin
    v_list := nullif(v_device ->> 'list_price', '')::numeric;
    v_sale := nullif(v_device ->> 'sale_price', '')::numeric;
  exception when invalid_text_representation then
    raise exception 'ราคาต้องเป็นตัวเลข' using errcode = 'P0001';
  end;

  if v_list is null or v_list <= 0 then
    raise exception 'ราคาป้าย SF ต้องมากกว่า 0 (IMEI %)', v_device ->> 'imei' using errcode = 'P0001';
  end if;

  if v_sale is not null and v_sale <= 0 then
    raise exception 'ราคาขายหน้าร้านต้องมากกว่า 0 หรือเว้นว่างไว้ (IMEI %)', v_device ->> 'imei' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.pos_sf_device_row_valid(jsonb) from public, anon, authenticated;

create or replace function public.rpc_receive_sf_order(payload jsonb)
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

  for v_device in select * from jsonb_array_elements(payload -> 'devices') loop
    perform public.pos_sf_device_row_valid(v_device);
  end loop;

  insert into public.sf_orders (order_no, ordered_at, note)
  values (
    payload ->> 'order_no',
    coalesce((payload ->> 'ordered_at')::date, current_date),
    nullif(payload ->> 'note', '')
  )
  returning id into v_order_id;

  for v_device in select * from jsonb_array_elements(payload -> 'devices') loop
    insert into public.device_units (
      imei, model_name, acquisition, status, list_price, sale_price, sf_order_id
    ) values (
      btrim(v_device ->> 'imei'),
      btrim(v_device ->> 'model_name'),
      'sf_credit',
      'in_stock',
      (v_device ->> 'list_price')::numeric,
      nullif(v_device ->> 'sale_price', '')::numeric,
      v_order_id
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.rpc_receive_sf_order(jsonb) from public, anon;
grant execute on function public.rpc_receive_sf_order(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. rpc_update_sf_order: validate rows, add new rows
-- ─────────────────────────────────────────────────────────────
create or replace function public.rpc_update_sf_order(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_device jsonb;
  v_device_id uuid;
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

  for v_device in select * from jsonb_array_elements(coalesce(payload -> 'devices', '[]'::jsonb)) loop
    perform public.pos_sf_device_row_valid(v_device);
  end loop;

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
  end if;

  for v_device in select * from jsonb_array_elements(coalesce(payload -> 'devices', '[]'::jsonb)) loop
    v_device_id := nullif(v_device ->> 'id', '')::uuid;

    if v_device_id is null then
      insert into public.device_units (
        imei, model_name, acquisition, status, list_price, sale_price, sf_order_id
      ) values (
        btrim(v_device ->> 'imei'),
        btrim(v_device ->> 'model_name'),
        'sf_credit',
        'in_stock',
        (v_device ->> 'list_price')::numeric,
        nullif(v_device ->> 'sale_price', '')::numeric,
        v_order_id
      );
    else
      update public.device_units
         set imei = btrim(v_device ->> 'imei'),
             model_name = btrim(v_device ->> 'model_name'),
             list_price = (v_device ->> 'list_price')::numeric,
             sale_price = nullif(v_device ->> 'sale_price', '')::numeric
       where id = v_device_id
         and sf_order_id = v_order_id
         and status = 'in_stock';

      if not found then
        raise exception 'แก้ไขได้เฉพาะเครื่องที่ยังอยู่ในคลัง' using errcode = 'P0001';
      end if;
    end if;
  end loop;

  if not exists (select 1 from public.device_units where sf_order_id = v_order_id) then
    raise exception 'บิลต้องเหลืออย่างน้อย 1 เครื่อง — ถ้าจะลบทั้งบิลให้ใช้ปุ่มลบบิล' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.rpc_update_sf_order(jsonb) from public, anon;
grant execute on function public.rpc_update_sf_order(jsonb) to authenticated;
