-- Source guards protect direct writes and legacy RPCs after opening.
create function public.ucom_cash_guard_source()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_op uuid; v_action text; v_epoch uuid; v_new jsonb; v_old jsonb;
  v_keys text[]; v_key text; v_changed boolean := false; v_table text := tg_table_name;
  v_id uuid; v_source public.ucom_cash_sources%rowtype;
begin
  select epoch into v_epoch from public.ucom_cash_book where id for update;
  if v_epoch is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'ใช้รายการแก้ไขพร้อมเหตุผลแทนการลบประวัติเงิน' using errcode='42501'; end if;
  v_new:=to_jsonb(new); v_old:=to_jsonb(old);
  v_keys:=case v_table
    when 'sales' then array['payment_method','bill_discount','client_uuid']
    when 'sale_items' then array['sale_id','unit_price','qty','item_discount','kind','topup_carrier_id']
    when 'expenses' then array['amount','paid_from']
    when 'shop_income' then array['amount','received_to']
    when 'repair_jobs' then array['part_cost','part_paid_at','part_paid_from']
    when 'consignments' then array['partner_share','payout_method','paid_at'] end;
  if v_table='repair_jobs' and v_new->>'part_paid_at' is null and v_old->>'part_paid_at' is null then return new; end if;
  if v_table='consignments' and v_new->>'paid_at' is null and v_old->>'paid_at' is null then return new; end if;
  foreach v_key in array v_keys loop
    if v_new->v_key is distinct from v_old->v_key then v_changed:=true; end if;
  end loop;
  if tg_op='UPDATE' and not v_changed then return new; end if;
  v_op:=nullif(current_setting('ucom.cash_operation',true),'')::uuid;
  select action into v_action from public.ucom_cash_operations
    where id=v_op and transaction_id=txid_current() and result is null and actor=auth.uid();
  if not found then raise exception 'ต้องใช้โปรแกรมรุ่นรองรับเงินสองกอง' using errcode='42501'; end if;
  v_id:=(v_new->>'id')::uuid;
  if v_table='sale_items' then
    if tg_op='UPDATE' and new.sale_id is distinct from old.sale_id then
      raise exception 'ย้ายรายการข้ามบิลไม่ได้' using errcode='42501'; end if;
    v_table:='sales'; v_id:=(v_new->>'sale_id')::uuid;
  end if;
  select * into v_source from public.ucom_cash_sources where source_table=v_table and source_id=v_id;
  if found then
    if v_source.booked and v_action<>'correct' then
      raise exception 'รายการจ่ายแล้วต้องแก้ไขโดยเจ้าของร้านพร้อมเหตุผล' using errcode='42501'; end if;
    update public.ucom_cash_sources set last_operation=v_op where source_table=v_table and source_id=v_id;
  else
    if tg_op='UPDATE' and not (v_table='repair_jobs' and v_old->>'part_paid_at' is null)
      and not (v_table='consignments' and v_old->>'paid_at' is null) then
      raise exception 'รายการก่อนเปิดระบบต้องกระทบยอดโดยเจ้าของร้าน' using errcode='P0001'; end if;
    if tg_table_name='sale_items' then
      raise exception 'บิลเก่าเพิ่มรายการเงินไม่ได้' using errcode='P0001'; end if;
    insert into public.ucom_cash_sources(source_table,source_id,original_operation,last_operation,fund)
      values(v_table,v_id,v_op,v_op,'transfer');
  end if;
  return new;
end $$;
revoke all on function public.ucom_cash_guard_source() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['sales','sale_items','expenses','shop_income','repair_jobs','consignments'] loop
    execute format('create trigger a_ucom_cash_source_guard before insert or update or delete on public.%I
      for each row execute function public.ucom_cash_guard_source()',t);
  end loop;
end $$;

-- Collection linkage is independent of paid-part accounting: never finalize a part twice.
create function public.ucom_cash_guard_repair_collection()
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
create trigger a_ucom_cash_repair_collection before insert or update on public.repair_jobs
  for each row execute function public.ucom_cash_guard_repair_collection();

-- Finalize after legacy RPC has finished inserting all sale items.
create function public.ucom_cash_finalize_sources(p_operation uuid,p_fund text,p_covered boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare s public.ucom_cash_sources%rowtype; v_amount numeric; v_method text; v_fund text;
begin
  for s in select * from public.ucom_cash_sources where last_operation=p_operation order by source_table,source_id loop
    case s.source_table
      when 'sales' then
        select coalesce((select sum(i.unit_price*i.qty-i.item_discount) from public.sale_items i where i.sale_id=x.id),0)
          -x.bill_discount,x.payment_method into v_amount,v_method from public.sales x where x.id=s.source_id;
      when 'expenses' then
        select -x.amount,x.paid_from into v_amount,v_method from public.expenses x where x.id=s.source_id;
      when 'shop_income' then
        select x.amount,x.received_to into v_amount,v_method from public.shop_income x where x.id=s.source_id;
      when 'repair_jobs' then
        select -coalesce(x.part_cost,0),x.part_paid_from into v_amount,v_method from public.repair_jobs x where x.id=s.source_id;
      when 'consignments' then
        select -coalesce(x.partner_share,0),x.payout_method into v_amount,v_method from public.consignments x where x.id=s.source_id;
    end case;
    if v_amount is null or v_amount<>round(v_amount,2) or v_amount in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
      or (s.source_table in ('sales','shop_income') and v_amount<0) then
      raise exception 'ยอดเงินต้นทางไม่ถูกต้อง' using errcode='22023'; end if;
    v_fund:=case when p_covered or v_method<>'cash' then 'transfer'
      when s.source_table in ('sales','shop_income') then 'pending' else p_fund end;
    if v_fund is null or v_fund not in ('drawer','pending','transfer') or v_method is null then
      raise exception 'ต้องระบุแหล่งเงินของรายการ' using errcode='22023'; end if;
    -- Only the net delta matters when correcting an existing fund; avoid transient
    -- shortages caused by withdrawing a receipt before replacing it.
    if s.booked and s.fund=v_fund then
      perform public.ucom_cash_post(p_operation,v_fund,v_amount-s.amount,s.source_table,s.source_id,s.original_operation);
    else
      if s.booked then perform public.ucom_cash_post(p_operation,s.fund,-s.amount,s.source_table,s.source_id,s.original_operation); end if;
      perform public.ucom_cash_post(p_operation,v_fund,v_amount,s.source_table,s.source_id,s.original_operation);
    end if;
    update public.ucom_cash_sources set fund=v_fund,amount=case when p_covered then 0 else v_amount end,booked=true
      where source_table=s.source_table and source_id=s.source_id;
  end loop;
end $$;
revoke all on function public.ucom_cash_finalize_sources(uuid,text,boolean) from public,anon,authenticated;

-- An active book must never use the legacy single-count closing endpoint.
create function public.ucom_cash_guard_legacy_closing()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.ucom_cash_book where id and epoch is not null)
    and not exists(select 1 from public.ucom_cash_operations where
      id=nullif(current_setting('ucom.cash_operation',true),'')::uuid and action='close'
      and actor=auth.uid() and transaction_id=txid_current() and result is null) then
    raise exception 'กรุณานับเงินแยกสองกองด้วยหน้าปิดร้านรุ่นใหม่' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function public.ucom_cash_guard_legacy_closing() from public,anon,authenticated;
create trigger day_closings_cash_cutover before insert or update on public.day_closings
  for each row execute function public.ucom_cash_guard_legacy_closing();
