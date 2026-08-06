-- Ucom POS — the only write path staff has
--
-- Every function is SECURITY DEFINER and checks pos_is_member() first. `authenticated`
-- alone is not a check: `auth.users` is shared with DailyGold (ADR 0008).
--
-- Cost is always read from the database, never taken from the payload. Staff cannot see
-- cost (rule 4), so staff must not be able to state it either — otherwise the whole
-- database-enforced cost hiding is decoration.
--
-- DROP before CREATE OR REPLACE on every function, always: `create or replace` does not
-- replace when a parameter changes, it adds an overload, and the next call resolves
-- ambiguously and fails. These are new functions; the drops are here so the next
-- migration that edits a signature inherits the habit.

drop function if exists public.rpc_create_sale(jsonb);
drop function if exists public.rpc_finance_device(uuid, numeric);
drop function if exists public.rpc_create_repair_job(jsonb);
drop function if exists public.rpc_close_repair_job(uuid, jsonb);

-- ─────────────────────────────────────────────────────────────
-- rpc_create_sale — bill + stock decrement + device status, one transaction
-- ─────────────────────────────────────────────────────────────
create function public.rpc_create_sale(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id     uuid;
  v_client_uuid text := nullif(payload ->> 'client_uuid', '');
  v_item        jsonb;
  v_kind        text;
  v_qty         int;
  v_unit_price  numeric(12, 2);
  v_unit_cost   numeric(12, 2);
  v_name        text;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(jsonb_array_length(payload -> 'items'), 0) = 0 then
    raise exception 'บิลต้องมีอย่างน้อย 1 รายการ' using errcode = 'P0001';
  end if;

  -- replay from the offline queue: the same client_uuid returns the original bill and
  -- writes nothing. Without this a flaky reconnect double-charges the customer and
  -- double-decrements stock.
  if v_client_uuid is not null then
    select s.id into v_sale_id
    from public.sales s
    where s.client_uuid = v_client_uuid;

    if found then
      return v_sale_id;
    end if;
  end if;

  insert into public.sales (
    sold_at, payment_method, receiving_account, bill_discount,
    bill_discount_reason, note, created_by, client_uuid
  ) values (
    coalesce((payload ->> 'sold_at')::timestamptz, now()),
    payload ->> 'payment_method',
    nullif(payload ->> 'receiving_account', ''),
    coalesce((payload ->> 'bill_discount')::numeric, 0),
    nullif(payload ->> 'bill_discount_reason', ''),
    nullif(payload ->> 'note', ''),
    (select auth.uid()),
    v_client_uuid
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    v_kind       := v_item ->> 'kind';
    v_qty        := coalesce((v_item ->> 'qty')::int, 1);
    v_unit_price := (v_item ->> 'unit_price')::numeric;

    if v_kind = 'product' then
      -- decrement and read cost in one statement: the `qty >= v_qty` predicate is the
      -- oversell guard, and it holds under concurrency where a read-then-write would not
      update public.products p
         set qty = p.qty - v_qty
       where p.id = (v_item ->> 'product_id')::uuid
         and p.qty >= v_qty
      returning p.cost, p.name into v_unit_cost, v_name;

      if not found then
        raise exception 'สินค้าไม่พอขาย หรือไม่พบสินค้า' using errcode = 'P0001';
      end if;

      insert into public.sale_items (
        sale_id, kind, product_id, name_snapshot, unit_cost, unit_price, qty,
        item_discount, item_discount_reason
      ) values (
        v_sale_id, 'product', (v_item ->> 'product_id')::uuid, v_name,
        v_unit_cost, v_unit_price, v_qty,
        coalesce((v_item ->> 'item_discount')::numeric, 0),
        nullif(v_item ->> 'item_discount_reason', '')
      );

    elsif v_kind = 'device' then
      -- `status = 'in_stock'` is what stops a financed device from getting a sales bill
      -- (ADR 0002) and what stops the same device being sold twice
      update public.device_units d
         set status = 'sold'
       where d.id = (v_item ->> 'device_unit_id')::uuid
         and d.status = 'in_stock'
      returning coalesce(d.cost, 0), d.model_name into v_unit_cost, v_name;

      if not found then
        raise exception 'เครื่องนี้ขายไม่ได้ — ไม่ได้อยู่ในสต็อกแล้ว' using errcode = 'P0001';
      end if;

      insert into public.sale_items (
        sale_id, kind, device_unit_id, name_snapshot, unit_cost, unit_price, qty,
        item_discount, item_discount_reason
      ) values (
        v_sale_id, 'device', (v_item ->> 'device_unit_id')::uuid, v_name,
        v_unit_cost, v_unit_price, 1,
        coalesce((v_item ->> 'item_discount')::numeric, 0),
        nullif(v_item ->> 'item_discount_reason', '')
      );

    elsif v_kind = 'topup' then
      -- the shop's cost is the face value less the carrier's margin — 3.00% on every
      -- one of the 452 top-ups in the source file, no exception
      select c.name, round(v_unit_price * (1 - c.commission_rate), 2)
        into v_name, v_unit_cost
      from public.topup_carriers c
      where c.id = (v_item ->> 'topup_carrier_id')::uuid
        and c.is_active;

      if not found then
        raise exception 'ไม่พบค่ายที่เปิดใช้งาน' using errcode = 'P0001';
      end if;

      insert into public.sale_items (
        sale_id, kind, topup_carrier_id, name_snapshot, unit_cost, unit_price, qty
      ) values (
        v_sale_id, 'topup', (v_item ->> 'topup_carrier_id')::uuid, v_name,
        v_unit_cost, v_unit_price, 1
      );

    elsif v_kind = 'service' then
      -- ponytail: service lines carry no cost. Staff cannot see cost, so staff cannot
      -- enter one; the owner edits the line afterwards on the rare service that has one.
      insert into public.sale_items (
        sale_id, kind, name_snapshot, unit_cost, unit_price, qty,
        item_discount, item_discount_reason
      ) values (
        v_sale_id, 'service',
        coalesce(nullif(v_item ->> 'name', ''), 'บริการ'),
        0, v_unit_price, v_qty,
        coalesce((v_item ->> 'item_discount')::numeric, 0),
        nullif(v_item ->> 'item_discount_reason', '')
      );

    else
      raise exception 'ประเภทรายการไม่ถูกต้อง' using errcode = 'P0001';
    end if;
  end loop;

  return v_sale_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_finance_device — SF+ device goes to a customer on instalments.
-- No sales bill is created. The commission is the only money the shop sees (ADR 0002).
-- ─────────────────────────────────────────────────────────────
create function public.rpc_finance_device(p_device_id uuid, p_commission numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if p_commission is null or p_commission < 0 then
    raise exception 'ต้องระบุค่าคอมมิชชั่น' using errcode = 'P0001';
  end if;

  update public.device_units d
     set status      = 'financed',
         commission  = p_commission,
         financed_at = now()
   where d.id = p_device_id
     and d.status = 'in_stock';

  if not found then
    raise exception 'เครื่องนี้ปล่อยผ่อนไม่ได้ — ไม่ได้อยู่ในสต็อก' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_create_repair_job — intake. Part cost is not known yet and is not asked for.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_create_repair_job(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(payload ->> 'customer_name', ''), '') = ''
     or coalesce(nullif(payload ->> 'device_desc', ''), '') = '' then
    raise exception 'ต้องระบุชื่อลูกค้าและอาการเครื่อง' using errcode = 'P0001';
  end if;

  insert into public.repair_jobs (
    customer_name, customer_phone, device_desc, symptom, quoted_price, note, created_by
  ) values (
    payload ->> 'customer_name',
    nullif(payload ->> 'customer_phone', ''),
    payload ->> 'device_desc',
    nullif(payload ->> 'symptom', ''),
    (payload ->> 'quoted_price')::numeric,
    nullif(payload ->> 'note', ''),
    (select auth.uid())
  )
  returning id into v_job_id;

  return v_job_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_close_repair_job — customer collects: issue the bill and close the job together
-- ─────────────────────────────────────────────────────────────
create function public.rpc_close_repair_job(p_job_id uuid, p_sale_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_sale_id uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  select r.status, r.sale_id into v_status, v_sale_id
  from public.repair_jobs r
  where r.id = p_job_id
  for update;

  if not found then
    raise exception 'ไม่พบงานซ่อม' using errcode = 'P0001';
  end if;

  -- already collected: hand back the bill that was issued, do not issue a second one
  if v_status = 'collected' then
    return v_sale_id;
  end if;

  if v_status = 'abandoned' then
    raise exception 'งานนี้ลูกค้าทิ้งไปแล้ว ปิดงานออกบิลไม่ได้' using errcode = 'P0001';
  end if;

  v_sale_id := public.rpc_create_sale(p_sale_payload);

  update public.repair_jobs r
     set status    = 'collected',
         closed_at = now(),
         sale_id   = v_sale_id
   where r.id = p_job_id;

  return v_sale_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- grants
-- ─────────────────────────────────────────────────────────────
revoke all on function public.rpc_create_sale(jsonb)              from public, anon;
revoke all on function public.rpc_finance_device(uuid, numeric)   from public, anon;
revoke all on function public.rpc_create_repair_job(jsonb)        from public, anon;
revoke all on function public.rpc_close_repair_job(uuid, jsonb)   from public, anon;

grant execute on function public.rpc_create_sale(jsonb)            to authenticated;
grant execute on function public.rpc_finance_device(uuid, numeric) to authenticated;
grant execute on function public.rpc_create_repair_job(jsonb)      to authenticated;
grant execute on function public.rpc_close_repair_job(uuid, jsonb) to authenticated;
