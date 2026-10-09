create table public.ucom_cash_reminder_config (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  weekday integer not null default 5 check(weekday between 0 and 6),
  remind_at time not null default '10:00',
  minimum numeric not null default 0 check(minimum>=0 and minimum=round(minimum,2)),
  overdue_hours integer not null default 24 check(overdue_hours between 1 and 168)
);
insert into public.ucom_cash_reminder_config(id) values(true);
create table public.ucom_cash_reminder_delivery (
  id uuid primary key default gen_random_uuid(),
  send_date date not null unique,
  retry_key uuid not null default gen_random_uuid(),
  snapshot jsonb not null,
  lease_until timestamptz not null,
  sent_at timestamptz
);
alter table public.ucom_cash_reminder_config enable row level security;
alter table public.ucom_cash_reminder_delivery enable row level security;
revoke all on public.ucom_cash_reminder_config,public.ucom_cash_reminder_delivery from public,anon,authenticated;

create function public.ucom_cash_configure_reminder(p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.pos_is_owner() then raise exception 'เฉพาะเจ้าของร้าน' using errcode='42501'; end if;
  if p_payload->>'enabled' not in ('true','false') or p_payload->>'enabled' is null
    or p_payload->>'time' is null or p_payload->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or p_payload->>'weekday' is null or p_payload->>'weekday' !~ '^[0-6]$'
    or p_payload->>'overdueHours' is null or p_payload->>'overdueHours' !~ '^[0-9]{1,3}$' then
    raise exception 'ตรวจวัน เวลา และช่วงการเตือน' using errcode='22023'; end if;
  update public.ucom_cash_reminder_config set enabled=(p_payload->>'enabled')::boolean,
    weekday=(p_payload->>'weekday')::integer,remind_at=(p_payload->>'time')::time,
    minimum=public.ucom_cash_money(p_payload->>'minimum'),overdue_hours=(p_payload->>'overdueHours')::integer where id;
end $$;
revoke all on function public.ucom_cash_configure_reminder(jsonb) from public,anon,authenticated;

create function public.rpc_cash_reminder_claim(p_now timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.ucom_cash_book%rowtype; c public.ucom_cash_reminder_config%rowtype;
  d public.ucom_cash_reminder_delivery%rowtype; v_local timestamp; v_snapshot jsonb;
  v_weekly boolean; v_overdue boolean;
begin
  if auth.role()<>'service_role' then raise exception 'Unauthorized' using errcode='42501'; end if;
  -- Use server time; scheduler-supplied p_now is not trusted as a delivery clock.
  v_local:=clock_timestamp() at time zone 'Asia/Bangkok';
  select * into b from public.ucom_cash_book where id for update;
  select * into c from public.ucom_cash_reminder_config where id;
  if b.epoch is null or not c.enabled or v_local::time<c.remind_at then return null; end if;
  v_snapshot:=public.ucom_cash_balances();
  v_weekly:=extract(dow from v_local)=c.weekday and (v_snapshot->>'available')::numeric>0
    and (v_snapshot->>'available')::numeric>=c.minimum;
  v_overdue:=exists(select 1 from public.ucom_cash_handovers where state='handed_over'
    and created_at<clock_timestamp()-make_interval(hours=>c.overdue_hours));
  if not v_weekly and not v_overdue then return null; end if;
  insert into public.ucom_cash_reminder_delivery(send_date,snapshot,lease_until)
    values(v_local::date,v_snapshot||jsonb_build_object('asOf',clock_timestamp(),'version',b.version,
      'event','reminder','overdue',v_overdue),clock_timestamp()+interval '5 minutes')
    on conflict(send_date) do nothing returning * into d;
  if not found then
    update public.ucom_cash_reminder_delivery set lease_until=clock_timestamp()+interval '5 minutes'
      where send_date=v_local::date and sent_at is null and lease_until<clock_timestamp() returning * into d;
    if not found then return null; end if;
  end if;
  return jsonb_build_object('id',d.id,'retryKey',d.retry_key,'snapshot',d.snapshot);
end $$;
revoke all on function public.rpc_cash_reminder_claim(timestamptz) from public,anon,authenticated;
grant execute on function public.rpc_cash_reminder_claim(timestamptz) to service_role;

create function public.rpc_cash_reminder_finish(p_id uuid,p_sent boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Unauthorized' using errcode='42501'; end if;
  update public.ucom_cash_reminder_delivery set sent_at=case when p_sent then clock_timestamp() else sent_at end,
    lease_until=case when p_sent then lease_until else clock_timestamp() end where id=p_id;
end $$;
revoke all on function public.rpc_cash_reminder_finish(uuid,boolean) from public,anon,authenticated;
grant execute on function public.rpc_cash_reminder_finish(uuid,boolean) to service_role;
