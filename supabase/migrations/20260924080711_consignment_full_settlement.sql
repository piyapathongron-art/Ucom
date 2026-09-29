-- One case per placement; no revenue at hand-off or at a partner's sale report.
alter table public.device_units drop constraint device_units_status_check;
alter table public.device_units add constraint device_units_status_check
  check (status in ('in_stock', 'consigned_out', 'sold', 'financed', 'written_off', 'returned'));

create table public.consignments (
  id uuid primary key default gen_random_uuid(),
  device_unit_id uuid not null references public.device_units(id) on delete restrict,
  imei_snapshot text not null,
  model_snapshot text not null,
  direction text not null check (direction in ('out', 'in')),
  counterparty_name text not null check (length(trim(counterparty_name)) > 0),
  status text not null check (status in (
    'placing', 'reopening', 'placed', 'reporting', 'reported_sold', 'settling',
    'selling', 'sold_unpaid', 'paying', 'returning', 'settled', 'paid', 'returned'
  )),
  listed_price numeric(12,2) not null check (listed_price >= 0),
  gross_sale_amount numeric(12,2) check (gross_sale_amount > 0),
  partner_share numeric(12,2) check (partner_share >= 0),
  sale_id uuid unique references public.sales(id) on delete restrict,
  payout_method text check (payout_method in ('cash', 'transfer')),
  reported_at timestamptz,
  sold_at timestamptz,
  settled_at timestamptz,
  paid_at timestamptz,
  returned_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  settled_by uuid references public.profiles(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  returned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (partner_share is null or (gross_sale_amount is not null and partner_share <= gross_sale_amount))
);

create unique index consignments_one_open_per_device on public.consignments(device_unit_id)
  where status not in ('settled', 'paid', 'returned');
create index consignments_direction_status_idx on public.consignments(direction, status, created_at desc);
create index consignments_paid_at_idx on public.consignments(paid_at)
  where paid_at is not null;

alter table public.consignments enable row level security;
revoke all on public.consignments from public, anon, authenticated;
grant select on public.consignments to authenticated;
create policy consignments_owner_read on public.consignments
  for select to authenticated using (public.pos_is_owner());

-- The existing stock RPC can edit device status. Require a live case transition
-- before any movement involving consignment so it cannot bypass the money flow.
create function public.pos_guard_consignment_device_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_required text;
begin
  if new.status = old.status then return new; end if;
  if old.status = 'in_stock' and new.status = 'consigned_out' and old.acquisition = 'purchased' then
    v_required := 'placing';
  elsif old.status = 'consigned_out' and new.status = 'sold' then
    v_required := 'reporting';
  elsif old.status = 'consigned_out' and new.status = 'in_stock' then
    v_required := 'returning';
  elsif old.acquisition = 'consigned_in' and old.status = 'in_stock' and new.status = 'sold' then
    v_required := 'selling';
  elsif old.acquisition = 'consigned_in' and old.status = 'in_stock' and new.status = 'returned' then
    v_required := 'returning';
  elsif old.acquisition = 'consigned_in' and old.status = 'returned' and new.status = 'in_stock' then
    v_required := 'reopening';
  elsif old.acquisition = 'consigned_in' or old.status = 'consigned_out' or new.status = 'consigned_out' then
    raise exception 'สถานะเครื่องฝากขายต้องเปลี่ยนผ่านหน้าฝากขาย' using errcode = 'P0001';
  else
    return new;
  end if;
  if not exists (
    select 1 from public.consignments c
    where c.device_unit_id = old.id and c.status = v_required
  ) then
    raise exception 'สถานะเครื่องฝากขายต้องเปลี่ยนผ่านหน้าฝากขาย' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pos_guard_consignment_device_status() from public, anon, authenticated;
create trigger device_units_guard_consignment_status
  before update of status on public.device_units
  for each row execute function public.pos_guard_consignment_device_status();

create function public.pos_guard_consignment_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.acquisition='consigned_in' and new.cost is distinct from old.cost
     and not exists (select 1 from public.consignments c
       where c.device_unit_id=old.id and c.status='selling') then
    raise exception 'ต้นทุนเครื่องฝากเข้ากำหนดตอนขายเท่านั้น' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pos_guard_consignment_cost() from public,anon,authenticated;
create trigger device_units_guard_consignment_cost
  before update of cost on public.device_units
  for each row execute function public.pos_guard_consignment_cost();

create function public.rpc_consignment_open_out(
  p_device_id uuid, p_counterparty text, p_listed_price numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_device public.device_units%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  if nullif(trim(p_counterparty), '') is null or p_listed_price is null
     or p_listed_price < 0 or p_listed_price <> round(p_listed_price,2) then
    raise exception 'ข้อมูลฝากเครื่องไม่ถูกต้อง' using errcode='P0001';
  end if;
  select * into v_device from public.device_units where id=p_device_id for update;
  if not found or v_device.acquisition <> 'purchased' or v_device.status <> 'in_stock' or v_device.cost is null then
    raise exception 'ฝากออกได้เฉพาะเครื่องซื้อขาดในสต็อกที่บันทึกต้นทุนแล้ว' using errcode='P0001';
  end if;
  insert into public.consignments(device_unit_id,imei_snapshot,model_snapshot,direction,counterparty_name,status,listed_price,created_by)
  values (p_device_id,v_device.imei,v_device.model_name,'out',trim(p_counterparty),'placing',p_listed_price,(select auth.uid()))
  returning id into v_id;
  update public.device_units set status='consigned_out', consigned_to=trim(p_counterparty)
    where id=p_device_id;
  update public.consignments set status='placed' where id=v_id;
  return v_id;
end;
$$;

create function public.rpc_consignment_open_in(
  p_imei text, p_model_name text, p_counterparty text, p_listed_price numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_device_id uuid; v_existing public.device_units%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  if nullif(trim(p_imei), '') is null or nullif(trim(p_model_name), '') is null
     or nullif(trim(p_counterparty), '') is null or p_listed_price is null
     or p_listed_price < 0 or p_listed_price <> round(p_listed_price,2) then
    raise exception 'ข้อมูลรับฝากไม่ถูกต้อง' using errcode='P0001';
  end if;
  select * into v_existing from public.device_units where imei=trim(p_imei) for update;
  if found then
    if v_existing.acquisition <> 'consigned_in' or v_existing.status <> 'returned' then
      raise exception 'IMEI นี้มีอยู่ในระบบแล้ว' using errcode='P0001';
    end if;
    v_device_id := v_existing.id;
    insert into public.consignments(device_unit_id,imei_snapshot,model_snapshot,direction,counterparty_name,status,listed_price,created_by)
    values (v_device_id,trim(p_imei),trim(p_model_name),'in',trim(p_counterparty),'reopening',p_listed_price,(select auth.uid()))
    returning id into v_id;
    update public.device_units set status='in_stock',model_name=trim(p_model_name),
      list_price=p_listed_price,consignor_name=trim(p_counterparty) where id=v_device_id;
    update public.consignments set status='placed' where id=v_id;
    return v_id;
  end if;
  insert into public.device_units(imei,model_name,acquisition,status,list_price,consignor_name)
  values (trim(p_imei),trim(p_model_name),'consigned_in','in_stock',p_listed_price,trim(p_counterparty))
  returning id into v_device_id;
  insert into public.consignments(device_unit_id,imei_snapshot,model_snapshot,direction,counterparty_name,status,listed_price,created_by)
  values (v_device_id,trim(p_imei),trim(p_model_name),'in',trim(p_counterparty),'placed',p_listed_price,(select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.rpc_consignment_return(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_case public.consignments%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into v_case from public.consignments where id=p_id for update;
  if not found or v_case.status <> 'placed' then
    raise exception 'คืนได้เฉพาะเครื่องที่ยังฝากอยู่' using errcode='P0001';
  end if;
  if not exists (select 1 from public.device_units d where d.id=v_case.device_unit_id
    and d.status=case when v_case.direction='out' then 'consigned_out' else 'in_stock' end) then
    raise exception 'สถานะเครื่องไม่ตรงกับรายการฝากขาย' using errcode='P0001';
  end if;
  update public.consignments set status='returning' where id=p_id;
  update public.device_units set status=case when v_case.direction='out' then 'in_stock' else 'returned' end,
    consigned_to=case when v_case.direction='out' then null else consigned_to end
    where id=v_case.device_unit_id;
  update public.consignments set status='returned', returned_at=now(), returned_by=(select auth.uid()) where id=p_id;
end;
$$;

create function public.rpc_consignment_report_out(p_id uuid, p_sale_price numeric, p_partner_share numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_case public.consignments%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into v_case from public.consignments where id=p_id for update;
  if not found or v_case.direction <> 'out' or v_case.status <> 'placed'
     or p_sale_price is null or p_sale_price <= 0
     or p_partner_share is null or p_partner_share < 0 or p_partner_share >= p_sale_price
     or p_sale_price <> round(p_sale_price,2) or p_partner_share <> round(p_partner_share,2) then
    raise exception 'ข้อมูลแจ้งขายฝากออกไม่ถูกต้อง' using errcode='P0001';
  end if;
  if not exists (select 1 from public.device_units d where d.id=v_case.device_unit_id
    and d.status='consigned_out') then
    raise exception 'สถานะเครื่องไม่ตรงกับรายการฝากขาย' using errcode='P0001';
  end if;
  update public.consignments set status='reporting', gross_sale_amount=p_sale_price,
    partner_share=p_partner_share where id=p_id;
  update public.device_units set status='sold' where id=v_case.device_unit_id;
  update public.consignments set status='reported_sold', reported_at=now(),
    reported_by=(select auth.uid()) where id=p_id;
end;
$$;

create function public.rpc_consignment_settle_out(
  p_id uuid, p_payment_method text, p_receiving_account text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_case public.consignments%rowtype; v_device public.device_units%rowtype; v_sale_id uuid;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into v_case from public.consignments where id=p_id for update;
  if not found or v_case.direction <> 'out' then raise exception 'ไม่พบรายการฝากออก' using errcode='P0001'; end if;
  if v_case.status='settled' then return v_case.sale_id; end if;
  if v_case.status <> 'reported_sold' or p_payment_method is null
     or p_payment_method not in ('cash','transfer')
     or (p_payment_method='transfer' and nullif(trim(p_receiving_account), '') is null) then
    raise exception 'ยังรับเงินฝากออกไม่ได้' using errcode='P0001';
  end if;
  select * into v_device from public.device_units where id=v_case.device_unit_id for update;
  if v_device.status <> 'sold' or v_device.cost is null then
    raise exception 'สถานะหรือต้นทุนเครื่องไม่ถูกต้อง' using errcode='P0001';
  end if;
  update public.consignments set status='settling' where id=p_id;
  insert into public.sales(sold_at,payment_method,receiving_account,bill_discount,note,created_by,client_uuid)
  values (now(),p_payment_method,case when p_payment_method='transfer' then trim(p_receiving_account) else null end,
    0,'Consignment out settlement',(select auth.uid()),'consignment-out:' || p_id::text)
  returning id into v_sale_id;
  insert into public.sale_items(sale_id,kind,device_unit_id,name_snapshot,unit_cost,unit_price,qty)
  values (v_sale_id,'device',v_case.device_unit_id,v_case.model_snapshot,v_device.cost,
    v_case.gross_sale_amount-v_case.partner_share,1);
  update public.consignments set status='settled',sale_id=v_sale_id,settled_at=now(),
    settled_by=(select auth.uid()) where id=p_id;
  return v_sale_id;
end;
$$;

create function public.rpc_consignment_sell_in(
  p_id uuid, p_sale_price numeric, p_partner_share numeric,
  p_payment_method text, p_receiving_account text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_case public.consignments%rowtype; v_device public.device_units%rowtype; v_sale_id uuid;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into v_case from public.consignments where id=p_id for update;
  if not found or v_case.direction <> 'in' then raise exception 'ไม่พบรายการฝากเข้า' using errcode='P0001'; end if;
  if v_case.status in ('sold_unpaid','paid') then return v_case.sale_id; end if;
  if v_case.status <> 'placed' or p_sale_price is null or p_sale_price <= 0
     or p_partner_share is null or p_partner_share < 0 or p_partner_share > p_sale_price
     or p_sale_price <> round(p_sale_price,2) or p_partner_share <> round(p_partner_share,2)
     or p_payment_method is null or p_payment_method not in ('cash','transfer')
     or (p_payment_method='transfer' and nullif(trim(p_receiving_account), '') is null) then
    raise exception 'ข้อมูลขายฝากเข้าไม่ถูกต้อง' using errcode='P0001';
  end if;
  select * into v_device from public.device_units where id=v_case.device_unit_id for update;
  if v_device.status <> 'in_stock' then raise exception 'เครื่องนี้ขายไม่ได้' using errcode='P0001'; end if;
  update public.consignments set status='selling',gross_sale_amount=p_sale_price,
    partner_share=p_partner_share where id=p_id;
  update public.device_units set status='sold',cost=p_partner_share where id=v_case.device_unit_id;
  insert into public.sales(sold_at,payment_method,receiving_account,bill_discount,note,created_by,client_uuid)
  values (now(),p_payment_method,case when p_payment_method='transfer' then trim(p_receiving_account) else null end,
    0,'Consignment in sale',(select auth.uid()),'consignment-in:' || p_id::text)
  returning id into v_sale_id;
  insert into public.sale_items(sale_id,kind,device_unit_id,name_snapshot,unit_cost,unit_price,qty)
  values (v_sale_id,'device',v_case.device_unit_id,v_case.model_snapshot,p_partner_share,p_sale_price,1);
  update public.consignments set status='sold_unpaid',sale_id=v_sale_id,sold_at=now()
    where id=p_id;
  return v_sale_id;
end;
$$;

create function public.rpc_consignment_pay_in(p_id uuid, p_payment_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_case public.consignments%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into v_case from public.consignments where id=p_id for update;
  if not found or v_case.direction <> 'in' then raise exception 'ไม่พบรายการฝากเข้า' using errcode='P0001'; end if;
  if v_case.status='paid' then return; end if;
  if v_case.status <> 'sold_unpaid' or p_payment_method is null
     or p_payment_method not in ('cash','transfer') then
    raise exception 'ยังจ่ายเจ้าของเครื่องไม่ได้' using errcode='P0001';
  end if;
  update public.consignments set status='paid',payout_method=p_payment_method,paid_at=now(),
    paid_by=(select auth.uid()) where id=p_id;
end;
$$;

create view public.v_pos_consignments with (security_invoker = false) as
select c.id,c.device_unit_id,c.direction,c.counterparty_name,c.status,c.listed_price,
  c.gross_sale_amount,c.partner_share,c.sale_id,c.payout_method,c.reported_at,
  c.sold_at,c.settled_at,c.paid_at,c.returned_at,c.created_at,
  c.imei_snapshot as imei,c.model_snapshot as model_name,d.acquisition,d.status as device_status,
  case when c.direction='out' and c.gross_sale_amount is not null
    then c.gross_sale_amount-c.partner_share else null end as receivable_amount
from public.consignments c join public.device_units d on d.id=c.device_unit_id
where public.pos_is_member();

-- Incoming consignment must be sold through the case RPC so its owner payout
-- becomes the sale's cost and obligation in the same transaction.
create or replace view public.v_pos_catalog with (security_invoker = false) as
select 'product'::text as kind,p.id,p.name,p.sku as code,p.price,p.qty,
  cat.name as category_name
from public.products p
left join public.categories cat on cat.id=p.category_id
where p.is_active and public.pos_is_member()
union all
select 'device'::text,d.id,d.model_name,d.imei,
  coalesce(d.sale_price,d.list_price),1,null
from public.device_units d
where d.status='in_stock' and d.acquisition <> 'consigned_in'
  and public.pos_is_member();

create view public.v_close_day_consignment_payouts with (security_invoker = false) as
select c.id,(c.paid_at at time zone 'Asia/Bangkok')::date as day,
  c.partner_share as amount,c.payout_method as paid_from
from public.consignments c
where c.direction='in' and c.status='paid' and public.pos_is_member();

revoke all on public.v_pos_consignments from public, anon, authenticated;
revoke all on public.v_close_day_consignment_payouts from public, anon, authenticated;
grant select on public.v_pos_consignments to authenticated;
grant select on public.v_close_day_consignment_payouts to authenticated;

revoke all on function public.rpc_consignment_open_out(uuid,text,numeric) from public,anon;
revoke all on function public.rpc_consignment_open_in(text,text,text,numeric) from public,anon;
revoke all on function public.rpc_consignment_return(uuid) from public,anon;
revoke all on function public.rpc_consignment_report_out(uuid,numeric,numeric) from public,anon;
revoke all on function public.rpc_consignment_settle_out(uuid,text,text) from public,anon;
revoke all on function public.rpc_consignment_sell_in(uuid,numeric,numeric,text,text) from public,anon;
revoke all on function public.rpc_consignment_pay_in(uuid,text) from public,anon;
grant execute on function public.rpc_consignment_open_out(uuid,text,numeric) to authenticated;
grant execute on function public.rpc_consignment_open_in(text,text,text,numeric) to authenticated;
grant execute on function public.rpc_consignment_return(uuid) to authenticated;
grant execute on function public.rpc_consignment_report_out(uuid,numeric,numeric) to authenticated;
grant execute on function public.rpc_consignment_settle_out(uuid,text,text) to authenticated;
grant execute on function public.rpc_consignment_sell_in(uuid,numeric,numeric,text,text) to authenticated;
grant execute on function public.rpc_consignment_pay_in(uuid,text) to authenticated;
