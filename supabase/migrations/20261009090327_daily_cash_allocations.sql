-- ADR 0028. Install only on an unopened book; no guessed provenance/backfill.
begin;
-- Acquire the DDL table lock before a concurrent opener can hold a reader lock while waiting on the book row.
lock table public.ucom_cash_book in access exclusive mode;
do $$ begin
  perform 1 from public.ucom_cash_book where id for update;
  if exists(select 1 from public.ucom_cash_book where epoch is not null)
    or exists(select 1 from public.ucom_cash_operations)
    or exists(select 1 from public.ucom_cash_movements)
    or exists(select 1 from public.ucom_cash_sources)
    or exists(select 1 from public.ucom_cash_handovers) then
    raise exception 'Daily allocations require an unopened, empty cash book' using errcode='55000';
  end if;
end $$;
alter table public.ucom_cash_book add column day_allocations_enabled boolean not null default true;
alter table public.ucom_cash_sources add column receipt_day date;
alter table public.ucom_cash_sources add column day_frozen boolean not null default false;
alter table public.ucom_cash_handovers add column selected_lines jsonb;
alter table public.ucom_cash_handovers add column drawer_before_departure numeric;
create table public.ucom_cash_origins (
  id uuid primary key default gen_random_uuid(),
  movement_sequence bigint not null unique references public.ucom_cash_movements(sequence),
  receipt_day date,
  kind text not null check(kind in ('receipt','opening','reconciliation')),
  source_table text,
  source_id uuid,
  reason text,
  check((kind='receipt') = (receipt_day is not null))
);
create table public.ucom_cash_allocations (
  sequence bigint generated always as identity primary key,
  operation_id uuid not null references public.ucom_cash_operations(id),
  origin_id uuid not null references public.ucom_cash_origins(id),
  movement_sequence bigint references public.ucom_cash_movements(sequence),
  available_delta numeric not null default 0,
  reserved_delta numeric not null default 0,
  handover_id uuid references public.ucom_cash_handovers(id),
  reverses bigint references public.ucom_cash_allocations(sequence),
  check(available_delta<>0 or reserved_delta<>0),
  check(available_delta=round(available_delta,2) and reserved_delta=round(reserved_delta,2)),
  check(available_delta not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)
    and reserved_delta not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
);
create index ucom_cash_allocation_origin on public.ucom_cash_allocations(origin_id,sequence);
create index ucom_cash_allocation_handover on public.ucom_cash_allocations(handover_id,origin_id);
create index ucom_cash_allocation_reversal on public.ucom_cash_allocations(reverses) where reverses is not null;
alter table public.ucom_cash_origins enable row level security;
alter table public.ucom_cash_allocations enable row level security;
revoke all on public.ucom_cash_origins,public.ucom_cash_allocations from public,anon,authenticated;
revoke all on sequence public.ucom_cash_allocations_sequence_seq from public,anon,authenticated;
create trigger ucom_cash_origins_immutable before update or delete on public.ucom_cash_origins
  for each row execute function public.ucom_cash_immutable();
create trigger ucom_cash_allocations_immutable before update or delete on public.ucom_cash_allocations
  for each row execute function public.ucom_cash_immutable();

create function public.ucom_cash_guard_committed_operation()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.result is not null or tg_op='DELETE' then
    raise exception 'Committed cash operation is immutable' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function public.ucom_cash_guard_committed_operation() from public,anon,authenticated;
create trigger ucom_cash_operations_immutable before update or delete on public.ucom_cash_operations
  for each row execute function public.ucom_cash_guard_committed_operation();

create function public.ucom_cash_guard_frozen_source_day()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.day_frozen and (new.receipt_day is distinct from old.receipt_day or not new.day_frozen) then
    raise exception 'Frozen receipt day is immutable' using errcode='42501'; end if;
  return new;
end $$;
revoke all on function public.ucom_cash_guard_frozen_source_day() from public,anon,authenticated;
create trigger ucom_cash_sources_frozen_day before update on public.ucom_cash_sources
  for each row execute function public.ucom_cash_guard_frozen_source_day();

create function public.ucom_cash_origin_key(p_id uuid,p_day date,p_kind text)
returns text language sql immutable set search_path='' as $$
  select case when p_day is not null then 'date:'||p_day::text else p_kind||':'||p_id::text end
$$;
revoke all on function public.ucom_cash_origin_key(uuid,date,text) from public,anon,authenticated;

create function public.ucom_cash_origin_balances()
returns table(id uuid,movement_sequence bigint,receipt_day date,kind text,source_table text,
  source_id uuid,key text,available numeric,reserved numeric)
language sql stable security definer set search_path='' as $$
  select o.id,o.movement_sequence,o.receipt_day,o.kind,o.source_table,o.source_id,
    public.ucom_cash_origin_key(o.id,o.receipt_day,o.kind),
    coalesce(sum(a.available_delta),0),coalesce(sum(a.reserved_delta),0)
  from public.ucom_cash_origins o left join public.ucom_cash_allocations a on a.origin_id=o.id
  group by o.id
$$;
revoke all on function public.ucom_cash_origin_balances() from public,anon,authenticated;

create function public.ucom_cash_assert_allocations()
returns void language plpgsql security definer set search_path='' as $$
declare b jsonb; a numeric; r numeric;
begin
  b:=public.ucom_cash_balances();
  select coalesce(sum(available),0),coalesce(sum(reserved),0) into a,r from public.ucom_cash_origin_balances();
  if a<>(b->>'available')::numeric or r<>(b->>'reserved')::numeric
    or a+r<>(b->>'pending')::numeric
    or exists(select 1 from public.ucom_cash_origin_balances() where available<0 or reserved<0)
    or exists(select 1 from public.ucom_cash_movements m left join public.ucom_cash_allocations j
      on j.movement_sequence=m.sequence where m.fund='pending'
      group by m.sequence,m.amount having coalesce(sum(j.available_delta+j.reserved_delta),0)<>m.amount)
    or exists(select 1 from public.ucom_cash_allocations d where d.available_delta<0 and
      (select coalesce(sum(x.available_delta),0) from public.ucom_cash_allocations x where x.reverses=d.sequence)>-d.available_delta)
    or exists(select 1 from public.ucom_cash_handovers h left join public.ucom_cash_allocations j on j.handover_id=h.id
      group by h.id having coalesce(sum(j.reserved_delta),0)<>case when h.state='handed_over' then h.amount else 0 end)
    then raise exception 'Cash allocation conservation failed' using errcode='23514'; end if;
end $$;
revoke all on function public.ucom_cash_assert_allocations() from public,anon,authenticated;

-- Same posting signature, all pending writers share this attribution boundary.
create or replace function public.ucom_cash_post(p_operation uuid,p_fund text,p_amount numeric,
  p_source_table text default null,p_source_id uuid default null,
  p_source_operation uuid default null,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_balance numeric; v_reserved numeric; v_sequence bigint; v_origin uuid;
  v_left numeric; v_take numeric; v_day date; v_kind text; o public.ucom_cash_operations%rowtype; x record;
begin
  if p_amount=0 or p_fund='transfer' then return; end if;
  if p_fund is null or p_fund not in ('drawer','pending') or p_amount is null
    or p_amount<>round(p_amount,2) or p_amount in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then
    raise exception 'จำนวนเงินหรือแหล่งเงินไม่ถูกต้อง' using errcode='22023'; end if;
  perform 1 from public.ucom_cash_book where id for update;
  select * into o from public.ucom_cash_operations where id=p_operation and result is null
    and transaction_id=txid_current() and actor=auth.uid();
  if not found then raise exception 'Posting requires the current authorized operation' using errcode='42501'; end if;
  select coalesce(sum(m.amount),0) into v_balance from public.ucom_cash_movements m where m.fund=p_fund;
  select coalesce(sum(h.amount),0) into v_reserved from public.ucom_cash_handovers h
    where h.state='handed_over' and p_fund='pending';
  if v_balance+p_amount-v_reserved<0 then raise exception 'เงินที่ใช้ได้ในกองนี้ไม่พอ' using errcode='P0001'; end if;
  insert into public.ucom_cash_movements(operation_id,fund,amount,source_table,source_id,source_operation_id,reason)
    values(p_operation,p_fund,p_amount,p_source_table,p_source_id,p_source_operation,p_reason) returning sequence into v_sequence;
  if p_fund<>'pending' then return; end if;
  v_left:=abs(p_amount);
  if p_amount>0 and p_source_table in ('expenses','repair_jobs','consignments') then
    -- Restore original, still-unreversed spending slices; never mint a new receipt.
    for x in select d.sequence,d.origin_id,-d.available_delta-coalesce((select sum(z.available_delta)
      from public.ucom_cash_allocations z where z.reverses=d.sequence),0) as remaining
      from public.ucom_cash_allocations d join public.ucom_cash_movements m on m.sequence=d.movement_sequence
      join public.ucom_cash_origins i on i.id=d.origin_id
      where m.source_table=p_source_table and m.source_id=p_source_id and d.available_delta<0
      order by i.receipt_day nulls first,i.movement_sequence,i.id,d.sequence loop
      v_take:=least(v_left,x.remaining);
      if v_take>0 then insert into public.ucom_cash_allocations(operation_id,origin_id,movement_sequence,available_delta,reverses)
        values(p_operation,x.origin_id,v_sequence,v_take,x.sequence); v_left:=v_left-v_take; end if;
      exit when v_left=0;
    end loop;
  elsif p_amount>0 then
    if p_source_table in ('sales','shop_income') then
      select receipt_day into v_day from public.ucom_cash_sources where source_table=p_source_table
        and source_id=p_source_id and day_frozen;
      if v_day is null then raise exception 'Receipt day has not been finalized' using errcode='23514'; end if;
      v_kind:='receipt';
    else v_kind:=case when o.action='open' then 'opening' else 'reconciliation' end; end if;
    insert into public.ucom_cash_origins(movement_sequence,receipt_day,kind,source_table,source_id,reason)
      values(v_sequence,v_day,v_kind,p_source_table,p_source_id,p_reason) returning id into v_origin;
    insert into public.ucom_cash_allocations(operation_id,origin_id,movement_sequence,available_delta)
      values(p_operation,v_origin,v_sequence,p_amount); v_left:=0;
  elsif o.action='settle' and p_source_table='handover' and p_source_id=(o.payload->>'handoverId')::uuid then
    for x in select i.id,coalesce(sum(j.reserved_delta),0) as reserved from public.ucom_cash_origins i
      join public.ucom_cash_allocations j on j.origin_id=i.id where j.handover_id=p_source_id
      group by i.id order by i.receipt_day nulls first,i.movement_sequence,i.id loop
      v_take:=least(v_left,x.reserved);
      if v_take>0 then insert into public.ucom_cash_allocations(operation_id,origin_id,movement_sequence,reserved_delta,handover_id)
        values(p_operation,x.id,v_sequence,-v_take,p_source_id); v_left:=v_left-v_take; end if;
      exit when v_left=0;
    end loop;
  else
    for x in select i.* from public.ucom_cash_origin_balances() i where i.available>0
      and (o.action<>'handover_days' or exists(select 1 from jsonb_array_elements(o.payload->'lines') l where l->>'key'=i.key))
      order by case when p_source_table in ('sales','shop_income') and i.source_table=p_source_table and i.source_id=p_source_id then 0 else 1 end,
        i.receipt_day nulls first,i.movement_sequence,i.id loop
      v_take:=least(v_left,x.available);
      insert into public.ucom_cash_allocations(operation_id,origin_id,movement_sequence,available_delta)
        values(p_operation,x.id,v_sequence,-v_take); v_left:=v_left-v_take;
      exit when v_left=0;
    end loop;
  end if;
  if v_left<>0 then raise exception 'เงินที่ใช้ได้หรือยอดย้อนรายการไม่พอ' using errcode='P0001'; end if;
end $$;

create function public.ucom_cash_release_handover(p_operation uuid,p_handover uuid)
returns void language plpgsql security definer set search_path='' as $$
declare x record;
begin
  for x in select origin_id,sum(reserved_delta) as amount from public.ucom_cash_allocations
    where handover_id=p_handover group by origin_id having sum(reserved_delta)>0 loop
    insert into public.ucom_cash_allocations(operation_id,origin_id,available_delta,reserved_delta,handover_id)
      values(p_operation,x.origin_id,x.amount,-x.amount,p_handover);
  end loop;
end $$;
revoke all on function public.ucom_cash_release_handover(uuid,uuid) from public,anon,authenticated;

create function public.ucom_cash_depart_days(p_operation uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_total numeric:=0; v_drawer numeric; v_lines jsonb:='[]'; l jsonb; x record; v_available numeric;
begin
  if jsonb_typeof(p_payload->'lines') is distinct from 'array' or jsonb_array_length(p_payload->'lines')=0
    or p_payload->>'drawerPhysicallySeparated' is distinct from 'true'
    or coalesce(length(trim(p_payload->>'custodian')),0) not between 1 and 120
    or (select count(*) from jsonb_array_elements(p_payload->'lines')) <>
      (select count(distinct e.line->>'key') from jsonb_array_elements(p_payload->'lines') e(line)) then
    raise exception 'เลือกวันที่ ยืนยันเงินแยกเข้าเก๊ะ และผู้ถือเงินให้ครบ' using errcode='22023'; end if;
  for l in select * from jsonb_array_elements(p_payload->'lines') loop
    select sum(available) into v_available from public.ucom_cash_origin_balances() where key=l->>'key';
    if v_available is null or v_available<=0 or public.ucom_cash_money(l->>'amount')<>v_available then
      raise exception 'ยอดรายวันเปลี่ยนแล้ว กรุณาโหลดใหม่' using errcode='40001'; end if;
    v_total:=v_total+v_available;
  end loop;
  for x in select key,receipt_day,kind,sum(available) as amount,min(movement_sequence) as first_sequence
    from public.ucom_cash_origin_balances() i where exists(select 1 from jsonb_array_elements(p_payload->'lines') e(line) where e.line->>'key'=i.key)
    group by key,receipt_day,kind order by receipt_day nulls first,min(movement_sequence),key loop
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object('key',x.key,'receiptDay',x.receipt_day,
      'kind',case when x.receipt_day is null then x.kind else 'date' end,'amount',x.amount::text));
  end loop;
  v_drawer:=public.ucom_cash_money(p_payload->>'drawerBeforeDeparture');
  if v_drawer>=v_total then raise exception 'ยอดนำฝากต้องมากกว่า 0' using errcode='22023'; end if;
  perform public.ucom_cash_post(p_operation,'pending',-v_drawer,null,null,null,'เศษแยกเข้าเก๊ะก่อนนำฝาก');
  perform public.ucom_cash_post(p_operation,'drawer',v_drawer,null,null,null,'เศษแยกเข้าเก๊ะก่อนนำฝาก');
  insert into public.ucom_cash_handovers(id,reporter,custodian,amount,selected_lines,drawer_before_departure)
    values(p_operation,auth.uid(),trim(p_payload->>'custodian'),v_total-v_drawer,v_lines,v_drawer);
  for x in select * from public.ucom_cash_origin_balances() i where i.available>0 and exists(
    select 1 from jsonb_array_elements(p_payload->'lines') e(line) where e.line->>'key'=i.key)
    order by receipt_day nulls first,movement_sequence,id loop
    insert into public.ucom_cash_allocations(operation_id,origin_id,available_delta,reserved_delta,handover_id)
      values(p_operation,x.id,-x.available,x.available,p_operation);
  end loop;
end $$;
revoke all on function public.ucom_cash_depart_days(uuid,jsonb) from public,anon,authenticated;

create function public.ucom_cash_handover_json(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',h.id,'amount',h.amount::text,'custodian',h.custodian,'reporter',h.reporter,
    'state',h.state,'createdAt',h.created_at,'bank',h.bank::text,'drawer',h.drawer::text,'returned',h.returned::text,
    'depositedAt',h.deposited_at,'evidencePath',h.evidence_path,'reviewNote',h.review_note,
    'selectedLines',h.selected_lines,'drawerBeforeDeparture',h.drawer_before_departure::text,
    'selectedTotal',(h.amount+h.drawer_before_departure)::text,'bankBound',h.amount::text,'snapshot',h.snapshot)
  from public.ucom_cash_handovers h where h.id=p_id
$$;
revoke all on function public.ucom_cash_handover_json(uuid) from public,anon,authenticated;

create function public.rpc_cash_handover(p_handover_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  return public.ucom_cash_handover_json(p_handover_id);
end $$;
revoke all on function public.rpc_cash_handover(uuid) from public,anon;
grant execute on function public.rpc_cash_handover(uuid) to authenticated;

create function public.rpc_cash_operation_snapshot(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.ucom_cash_operations%rowtype;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into o from public.ucom_cash_operations where id=p_operation_id and result is not null;
  if not found then return null; end if;
  -- Member inspection of committed events is not authority to replay another actor's intent.
  if o.actor<>auth.uid() and o.result->'snapshot'->>'eventOperationId' is null then
    raise exception 'ไม่มีสิทธิ์อ่านคำขอของบัญชีอื่น' using errcode='42501'; end if;
  return o.result||jsonb_build_object('operationId',o.id,'actorId',o.actor,'epoch',o.epoch,'action',o.action,
    'payload',case when o.actor=auth.uid() then o.payload else null end,'result',o.result);
end $$;
revoke all on function public.rpc_cash_operation_snapshot(uuid) from public,anon;
grant execute on function public.rpc_cash_operation_snapshot(uuid) to authenticated;

create function public.rpc_cash_pending_days(p_version bigint default null,p_after jsonb default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.ucom_cash_book%rowtype; v_lines jsonb; v_cursor jsonb; v_offset integer:=0; v_count bigint;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  select * into b from public.ucom_cash_book where id for update;
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid page size' using errcode='22023'; end if;
  if p_version is not null and p_version<>b.version then raise exception 'ยอดเปลี่ยนแล้ว กรุณาโหลดใหม่' using errcode='40001'; end if;
  if p_after is not null then
    if jsonb_typeof(p_after)<>'object' or p_after->>'epoch' is distinct from b.epoch::text
      or (p_after->>'version')::bigint is distinct from b.version or p_after->>'key' is null then
      raise exception 'ยอดเปลี่ยนแล้ว กรุณาโหลดใหม่' using errcode='40001'; end if;
    with lines as (select key,receipt_day,min(movement_sequence) as q from public.ucom_cash_origin_balances()
      group by key,receipt_day having sum(available)+sum(reserved)>0), ordered as (
      select key,row_number() over(order by receipt_day nulls first,q,key) as n from lines)
      select n::integer into v_offset from ordered where key=p_after->>'key';
    if v_offset is null then raise exception 'Invalid cash day cursor' using errcode='22023'; end if;
  end if;
  with lines as (select key,receipt_day,kind,min(movement_sequence) as q,sum(available) as a,sum(reserved) as r
    from public.ucom_cash_origin_balances() group by key,receipt_day,kind having sum(available)+sum(reserved)>0),
    page as(select * from lines order by receipt_day nulls first,q,key offset v_offset limit p_limit),
    ordered as(select *,row_number() over(order by receipt_day nulls first,q,key) as n from lines)
    select coalesce((select jsonb_agg(jsonb_build_object('key',key,'receiptDay',receipt_day,
      'kind',case when receipt_day is null then kind else 'date' end,'available',a::text,'reserved',r::text)
      order by receipt_day nulls first,q,key) from page),'[]'),(select count(*) from lines),
      (select jsonb_build_object('key',key,'epoch',b.epoch,'version',b.version) from ordered where n=v_offset+p_limit)
    into v_lines,v_count,v_cursor;
  return public.ucom_cash_balances()||jsonb_build_object('epoch',b.epoch,'version',b.version,'asOf',clock_timestamp(),
    'lines',v_lines,'nextCursor',case when v_count>v_offset+p_limit then v_cursor else null end);
end $$;
revoke all on function public.rpc_cash_pending_days(bigint,jsonb,integer) from public,anon;
grant execute on function public.rpc_cash_pending_days(bigint,jsonb,integer) to authenticated;

create or replace function public.ucom_cash_guard_source()
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
  if tg_op='UPDATE' and v_table in ('sales','shop_income') and exists(select 1 from public.ucom_cash_sources where source_table=v_table and source_id=(v_new->>'id')::uuid and day_frozen) and (case when v_table='sales' then v_new->'sold_at' is distinct from v_old->'sold_at' else v_new->'received_at' is distinct from v_old->'received_at' end) then raise exception 'วันที่รับเงินถูกตรึงแล้ว แก้ไม่ได้' using errcode='42501'; end if;
  v_keys:=case v_table
    when 'sales' then array['payment_method','bill_discount','client_uuid','sold_at']
    when 'sale_items' then array['sale_id','unit_price','qty','item_discount','kind','topup_carrier_id']
    when 'expenses' then array['amount','paid_from']
    when 'shop_income' then array['amount','received_to','received_at']
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

create or replace function public.ucom_cash_finalize_sources(p_operation uuid,p_fund text,p_covered boolean default false)
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
    if not s.day_frozen and s.source_table in ('sales','shop_income') then
      update public.ucom_cash_sources set receipt_day=case when s.source_table='sales' then (select (sold_at at time zone 'Asia/Bangkok')::date from public.sales where id=s.source_id) else (select received_at from public.shop_income where id=s.source_id) end,day_frozen=true where source_table=s.source_table and source_id=s.source_id;
    end if;
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


create or replace function public.rpc_cash_execute(p_operation_id uuid,p_epoch uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.ucom_cash_book%rowtype; o public.ucom_cash_operations%rowtype;
  h public.ucom_cash_handovers%rowtype; s public.ucom_cash_sources%rowtype;
  v_id uuid; v_amount numeric; v_bank numeric; v_drawer numeric; v_return numeric;
  v_fund text; v_method text; v_snapshot jsonb; v_result jsonb;
  v_today date := (now() at time zone 'Asia/Bangkok')::date; v_revision integer; v_item jsonb;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  if p_operation_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'ข้อมูลคำขอไม่ถูกต้อง' using errcode='22023'; end if;
  if p_action in ('open','correct','adjust','review','reminder','covered_sale') and not public.pos_is_owner() then
    raise exception 'เฉพาะเจ้าของร้าน' using errcode='42501'; end if;
  select * into b from public.ucom_cash_book where id for update;
  select * into o from public.ucom_cash_operations where id=p_operation_id;
  if found then
    if p_action='sale' and o.action='covered_sale' and o.payload->>'originalActor'=auth.uid()::text
      and o.payload->'payload'=p_payload->'payload' then return o.result; end if;
    if o.actor<>auth.uid() or o.action<>p_action or o.payload<>p_payload or o.epoch is distinct from p_epoch then
      raise exception 'เลขคำขอซ้ำแต่ข้อมูลไม่ตรงกัน' using errcode='22023'; end if;
    return o.result;
  end if;
  -- Already-recorded pre-cutover replay does not add opening-covered cash.
  if p_action='sale' then
    select x.id into v_id from public.sales x
      where x.client_uuid=p_payload->'payload'->>'client_uuid'
        and not exists(select 1 from public.ucom_cash_sources z where z.source_table='sales' and z.source_id=x.id)
        and (x.created_by=auth.uid() or public.pos_is_owner());
    if found then return jsonb_build_object('id',v_id,'openingCovered',true); end if;
  end if;
  if p_action='open' then
    if not b.day_allocations_enabled then raise exception 'ต้องติดตั้งการจัดสรรรายวันก่อนเปิดระบบ' using errcode='42501'; end if;
    if not b.activation_ready then raise exception 'ยังไม่อนุมัติเปิดระบบหลังตรวจครบทุกช่องทาง' using errcode='42501'; end if;
    if b.epoch is not null or p_epoch is not null or p_payload->>'queueDrained' is distinct from 'true'
      or p_payload->>'physicallyPaused' is distinct from 'true' or nullif(trim(p_payload->>'reason'),'') is null then
      raise exception 'ต้องหยุดรับเงิน ซิงก์ทุกบิล และนับยอดตั้งต้นก่อนเปิดระบบ' using errcode='P0001'; end if;
  elsif b.epoch is null or p_epoch is distinct from b.epoch then
    raise exception 'รอบเปิดระบบไม่ตรงกัน ต้องให้เจ้าของร้านจัดประเภทบิลค้างก่อน' using errcode='P0001';
  end if;
  insert into public.ucom_cash_operations(id,epoch,actor,action,payload)
    values(p_operation_id,p_epoch,auth.uid(),p_action,p_payload);
  perform set_config('ucom.cash_operation',p_operation_id::text,true);
  v_fund:=p_payload->>'fund';
  if p_action in ('expense','income','part','consign_pay','correct') then
    if v_fund is null or v_fund not in ('drawer','pending','transfer') then
      raise exception 'ต้องเลือกแหล่งเงิน' using errcode='22023'; end if;
    v_method:=case when v_fund='transfer' then 'transfer' else 'cash' end;
  end if;
  if p_action='handover' then raise exception 'กรุณาโหลดโปรแกรมใหม่และเลือกวันนำฝาก' using errcode='40001'; end if;
  if p_action in ('handover_days','close') then
    if not b.receiving_paused or b.ack_version is distinct from b.version then
      raise exception 'กรุณาพักรับเงินและซิงก์คิวจากเครื่องหลักก่อน' using errcode='P0001'; end if;
    if (p_payload->>'version')::bigint is distinct from b.version then
      raise exception 'ยอดเปลี่ยนแล้ว กรุณาโหลดใหม่และนับอีกครั้ง' using errcode='40001'; end if;
  end if;
  if p_action in ('sale','repair_close','consign_sell','consign_settle','income') and b.receiving_paused then
    raise exception 'พักรับเงินอยู่ กรุณากลับมารับเงินที่เครื่องหลักก่อน' using errcode='P0001'; end if;
  if p_action in ('sale','repair_close','consign_sell','consign_settle','income') and
    ((p_payload->>'device')::uuid is distinct from b.receiving_device
      or b.device_key_hash is distinct from sha256(convert_to(p_payload->>'deviceToken','UTF8'))) then
    raise exception 'ต้องรับเงินจากเครื่องหลักที่กำหนด' using errcode='42501'; end if;
  if p_action in ('sale','repair_close','covered_sale') then
    -- Validate BEFORE legacy numeric(12,2) variables can silently round inputs.
    perform public.ucom_cash_money(coalesce(p_payload->'payload'->>'bill_discount','0'));
    for v_item in select * from jsonb_array_elements(p_payload->'payload'->'items') loop
      perform public.ucom_cash_money(v_item->>'unit_price');
      perform public.ucom_cash_money(coalesce(v_item->>'item_discount','0'));
    end loop;
  end if;
  case p_action
    when 'open' then
      if p_payload->>'deviceToken' is null or p_payload->>'deviceToken' !~ '^[0-9a-f]{64}$' then
        raise exception 'ต้องยืนยันเครื่องรับเงินหลัก' using errcode='22023'; end if;
      update public.ucom_cash_book set epoch=gen_random_uuid(),receiving_device=(p_payload->>'device')::uuid,
        device_key_hash=sha256(convert_to(p_payload->>'deviceToken','UTF8')),
        opened_at=clock_timestamp(),opened_by=auth.uid() where id;
      if (p_payload->>'device') is null then raise exception 'ต้องระบุเครื่องรับเงินหลัก' using errcode='22023'; end if;
      perform public.ucom_cash_post(p_operation_id,'drawer',public.ucom_cash_money(p_payload->>'drawer'),null,null,null,p_payload->>'reason');
      perform public.ucom_cash_post(p_operation_id,'pending',public.ucom_cash_money(p_payload->>'pending'),null,null,null,p_payload->>'reason');
    when 'handover_days' then
      perform public.ucom_cash_depart_days(p_operation_id,p_payload);
    when 'handover' then
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 or v_amount>(public.ucom_cash_balances()->>'available')::numeric then
        raise exception 'เงินรอฝากที่ใช้ได้ไม่พอ' using errcode='P0001'; end if;
      insert into public.ucom_cash_handovers(id,reporter,custodian,amount)
        values(p_operation_id,auth.uid(),trim(p_payload->>'custodian'),v_amount);
    when 'settle' then
      select * into h from public.ucom_cash_handovers where id=(p_payload->>'handoverId')::uuid for update;
      if not found or h.state<>'handed_over' or (h.reporter<>auth.uid() and not public.pos_is_owner()) then
        raise exception 'รายการส่งมอบนี้บันทึกฝากซ้ำไม่ได้' using errcode='P0001'; end if;
      v_bank:=public.ucom_cash_money(p_payload->>'bank'); v_drawer:=public.ucom_cash_money(p_payload->>'drawer');
      v_return:=public.ucom_cash_money(p_payload->>'returned');
      if v_bank<=0 or h.amount<>v_bank+v_drawer+v_return or p_payload->>'physicallyReturned' is distinct from 'true'
        or not coalesce(public.ucom_cash_evidence_valid(h.id,p_payload->>'evidencePath'),false)
        or (p_payload->>'depositedAt')::timestamptz is null
        or (p_payload->>'depositedAt')::timestamptz<h.created_at
        or (p_payload->>'depositedAt')::timestamptz>clock_timestamp()+interval '5 minutes' then
        raise exception 'ตรวจยอดคืนเงิน วันฝาก และสลิปให้ครบก่อนบันทึก' using errcode='22023'; end if;
      update public.ucom_cash_handovers set state='reported',bank=v_bank,drawer=v_drawer,returned=v_return,
        deposited_at=(p_payload->>'depositedAt')::timestamptz,evidence_path=p_payload->>'evidencePath' where id=h.id;
      perform public.ucom_cash_post(p_operation_id,'pending',-v_bank,'handover',h.id,h.id,'ฝากธนาคาร');
      perform public.ucom_cash_post(p_operation_id,'pending',-v_drawer,'handover',h.id,h.id,'เงินคืนเข้าเก๊ะหลังนำฝาก');
      perform public.ucom_cash_post(p_operation_id,'drawer',v_drawer,'handover',h.id,h.id);
      perform public.ucom_cash_release_handover(p_operation_id,h.id);
      v_id:=h.id;
    when 'return' then
      update public.ucom_cash_handovers set state='returned',review_note=p_payload->>'reason'
        where id=(p_payload->>'handoverId')::uuid and state='handed_over'
          and (reporter=auth.uid() or public.pos_is_owner()) and p_payload->>'physicallyReturned'='true'
          and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'ต้องคืนเงินทั้งหมดจริงก่อนยกเลิก' using errcode='P0001'; end if;
      perform public.ucom_cash_release_handover(p_operation_id,v_id);
    when 'review' then
      update public.ucom_cash_handovers set state=case when (p_payload->>'confirmed')::boolean then 'confirmed' else 'disputed' end,
        review_note=p_payload->>'reason',reviewer=auth.uid(),reviewed_at=clock_timestamp()
        where id=(p_payload->>'handoverId')::uuid and state in ('reported','disputed')
          and p_payload->>'confirmed' in ('true','false') and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'ตรวจสอบรายการฝากนี้ไม่ได้' using errcode='P0001'; end if;
    when 'evidence' then
      update public.ucom_cash_handovers set evidence_path=p_payload->>'evidencePath',state='reported',review_note=p_payload->>'reason'
        where id=(p_payload->>'handoverId')::uuid and state='disputed'
          and (reporter=auth.uid() or public.pos_is_owner())
          and coalesce(public.ucom_cash_evidence_valid(id,p_payload->>'evidencePath'),false)
          and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'แนบหลักฐานใหม่ไม่ได้' using errcode='P0001'; end if;
    when 'close' then
      v_drawer:=public.ucom_cash_money(p_payload->>'drawerCount'); v_return:=public.ucom_cash_money(p_payload->>'pendingCount');
      perform public.rpc_close_day(v_drawer+v_return,left(coalesce(p_payload->>'note',''),1000));
      select coalesce(max(revision),0)+1 into v_revision from public.ucom_cash_closings where closing_date=v_today;
      v_snapshot:=public.ucom_cash_balances() || jsonb_build_object('id',p_operation_id,'date',v_today,'revision',v_revision,
        'asOf',clock_timestamp(),'version',b.version+1,'drawerCount',v_drawer::text,'pendingCount',v_return::text,
        'drawerVariance',(v_drawer-(public.ucom_cash_balances()->>'drawer')::numeric)::text,
        'pendingVariance',(v_return-(public.ucom_cash_balances()->>'available')::numeric)::text,
        'note',left(coalesce(p_payload->>'note',''),1000),'daily',public.rpc_close_day_digest(v_today));
      insert into public.ucom_cash_closings(id,closing_date,revision,snapshot) values(p_operation_id,v_today,v_revision,v_snapshot);
    when 'adjust' then
      if nullif(trim(p_payload->>'reason'),'') is null or p_payload->>'kind' is null
        or p_payload->>'kind' not in ('reconciliation','refund') or v_fund is null or v_fund not in ('drawer','pending')
        or not exists(select 1 from public.ucom_cash_operations where id=(p_payload->>'sourceOperationId')::uuid and result is not null) then
        raise exception 'ต้องอ้างอิงรายการต้นทางและเหตุผลการปรับเงิน' using errcode='22023'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount',true);
      if v_amount=0 or (p_payload->>'kind'='refund' and v_amount>=0) then raise exception 'ยอดคืนเงินไม่ถูกต้อง' using errcode='22023'; end if;
      if p_payload->>'kind'='refund' then
        select coalesce(sum(x.amount),0) into v_bank from public.ucom_cash_sources x
          where x.original_operation=(p_payload->>'sourceOperationId')::uuid and x.booked
            and x.source_table in ('sales','shop_income') and x.fund<>'transfer' and x.amount>0;
        select coalesce(sum(m.amount),0) into v_return from public.ucom_cash_movements m
          join public.ucom_cash_operations x on x.id=m.operation_id where x.action='adjust'
            and x.payload->>'kind'='refund' and m.source_operation_id=(p_payload->>'sourceOperationId')::uuid;
        if v_bank+v_return+v_amount<0 then raise exception 'ยอดคืนเกินเงินสดที่ต้นทางรับไว้' using errcode='22023'; end if;
      end if;
      perform public.ucom_cash_post(p_operation_id,v_fund,v_amount,null,null,(p_payload->>'sourceOperationId')::uuid,(p_payload->>'kind')||': '||(p_payload->>'reason'));
    when 'sale' then
      if p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text then
        raise exception 'เลขบิลไม่ตรงกับเลขคำขอ' using errcode='22023'; end if;
      if p_payload->'payload'->>'cash_epoch' is distinct from b.epoch::text then
        raise exception 'บิลค้างก่อนเปิดระบบต้องจัดประเภทโดยเจ้าของร้าน' using errcode='P0001'; end if;
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then
        raise exception 'ต้องรับเงินจากเครื่องหลักที่กำหนด' using errcode='P0001'; end if;
      v_id:=public.rpc_create_sale(p_payload->'payload');
    when 'covered_sale' then
      if nullif(trim(p_payload->>'reason'),'') is null or p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text
        or not exists(select 1 from public.profiles where id=(p_payload->>'originalActor')::uuid and role in ('owner','staff')) then
        raise exception 'ต้องจัดประเภทบิลพร้อมเหตุผลและเลขเดิม' using errcode='22023'; end if;
      v_id:=public.rpc_create_sale(p_payload->'payload');
      update public.sales set created_by=(p_payload->>'originalActor')::uuid where id=v_id;
    when 'expense' then
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 or length(trim(p_payload->>'name')) not between 1 and 200 then raise exception 'ข้อมูลรายจ่ายไม่ถูกต้อง' using errcode='22023'; end if;
      if p_payload->>'date' is not null and not public.pos_is_owner() then raise exception 'เฉพาะเจ้าของร้านเลือกวันที่ได้' using errcode='42501'; end if;
      insert into public.expenses(name,amount,spent_at,paid_from,created_by)
        values(trim(p_payload->>'name'),v_amount,coalesce((p_payload->>'date')::date,v_today),v_method,auth.uid()) returning id into v_id;
    when 'income' then
      if v_fund='drawer' then raise exception 'รายรับเงินสดเข้ากองรอฝาก' using errcode='22023'; end if;
      v_id:=public.rpc_add_shop_income(p_payload->>'name',public.ucom_cash_money(p_payload->>'amount'),v_method);
    when 'part' then
      if exists(select 1 from public.repair_jobs where id=(p_payload->>'id')::uuid and part_paid_at is not null) then
        raise exception 'อะไหล่จ่ายแล้วต้องแก้ไขโดยเจ้าของร้าน' using errcode='P0001'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 then raise exception 'ยอดจ่ายต้องมากกว่า 0' using errcode='22023'; end if;
      perform public.rpc_set_part_cost((p_payload->>'id')::uuid,v_amount,v_method); v_id:=(p_payload->>'id')::uuid;
    when 'repair_close' then
      if p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text then
        raise exception 'เลขบิลซ่อมไม่ตรงกับเลขคำขอ' using errcode='22023'; end if;
      if exists(select 1 from public.sales where client_uuid=p_operation_id::text)
        and not exists(select 1 from public.repair_jobs r join public.sales x on x.id=r.sale_id
          where r.id=(p_payload->>'id')::uuid and r.status='collected' and x.client_uuid=p_operation_id::text) then
        raise exception 'นำบิลอื่นมาปิดงานซ่อมนี้ไม่ได้' using errcode='22023'; end if;
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_close_repair_job((p_payload->>'id')::uuid,p_payload->'payload');
    when 'consign_sell' then
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_consignment_sell_in((p_payload->>'id')::uuid,public.ucom_cash_money(p_payload->>'amount'),
        public.ucom_cash_money(p_payload->>'share'),p_payload->>'method',p_payload->>'account');
    when 'consign_settle' then
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_consignment_settle_out((p_payload->>'id')::uuid,p_payload->>'method',p_payload->>'account');
    when 'consign_pay' then
      perform public.rpc_consignment_pay_in((p_payload->>'id')::uuid,v_method); v_id:=(p_payload->>'id')::uuid;
    when 'correct' then
      if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'ต้องระบุเหตุผลการแก้ไข' using errcode='22023'; end if;
      select * into s from public.ucom_cash_sources where source_table=p_payload->>'table' and source_id=(p_payload->>'id')::uuid;
      if not found or not s.booked then raise exception 'รายการเก่าต้องกระทบยอดอย่างชัดเจน' using errcode='P0001'; end if;
      if exists(select 1 from public.ucom_cash_operations where id=s.original_operation and action='covered_sale')
        or exists(select 1 from public.ucom_cash_operations where action='adjust' and payload->>'kind'='refund'
          and payload->>'sourceOperationId'=s.original_operation::text) then
        raise exception 'ต้นทางนี้มีการจัดยอดตั้งต้นหรือคืนเงินจริงแล้ว ต้องกระทบยอดแยก' using errcode='P0001'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount'); v_id:=s.source_id;
      case s.source_table
        when 'expenses' then update public.expenses set amount=v_amount,paid_from=v_method where id=v_id;
        when 'shop_income' then update public.shop_income set amount=v_amount,received_to=v_method where id=v_id;
        when 'repair_jobs' then update public.repair_jobs set part_cost=v_amount,part_paid_from=v_method where id=v_id;
        when 'consignments' then
          update public.consignments set status='selling',partner_share=v_amount,payout_method=v_method where id=v_id and direction='in' and status='paid';
          if not found then raise exception 'แก้ได้เฉพาะยอดจ่ายเจ้าของเครื่องฝากเข้า' using errcode='P0001'; end if;
          update public.device_units set cost=v_amount where id=(select device_unit_id from public.consignments where id=v_id);
          update public.sale_items set unit_cost=v_amount where sale_id=(select sale_id from public.consignments where id=v_id);
          update public.consignments set status='paid' where id=v_id;
        when 'sales' then
          select coalesce(sum(unit_price*qty-item_discount),0) into v_bank from public.sale_items where sale_id=v_id;
          if v_amount>v_bank then raise exception 'ยอดแก้ไขเกินยอดรายการในบิล ต้องกระทบยอดแยกพร้อมเหตุผล' using errcode='P0001'; end if;
          update public.sales set bill_discount=v_bank-v_amount,payment_method=v_method where id=v_id;
        else raise exception 'ต้นทางไม่รองรับการแก้ไข' using errcode='22023';
      end case;
    when 'reminder' then
      perform public.ucom_cash_configure_reminder(p_payload);
    else raise exception 'ไม่รองรับคำขอนี้' using errcode='22023';
  end case;
  perform public.ucom_cash_finalize_sources(p_operation_id,v_fund,p_action='covered_sale');
  update public.ucom_cash_book set version=version+1 where id;
  perform public.ucom_cash_assert_allocations();
  if p_action in ('handover_days','settle','return','review','evidence') then
    select * into h from public.ucom_cash_handovers where id=coalesce(v_id,p_operation_id);
    v_snapshot:=public.ucom_cash_balances()||jsonb_build_object('id',h.id,'handover',h.id,'handoverId',h.id,
      'event',p_action,'eventOperationId',p_operation_id,'state',h.state,'reporter',h.reporter,
      'reporterName',(select display_name from public.profiles where id=h.reporter),
      'actorId',auth.uid(),'custodian',h.custodian,'asOf',clock_timestamp(),'version',b.version+1,
      'selectedLines',h.selected_lines,'selectedTotal',(h.amount+h.drawer_before_departure)::text,
      'drawerBeforeDeparture',h.drawer_before_departure::text,'bankBound',h.amount::text,
      'bank',h.bank::text,'drawerAfterReturn',h.drawer::text,'returnedPending',h.returned::text,
      'depositedAt',h.deposited_at,'reviewNote',h.review_note,'evidencePath',h.evidence_path,
      'deposit',case when h.bank is null then null else jsonb_build_object('bank',h.bank::text,
        'drawer',h.drawer::text,'returned',h.returned::text,'custodian',h.custodian,'depositedAt',h.deposited_at) end);
    update public.ucom_cash_handovers set snapshot=v_snapshot where id=h.id;
  end if;
  v_result:=jsonb_build_object('id',coalesce(v_id,p_operation_id),'snapshot',v_snapshot);
  update public.ucom_cash_operations set result=v_result where id=p_operation_id;
  return v_result;
end $$;
revoke all on function public.rpc_cash_execute(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.rpc_cash_execute(uuid,uuid,text,jsonb) to authenticated;

create or replace function public.rpc_cash_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_book public.ucom_cash_book%rowtype; v_status jsonb;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  -- ponytail: one shop lock also makes read snapshots consistent; split books if shop count grows.
  select * into v_book from public.ucom_cash_book where id for update;
  v_status := public.ucom_cash_balances() || jsonb_build_object('epoch',v_book.epoch,
    'dayAllocationsEnabled',v_book.day_allocations_enabled,'version',v_book.version,'openedAt',v_book.opened_at,'receivingDevice',v_book.receiving_device,'isReceivingPaused',v_book.receiving_paused,'ackVersion',v_book.ack_version,'ackAt',v_book.ack_at,
    'asOf',clock_timestamp(),'isOwner',public.pos_is_owner(),'activationReady',v_book.activation_ready,
    'reminder',(select jsonb_build_object('enabled',enabled,'weekday',weekday,'time',to_char(remind_at,'HH24:MI'),
      'minimum',minimum::text,'overdueHours',overdue_hours) from public.ucom_cash_reminder_config where id),
    'handovers',coalesce((select jsonb_agg(public.ucom_cash_handover_json(h.id) order by h.created_at desc,h.id) from (select id,created_at from public.ucom_cash_handovers order by created_at desc,id limit 100) h),'[]'::jsonb),
    'closings',coalesce((select jsonb_agg(c.snapshot order by c.closing_date desc,c.revision desc)
      from (select * from public.ucom_cash_closings order by closing_date desc,revision desc limit 30) c),'[]'::jsonb),
    'sources',case when public.pos_is_owner() then coalesce((select jsonb_agg(jsonb_build_object(
      'id',z.source_id,'table',z.source_table,'operationId',z.original_operation,'amount',z.amount::text,
      'fund',z.fund,'movedAt',z.moved_at,'label',case z.source_table
        when 'expenses' then (select name from public.expenses where id=z.source_id)
        when 'shop_income' then (select name from public.shop_income where id=z.source_id)
        when 'repair_jobs' then (select device_desc from public.repair_jobs where id=z.source_id)
        when 'sales' then (select 'บิล '||bill_no::text from public.sales where id=z.source_id)
        when 'consignments' then (select model_snapshot||' · '||counterparty_name from public.consignments where id=z.source_id)
        end) order by z.moved_at desc,z.source_id) from (select * from public.ucom_cash_sources
          where booked order by moved_at desc,source_id limit 100) z),'[]'::jsonb) else '[]'::jsonb end,
    'movements',case when public.pos_is_owner() then coalesce((select jsonb_agg(to_jsonb(m) order by m.sequence desc)
      from (select sequence::text as id,operation_id as "operationId",source_operation_id as "sourceOperationId",
        fund,amount::text,'posting'::text as kind,reason,created_at as "createdAt",sequence
        from public.ucom_cash_movements order by sequence desc limit 50) m),'[]'::jsonb) else '[]'::jsonb end);
  return v_status;
end $$;
revoke all on function public.rpc_cash_status() from public,anon;
grant execute on function public.rpc_cash_status() to authenticated;
commit;
