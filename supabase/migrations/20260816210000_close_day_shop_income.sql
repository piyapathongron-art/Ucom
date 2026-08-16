-- Close-day (ปิดร้าน) — off-bill income (รายรับนอกบิล), mirroring expenses/paid_from
-- exactly (ADR 0018 step 6.1). Only received_to = 'cash' rows touch the drawer total;
-- 'transfer' rows are recorded but never affect "ยอดที่คาดว่าจะมีในลิ้นชัก" (that formula
-- lives client-side in close-day/page.tsx, same as it already does for cashExpenseTotal).

-- ─────────────────────────────────────────────────────────────
-- shop_income — symmetric to public.expenses (name/amount/day/via/created_by), no RLS
-- enabled: same as expenses, the table is never read directly by clients — only through
-- v_close_day_income and the two RPCs below.
-- ─────────────────────────────────────────────────────────────
create table public.shop_income (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  received_at date not null default current_date,
  received_to text check (received_to in ('cash', 'transfer')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index shop_income_received_at_idx on public.shop_income (received_at desc);

-- ─────────────────────────────────────────────────────────────
-- v_close_day_income — today's off-bill income, whatever pile of money it landed in.
-- ─────────────────────────────────────────────────────────────
create view public.v_close_day_income with (security_invoker = false) as
select
  i.received_at as day,
  i.id,
  i.name,
  i.amount,
  i.received_to,
  i.created_by
from public.shop_income i
where public.pos_is_member();

revoke all on public.v_close_day_income from anon, authenticated;
grant select on public.v_close_day_income to authenticated;

-- ─────────────────────────────────────────────────────────────
-- rpc_add_shop_income — staff's only write path onto shop_income. received_at is
-- always today (Bangkok time), taken from the server clock, never from the payload —
-- same rule as rpc_add_shop_expense: cannot backdate into an already-closed day.
-- ─────────────────────────────────────────────────────────────
drop function if exists public.rpc_add_shop_income(text, numeric, text);
drop function if exists public.rpc_delete_shop_income(uuid);

create function public.rpc_add_shop_income(p_name text, p_amount numeric, p_received_to text)
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

  if p_received_to is not null and p_received_to not in ('cash', 'transfer') then
    raise exception 'ช่องทางรับเงินไม่ถูกต้อง' using errcode = 'P0001';
  end if;

  insert into public.shop_income (name, amount, received_at, received_to, created_by)
  values (
    trim(p_name),
    p_amount,
    (now() at time zone 'Asia/Bangkok')::date,
    p_received_to,
    (select auth.uid())
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- rpc_delete_shop_income — staff may only remove what they entered today, and only
-- while today is still open. Mirrors rpc_delete_shop_expense exactly.
-- ─────────────────────────────────────────────────────────────
create function public.rpc_delete_shop_income(p_id uuid)
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

  delete from public.shop_income i
  where i.id = p_id
    and i.received_at = v_today
    and i.created_by = (select auth.uid());

  if not found then
    raise exception 'ลบรายรับนี้ไม่ได้' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.rpc_add_shop_income(text, numeric, text) from public, anon;
revoke all on function public.rpc_delete_shop_income(uuid)             from public, anon;

grant execute on function public.rpc_add_shop_income(text, numeric, text) to authenticated;
grant execute on function public.rpc_delete_shop_income(uuid)             to authenticated;
