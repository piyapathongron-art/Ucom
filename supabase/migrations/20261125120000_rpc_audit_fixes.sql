-- RPC audit fixes 1–5 (docs/pos/audit-rpc-2026-11-25.md). Follows 20261125090000.
--
-- 1. Abandoning a repair job works again once the cash book is open. The repair-collection guard
--    only accepted a closed_at change inside a repair_close cash operation, and there is no cash
--    action for abandon, so rpc_set_repair_status always failed with 42501.
-- 2. A sale's sold_at is checked on insert: always a finite timestamp, and for anyone but the owner
--    within the last 48 hours (the offline queue's window) and no more than 5 minutes ahead.
--    Before this, staff could book a sale into any past or future day, which the cash book then
--    froze so it could never be corrected.
-- 3. 'NaN' is refused in every numeric column of every public table. Postgres ranks NaN above
--    every number, so it passed all ">= 0" checks and would turn profit totals into NaN.
-- 4. A repair-close bill may contain service lines only. Product, device or top-up lines on it
--    dropped their revenue and cost out of the report, because repair profit is revenue − part cost.
-- 5. rpc_upsert_product keeps the current value of any key the caller leaves out (no more
--    silent 0), and when the caller sends expected_qty, refuses the save if stock changed since
--    the form was opened, so a stale form cannot resurrect sold units.
--
-- Before applying, look for rows that would already break rule 3 (read-only). The constraints are
-- added NOT VALID, so existing NaN rows do not block the migration but stay until fixed:
--   select table_name, column_name from information_schema.columns
--    where table_schema = 'public' and data_type = 'numeric';
--   -- then per column: select count(*) from public.<table> where <column> = 'NaN';

-- ─────────────────────────────────────────────────────────────
-- 1. Repair collection guard: let abandon through
-- ─────────────────────────────────────────────────────────────
create or replace function public.ucom_cash_guard_repair_collection()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_epoch uuid; v_op uuid;
begin
  select epoch into v_epoch from public.ucom_cash_book where id for update;
  if v_epoch is null then return new; end if;
  if tg_op='UPDATE' and new.sale_id is not distinct from old.sale_id
    and new.closed_at is not distinct from old.closed_at
    and not (new.status is distinct from old.status and (new.status='collected' or old.status='collected')) then
    return new;
  end if;
  -- Abandon closes a job that never had a bill: no money moves, so no cash operation is needed.
  if tg_op='UPDATE' and new.status='abandoned' and old.status not in ('collected','abandoned')
    and new.sale_id is null and old.sale_id is null and new.closed_at is not null then
    return new;
  end if;
  if tg_op='INSERT' and new.sale_id is null and new.closed_at is null and new.status<>'collected' then return new; end if;
  v_op:=nullif(current_setting('ucom.cash_operation',true),'')::uuid;
  if not exists(select 1 from public.ucom_cash_operations o join public.sales s on s.id=new.sale_id
    where o.id=v_op and o.action='repair_close' and o.actor=auth.uid()
      and o.transaction_id=txid_current() and o.result is null
      and o.payload->>'id'=new.id::text and o.payload->'payload'->>'client_uuid'=o.id::text
      and s.client_uuid=o.id::text and new.status='collected' and new.closed_at is not null) then
    raise exception 'ต้องปิดงานซ่อมผ่านรายการรับเงินรุ่นใหม่' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.ucom_cash_guard_repair_collection() from public,anon,authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Sale date window
-- ─────────────────────────────────────────────────────────────
create function public.pos_guard_sale_sold_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sold_at is null or not isfinite(new.sold_at) then
    raise exception 'วันเวลาขายไม่ถูกต้อง' using errcode = 'P0001';
  end if;
  -- Server-side work with no signed-in user (migrations, service role) and the owner keep full control.
  if auth.uid() is null or public.pos_is_owner() then
    return new;
  end if;
  if new.sold_at > now() + interval '5 minutes' then
    raise exception 'วันเวลาขายอยู่ในอนาคต กรุณาตรวจนาฬิกาเครื่อง' using errcode = 'P0001';
  end if;
  if new.sold_at < now() - interval '48 hours' then
    raise exception 'บิลนี้เก่าเกิน 48 ชั่วโมง ให้เจ้าของร้านบันทึกแทน' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.pos_guard_sale_sold_at() from public, anon, authenticated;

create trigger sales_guard_sold_at
  before insert or update of sold_at on public.sales
  for each row execute function public.pos_guard_sale_sold_at();

-- ─────────────────────────────────────────────────────────────
-- 3. No NaN in any numeric column (NOT VALID: new and changed rows only)
-- ─────────────────────────────────────────────────────────────
do $$
declare
  r record;
  v_name text;
begin
  for r in
    select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and c.data_type = 'numeric'
     order by c.table_name, c.column_name
  loop
    v_name := left(r.table_name || '_' || r.column_name, 54) || '_not_nan';
    if not exists (select 1 from pg_constraint where conname = v_name) then
      execute format(
        'alter table public.%I add constraint %I check (%I is null or %I <> ''NaN''::numeric) not valid',
        r.table_name, v_name, r.column_name, r.column_name
      );
    end if;
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Repair-close bills carry service lines only
-- ─────────────────────────────────────────────────────────────
create or replace function public.rpc_close_repair_job(p_job_id uuid, p_sale_payload jsonb)
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

  -- Repair profit is the bill's revenue minus part cost; any other line would fall out of the report.
  if jsonb_typeof(p_sale_payload -> 'items') <> 'array'
     or jsonb_array_length(p_sale_payload -> 'items') = 0
     or exists (
       select 1 from jsonb_array_elements(p_sale_payload -> 'items') i
        where coalesce(i ->> 'kind', '') <> 'service'
     ) then
    raise exception 'บิลค่าซ่อมมีได้เฉพาะรายการค่าบริการ สินค้าอื่นให้ออกบิลที่หน้าขาย' using errcode = 'P0001';
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

revoke all on function public.rpc_close_repair_job(uuid, jsonb) from public, anon;
grant execute on function public.rpc_close_repair_job(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. rpc_upsert_product: keep missing keys, refuse a stale qty
-- ─────────────────────────────────────────────────────────────
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
  v_current public.products%rowtype;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;
  if coalesce(nullif(trim(payload ->> 'name'), ''), '') = '' then
    raise exception 'ต้องระบุชื่อสินค้า' using errcode = 'P0001';
  end if;
  if (payload ? 'price' and coalesce((payload ->> 'price')::numeric, -1) < 0)
     or (payload ? 'qty' and coalesce((payload ->> 'qty')::int, -1) < 0) then
    raise exception 'ราคาและจำนวนต้องเป็นศูนย์หรือมากกว่า' using errcode = 'P0001';
  end if;

  if v_id is not null then
    select * into v_current from public.products p where p.id = v_id for update;
    if not found then
      raise exception 'ไม่พบสินค้า' using errcode = 'P0001';
    end if;
  end if;

  if payload ? 'carrier_id' and v_carrier_id is distinct from v_current.carrier_id
     and not public.pos_is_owner() then
    raise exception 'เจ้าของร้านเท่านั้นที่กำหนดค่ายซิมได้' using errcode = '42501';
  end if;

  if v_id is not null then
    -- The form sends the qty it showed; a sale since then means the typed qty is stale.
    if payload ? 'qty' and payload ? 'expected_qty'
       and (payload ->> 'expected_qty')::int is distinct from v_current.qty then
      raise exception 'จำนวนคงเหลือเปลี่ยนไปแล้ว (ตอนนี้ %) กรุณาเปิดรายการใหม่แล้วแก้อีกครั้ง', v_current.qty
        using errcode = 'P0001';
    end if;

    update public.products
       set name = payload ->> 'name',
           sku = case when payload ? 'sku' then nullif(payload ->> 'sku', '') else sku end,
           category_id = case when payload ? 'category_id' then v_category_id else category_id end,
           carrier_id = case when payload ? 'carrier_id' then v_carrier_id else carrier_id end,
           price = case when payload ? 'price' then (payload ->> 'price')::numeric else price end,
           qty = case when payload ? 'qty' then (payload ->> 'qty')::int else qty end,
           is_active = case when payload ? 'is_active' then (payload ->> 'is_active')::boolean else is_active end
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

revoke all on function public.rpc_upsert_product(jsonb) from public, anon;
grant execute on function public.rpc_upsert_product(jsonb) to authenticated;
