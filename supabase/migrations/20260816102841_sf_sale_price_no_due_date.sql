-- SF flow correction: an SF-credit device only ever exits stock two ways — financed
-- (instalment with the customer, ADR 0002/0016) or sold for cash like any other device.
-- There is no maturity/due-date event that forces anything; the shop chooses either exit
-- at any time. This migration:
--   1. adds device_units.sale_price so an SF device can carry a shop selling price
--      distinct from list_price (which is the debt owed back to SF, not a sale price)
--   2. makes a cash sale of an sf_credit device auto-book cost = list_price and stamp
--      sf_paid_full_at, since paying SF in full is exactly what a cash sale means
--   3. removes the due-date concept end to end (sf_orders.due_date, v_sf_due.days_left)
--      — confirmed against production: sf_orders has 0 rows, so this drops 0 data.

-- ─────────────────────────────────────────────────────────────
-- 1. sale_price — the shop's asking price. null means "use list_price" (true for every
-- purchased/consigned_in device, where list_price already is the sale price).
-- ─────────────────────────────────────────────────────────────
alter table public.device_units
  add column sale_price numeric(12, 2) check (sale_price >= 0);

comment on column public.device_units.sale_price is
  'ราคาตั้งขายหน้าร้าน; null = ใช้ list_price. สำหรับ sf_credit, list_price คือหนี้ที่ต้องจ่ายคืน SF ไม่ใช่ราคาขาย';

-- ─────────────────────────────────────────────────────────────
-- 2. v_pos_catalog / v_pos_stock — show the sale price, not the SF debt
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_pos_catalog with (security_invoker = false) as
select
  'product'::text as kind,
  p.id,
  p.name,
  p.sku        as code,
  p.price,
  p.qty,
  c.name       as category_name
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active
  and public.pos_is_member()

union all

select
  'device'::text,
  d.id,
  d.model_name,
  d.imei,
  coalesce(d.sale_price, d.list_price),
  1,
  null
from public.device_units d
where d.status = 'in_stock'
  and public.pos_is_member();

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
  coalesce(d.sale_price, d.list_price),
  1,
  d.status,
  d.acquisition,
  d.sf_order_id
from public.device_units d
where public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- 3. rpc_create_sale — a cash sale of an sf_credit device pays SF back in full.
-- DROP before CREATE OR REPLACE per repo convention (see pos_rpc.sql header), even
-- though the signature is unchanged here — keeps the habit consistent.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_create_sale(jsonb);

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
      -- (ADR 0002) and what stops the same device being sold twice. An sf_credit device
      -- sold for cash instead of financed means the shop is paying SF back in full right
      -- now — book cost = list_price and stamp sf_paid_full_at in the same statement
      -- (CONTEXT.md's "เลยกำหนด" path, minus the due-date trigger: it can happen anytime).
      update public.device_units d
         set status = 'sold',
             cost = coalesce(d.cost, case when d.acquisition = 'sf_credit'
                                           then d.list_price end),
             sf_paid_full_at = case when d.acquisition = 'sf_credit'
                                     then coalesce(d.sf_paid_full_at, now()) end
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

revoke all on function public.rpc_create_sale(jsonb) from public, anon;
grant execute on function public.rpc_create_sale(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. rpc_upsert_device / rpc_receive_sf_order — accept sale_price; intake stops asking
-- for due_date.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_upsert_device(jsonb);

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

  insert into public.device_units (imei, model_name, acquisition, status, list_price, sale_price)
  values (
    payload ->> 'imei',
    payload ->> 'model_name',
    coalesce(nullif(payload ->> 'acquisition', ''), 'purchased'),
    'in_stock',
    (payload ->> 'list_price')::numeric,
    nullif(payload ->> 'sale_price', '')::numeric
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rpc_upsert_device(jsonb) from public, anon;
grant execute on function public.rpc_upsert_device(jsonb) to authenticated;

drop function if exists public.rpc_receive_sf_order(jsonb);

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
      v_device ->> 'imei',
      v_device ->> 'model_name',
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
-- 5. Drop due_date end to end. Confirmed on production: sf_orders has 0 rows, so this
-- drops 0 data. v_sf_due must be dropped and recreated (not CREATE OR REPLACE) because
-- the column list shrinks.
-- ─────────────────────────────────────────────────────────────
drop view public.v_sf_due;

create view public.v_sf_due with (security_invoker = false) as
select
  o.id       as sf_order_id,
  o.order_no,
  o.ordered_at,
  count(d.id)                                        as device_count,
  count(d.id) filter (where d.status = 'financed')   as financed_count,
  count(d.id) filter (where d.status = 'in_stock')   as unfinanced_count,
  -- ponytail: amount owed is valued at list_price when cost is still unknown —
  -- all 21 SF rows in the source file matched the device price exactly and none
  -- matched cost. Swap to a real per-order invoice amount if SF ever sends one.
  sum(coalesce(d.cost, d.list_price))
    filter (where d.status <> 'financed' and d.sf_paid_full_at is null)
                                                     as amount_due
from public.sf_orders o
left join public.device_units d on d.sf_order_id = o.id
where public.pos_is_owner()
group by o.id, o.order_no, o.ordered_at;

revoke all on public.v_sf_due from anon;
grant select on public.v_sf_due to authenticated;

alter table public.sf_orders drop column due_date;
