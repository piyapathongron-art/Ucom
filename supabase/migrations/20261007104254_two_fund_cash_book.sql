-- ADR 0027. Schema only; applying this does not open a cash book.
create table public.ucom_cash_book (
  id boolean primary key default true check (id),
  epoch uuid unique,
  activation_ready boolean not null default false,
  version bigint not null default 0,
  receiving_device uuid,
  device_key_hash bytea,
  receiving_paused boolean not null default false,
  ack_version bigint,
  ack_at timestamptz,
  opened_at timestamptz,
  opened_by uuid references public.profiles(id)
);
insert into public.ucom_cash_book(id) values (true);

create table public.ucom_cash_operations (
  id uuid primary key,
  epoch uuid,
  actor uuid not null references public.profiles(id),
  action text not null,
  payload jsonb not null,
  transaction_id bigint not null default txid_current(),
  result jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create table public.ucom_cash_movements (
  sequence bigint generated always as identity primary key,
  operation_id uuid not null references public.ucom_cash_operations(id),
  fund text not null check (fund in ('drawer','pending')),
  amount numeric not null check (amount = round(amount,2) and amount <> 0
    and amount not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
  source_table text,
  source_id uuid,
  source_operation_id uuid references public.ucom_cash_operations(id),
  reason text,
  created_at timestamptz not null default clock_timestamp()
);
create index ucom_cash_movements_fund on public.ucom_cash_movements(fund,sequence);
create table public.ucom_cash_sources (
  source_table text not null,
  source_id uuid not null,
  original_operation uuid not null references public.ucom_cash_operations(id),
  last_operation uuid not null references public.ucom_cash_operations(id),
  fund text not null check (fund in ('drawer','pending','transfer')),
  amount numeric not null default 0,
  booked boolean not null default false,
  moved_at timestamptz not null default clock_timestamp(),
  primary key(source_table,source_id)
);
create table public.ucom_cash_handovers (
  id uuid primary key references public.ucom_cash_operations(id),
  reporter uuid not null references public.profiles(id),
  custodian text not null check (length(trim(custodian)) between 1 and 120),
  amount numeric not null check (amount > 0 and amount = round(amount,2)),
  state text not null default 'handed_over'
    check (state in ('handed_over','reported','confirmed','disputed','returned')),
  bank numeric,
  drawer numeric,
  returned numeric,
  deposited_at timestamptz,
  evidence_path text,
  review_note text,
  reviewer uuid references public.profiles(id),
  reviewed_at timestamptz,
  snapshot jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create table public.ucom_cash_closings (
  id uuid primary key references public.ucom_cash_operations(id),
  closing_date date not null,
  revision integer not null,
  snapshot jsonb not null,
  unique(closing_date,revision)
);

-- No direct client mutations or raw cost/provenance reads. RPCs are the boundary.
do $$ declare t text; begin
  foreach t in array array['ucom_cash_book','ucom_cash_operations','ucom_cash_movements',
    'ucom_cash_sources','ucom_cash_handovers','ucom_cash_closings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

create function public.ucom_cash_money(p_text text, p_signed boolean default false)
returns numeric language plpgsql immutable set search_path = '' as $$
begin
  if p_text is null or p_text !~ (case when p_signed then '^[-]?[0-9]{1,10}(\.[0-9]{1,2})?$'
      else '^[0-9]{1,10}(\.[0-9]{1,2})?$' end) then
    raise exception 'จำนวนเงินไม่ถูกต้อง (ทศนิยมไม่เกิน 2 ตำแหน่ง)' using errcode='22023';
  end if;
  return p_text::numeric;
end $$;
revoke all on function public.ucom_cash_money(text,boolean) from public,anon,authenticated;

create function public.ucom_cash_balances()
returns jsonb language sql stable security definer set search_path = '' as $$
  with balances as (
    select coalesce(sum(amount) filter(where fund='drawer'),0) as d,
      coalesce(sum(amount) filter(where fund='pending'),0) as p,coalesce(max(sequence),0) as q
    from public.ucom_cash_movements
  ), reservations as (
    select coalesce(sum(amount),0) as h from public.ucom_cash_handovers where state='handed_over'
  ) select jsonb_build_object('drawer',d::text,'pending',p::text,'reserved',h::text,
    'available',(p-h)::text,'postingSequence',q) from balances cross join reservations
$$;
revoke all on function public.ucom_cash_balances() from public,anon,authenticated;

create function public.ucom_cash_post(p_operation uuid,p_fund text,p_amount numeric,
  p_source_table text default null,p_source_id uuid default null,
  p_source_operation uuid default null,p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_balance numeric; v_reserved numeric;
begin
  if p_amount=0 or p_fund='transfer' then return; end if;
  if p_fund is null or p_fund not in ('drawer','pending') or p_amount is null
    or p_amount<>round(p_amount,2) or p_amount in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) then
    raise exception 'จำนวนเงินหรือแหล่งเงินไม่ถูกต้อง' using errcode='22023';
  end if;
  perform 1 from public.ucom_cash_book where id for update;
  select coalesce(sum(m.amount),0) into v_balance from public.ucom_cash_movements m where m.fund=p_fund;
  select coalesce(sum(h.amount),0) into v_reserved from public.ucom_cash_handovers h
    where h.state='handed_over' and p_fund='pending';
  if v_balance+p_amount-v_reserved < 0 then
    raise exception 'เงินที่ใช้ได้ในกองนี้ไม่พอ' using errcode='P0001';
  end if;
  insert into public.ucom_cash_movements(operation_id,fund,amount,source_table,source_id,source_operation_id,reason)
    values(p_operation,p_fund,p_amount,p_source_table,p_source_id,p_source_operation,p_reason);
end $$;
revoke all on function public.ucom_cash_post(uuid,text,numeric,text,uuid,uuid,text) from public,anon,authenticated;

create function public.ucom_cash_immutable()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'ประวัติเงินแก้ไขหรือลบไม่ได้' using errcode='42501'; end $$;
revoke all on function public.ucom_cash_immutable() from public,anon,authenticated;
create trigger ucom_cash_movements_immutable before update or delete on public.ucom_cash_movements
  for each row execute function public.ucom_cash_immutable();
create trigger ucom_cash_closings_immutable before update or delete on public.ucom_cash_closings
  for each row execute function public.ucom_cash_immutable();

create function public.rpc_cash_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_book public.ucom_cash_book%rowtype; v_status jsonb;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  -- ponytail: one shop lock also makes read snapshots consistent; split books if shop count grows.
  select * into v_book from public.ucom_cash_book where id for update;
  v_status := public.ucom_cash_balances() || jsonb_build_object('epoch',v_book.epoch,
    'version',v_book.version,'openedAt',v_book.opened_at,'receivingDevice',v_book.receiving_device,'isReceivingPaused',v_book.receiving_paused,'ackVersion',v_book.ack_version,'ackAt',v_book.ack_at,
    'asOf',clock_timestamp(),'isOwner',public.pos_is_owner(),'activationReady',v_book.activation_ready,
    'reminder',(select jsonb_build_object('enabled',enabled,'weekday',weekday,'time',to_char(remind_at,'HH24:MI'),
      'minimum',minimum::text,'overdueHours',overdue_hours) from public.ucom_cash_reminder_config where id),
    'handovers',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'amount',h.amount::text,
      'custodian',h.custodian,'state',h.state,'createdAt',h.created_at,'bank',h.bank::text,
      'drawer',h.drawer::text,'returned',h.returned::text,'depositedAt',h.deposited_at,
      'evidencePath',h.evidence_path,'reviewNote',h.review_note,'snapshot',h.snapshot) order by h.created_at desc,h.id)
      from (select * from public.ucom_cash_handovers order by created_at desc,id limit 100) h),'[]'::jsonb),
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

create function public.rpc_cash_closing(p_date date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  if p_date is null then raise exception 'ต้องระบุวันที่' using errcode='22023'; end if;
  return coalesce((select jsonb_agg(snapshot order by revision desc) from public.ucom_cash_closings
    where closing_date=p_date),'[]'::jsonb);
end $$;
revoke all on function public.rpc_cash_closing(date) from public,anon;
grant execute on function public.rpc_cash_closing(date) to authenticated;

create function public.rpc_cash_pos_ack(p_epoch uuid,p_device uuid,p_device_token text,p_version bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  perform 1 from public.ucom_cash_book where id for update;
  update public.ucom_cash_book set receiving_paused=true,ack_version=version,ack_at=clock_timestamp()
    where id and epoch=p_epoch and receiving_device=p_device and version=p_version
      and device_key_hash=sha256(convert_to(p_device_token,'UTF8'));
  if not found then raise exception 'ต้องซิงก์จากเครื่องรับเงินหลัก' using errcode='P0001'; end if;
end $$;
revoke all on function public.rpc_cash_pos_ack(uuid,uuid,text,bigint) from public,anon;
grant execute on function public.rpc_cash_pos_ack(uuid,uuid,text,bigint) to authenticated;

create function public.rpc_cash_pos_resume(p_epoch uuid,p_device uuid,p_device_token text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  perform 1 from public.ucom_cash_book where id for update;
  update public.ucom_cash_book set version=version+1,receiving_paused=false,ack_version=null,ack_at=null
    where id and epoch=p_epoch and receiving_device=p_device
      and device_key_hash=sha256(convert_to(p_device_token,'UTF8'));
  if not found then raise exception 'ต้องกลับมารับเงินจากเครื่องหลัก' using errcode='P0001'; end if;
end $$;
revoke all on function public.rpc_cash_pos_resume(uuid,uuid,text) from public,anon;
grant execute on function public.rpc_cash_pos_resume(uuid,uuid,text) to authenticated;
