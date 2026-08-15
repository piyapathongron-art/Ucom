-- Close-day (ปิดร้าน) — staff-facing "how much cash is in the drawer" screen.
-- ADR 0014: this answers a different question than v_report_entries and is allowed to
-- disagree with it on purpose (repair bills count here, SF+ commission never does).
--
-- Every view below is gated by pos_is_member(), not pos_is_owner() — staff must be able
-- to read it. None of them may ever carry a cost/profit column: staff cannot see cost
-- (rule 4), and unlike the owner-only report views, RLS on the base tables does not
-- stop a direct PostgREST read of a column that leaks through here.

-- ─────────────────────────────────────────────────────────────
-- expenses.paid_from — which pile of money an expense came out of. Existing 53 rows
-- stay null: no close-day existed when they were entered, so they must not be deducted
-- from a cash-to-send total that didn't exist yet.
-- ─────────────────────────────────────────────────────────────
alter table public.expenses
  add column paid_from text check (paid_from in ('cash', 'transfer'));

-- ─────────────────────────────────────────────────────────────
-- day_closings — only the fact a till-count can't be derived from: what cash was
-- physically counted. Everything derivable (today's sales, today's expenses, the
-- expected total) is computed live, per ADR 0004 — storing it invites the exact
-- silent-drift bug that ADR exists to prevent.
-- ─────────────────────────────────────────────────────────────
create table public.day_closings (
  id           uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  closed_at    timestamptz not null default now(),
  closed_by    uuid references public.profiles (id) on delete set null,
  counted_cash numeric(12, 2) not null check (counted_cash >= 0),
  note         text,
  created_at   timestamptz not null default now()
);

alter table public.day_closings enable row level security;

create policy day_closings_member_read on public.day_closings
  for select
  using (public.pos_is_member());

-- no insert/update/delete policy: every write goes through rpc_close_day, which runs
-- security definer and does the upsert itself.

-- ─────────────────────────────────────────────────────────────
-- v_close_day_bills — every bill of the day, repair-job bills included. This is the
-- one deliberate difference from v_report_entries: money that left the customer's
-- hand and landed in the drawer counts here regardless of which report bucket owns it.
-- ─────────────────────────────────────────────────────────────
create view public.v_close_day_bills with (security_invoker = false) as
select
  (s.sold_at at time zone 'Asia/Bangkok')::date as day,
  s.id                                          as sale_id,
  s.sold_at,
  s.payment_method,
  coalesce(li.gross, 0) - coalesce(li.item_discount, 0) - s.bill_discount
                                                 as bill_total,
  coalesce(li.item_count, 0)                    as item_count
from public.sales s
left join lateral (
  select
    sum(i.unit_price * i.qty) as gross,
    sum(i.item_discount)      as item_discount,
    count(*)                  as item_count
  from public.sale_items i
  where i.sale_id = s.id
) li on true
where public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_close_day_items — what sold today, one row per product name per kind.
-- ─────────────────────────────────────────────────────────────
create view public.v_close_day_items with (security_invoker = false) as
select
  (s.sold_at at time zone 'Asia/Bangkok')::date as day,
  i.name_snapshot,
  i.kind,
  sum(i.qty)                                    as qty,
  sum(i.unit_price * i.qty - i.item_discount)   as revenue
from public.sales s
join public.sale_items i on i.sale_id = s.id
where public.pos_is_member()
group by 1, 2, 3;

-- ─────────────────────────────────────────────────────────────
-- v_close_day_expenses — today's shop expenses, whatever pile of money they came from.
-- ─────────────────────────────────────────────────────────────
create view public.v_close_day_expenses with (security_invoker = false) as
select
  e.spent_at as day,
  e.id,
  e.name,
  e.amount,
  e.paid_from,
  e.created_by
from public.expenses e
where public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_close_day_sf — devices financed (released on SF+ credit) today. Count only —
-- commission is never shown here: it is unknown at release time (it arrives in a
-- later batch, ADR-pending) and even once known it always arrives as a bank transfer,
-- so it never touches the drawer this screen is about.
-- ─────────────────────────────────────────────────────────────
create view public.v_close_day_sf with (security_invoker = false) as
select
  (d.financed_at at time zone 'Asia/Bangkok')::date as day,
  d.imei,
  d.model_name
from public.device_units d
where d.status = 'financed'
  and d.financed_at is not null
  and public.pos_is_member();

revoke all on public.v_close_day_bills    from anon, authenticated;
revoke all on public.v_close_day_items    from anon, authenticated;
revoke all on public.v_close_day_expenses from anon, authenticated;
revoke all on public.v_close_day_sf       from anon, authenticated;

grant select on public.v_close_day_bills    to authenticated;
grant select on public.v_close_day_items    to authenticated;
grant select on public.v_close_day_expenses to authenticated;
grant select on public.v_close_day_sf       to authenticated;

-- ─────────────────────────────────────────────────────────────
-- rpc_add_shop_expense — staff's only write path onto expenses. spent_at is always
-- today (Bangkok time), taken from the server clock, never from the payload — a staff
-- member cannot backdate an expense into an already-closed day.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_add_shop_expense(text, numeric, text);
drop function if exists public.rpc_delete_shop_expense(uuid);
drop function if exists public.rpc_close_day(numeric, text);

create function public.rpc_add_shop_expense(p_name text, p_amount numeric, p_paid_from text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if coalesce(nullif(trim(p_name), ''), '') = '' or p_amount is null or p_amount <= 0 then
    raise exception 'ต้องระบุชื่อรายการและจำนวนเงิน' using errcode = 'P0001';
  end if;

  if p_paid_from is not null and p_paid_from not in ('cash', 'transfer') then
    raise exception 'วิธีจ่ายไม่ถูกต้อง' using errcode = 'P0001';
  end if;

  insert into public.expenses (name, amount, spent_at, paid_from, created_by)
  values (
    trim(p_name),
    p_amount,
    (now() at time zone 'Asia/Bangkok')::date,
    p_paid_from,
    (select auth.uid())
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_delete_shop_expense — staff may only remove what they entered today, and only
-- while today is still open. Anything else goes through the owner's /expenses page.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_delete_shop_expense(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if exists (select 1 from public.day_closings where closing_date = v_today) then
    raise exception 'วันนี้ปิดร้านไปแล้ว แก้ไขไม่ได้' using errcode = 'P0001';
  end if;

  delete from public.expenses e
  where e.id = p_id
    and e.spent_at = v_today
    and e.created_by = (select auth.uid());

  if not found then
    raise exception 'ลบรายจ่ายนี้ไม่ได้' using errcode = 'P0001';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_close_day — upsert on today's row. Closing twice today overwrites the earlier
-- count (a staff member fixing a slip); yesterday's row is immutable once today moves
-- on, because closing_date stops being "today" and rpc_delete_shop_expense's own-day
-- check already locks the expenses beneath it.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_close_day(p_counted_cash numeric, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'ต้องระบุจำนวนเงินสดที่นับได้' using errcode = 'P0001';
  end if;

  insert into public.day_closings (closing_date, closed_by, counted_cash, note)
  values (
    (now() at time zone 'Asia/Bangkok')::date,
    (select auth.uid()),
    p_counted_cash,
    nullif(p_note, '')
  )
  on conflict (closing_date) do update
    set closed_at    = now(),
        closed_by    = excluded.closed_by,
        counted_cash = excluded.counted_cash,
        note         = excluded.note
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.rpc_add_shop_expense(text, numeric, text) from public, anon;
revoke all on function public.rpc_delete_shop_expense(uuid)             from public, anon;
revoke all on function public.rpc_close_day(numeric, text)              from public, anon;

grant execute on function public.rpc_add_shop_expense(text, numeric, text) to authenticated;
grant execute on function public.rpc_delete_shop_expense(uuid)             to authenticated;
grant execute on function public.rpc_close_day(numeric, text)              to authenticated;
