-- The imported 452 top-up lines predate the wallet ledger. Each carrier starts
-- from an owner-confirmed physical balance; older sales and funding stay in
-- history but cannot change the operational wallet after this cutover.
alter table public.sale_items add column wallet_applied_at timestamptz;

create table public.topup_wallet_openings (
  carrier_id uuid primary key references public.topup_carriers(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  opened_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.topup_wallet_openings enable row level security;
revoke all on public.topup_wallet_openings from public, anon, authenticated;
grant select on public.topup_wallet_openings to authenticated;
create policy topup_wallet_openings_owner_read on public.topup_wallet_openings
  for select to authenticated using (public.pos_is_owner());

create function public.rpc_open_topup_wallet(p_carrier_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.pos_is_owner() then
    raise exception 'เฉพาะเจ้าของร้าน' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 0 or p_amount <> round(p_amount, 2) then
    raise exception 'ยอดตั้งต้นไม่ถูกต้อง' using errcode = 'P0001';
  end if;
  -- ponytail: one shop-wide lock serializes setup, funding, and top-up sales;
  -- use ordered per-carrier locks if throughput becomes a real bottleneck.
  perform pg_catalog.pg_advisory_xact_lock(944421, 1);
  if not exists (select 1 from public.topup_carriers c where c.id = p_carrier_id and c.is_active) then
    raise exception 'ไม่พบค่ายที่เปิดใช้งาน' using errcode = 'P0001';
  end if;
  insert into public.topup_wallet_openings(carrier_id, amount, opened_at, created_by)
  values (p_carrier_id, p_amount, clock_timestamp(), (select auth.uid()));
end;
$$;
revoke all on function public.rpc_open_topup_wallet(uuid,numeric) from public, anon;
grant execute on function public.rpc_open_topup_wallet(uuid,numeric) to authenticated;

-- New funding must follow the cutover. Its database timestamp, not the editable
-- occurred_at field, decides whether it belongs to the current wallet.
create function public.pos_guard_topup_funding()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.pos_is_owner() then
    raise exception 'เฉพาะเจ้าของร้าน' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(944421, 1);
  if not exists (select 1 from public.topup_wallet_openings o where o.carrier_id = new.carrier_id) then
    raise exception 'กรุณาตั้งยอดวอลเล็ตค่ายนี้ก่อนเติมเงิน' using errcode = 'P0001';
  end if;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.pos_guard_topup_funding() from public, anon, authenticated;
create trigger topup_wallet_entries_guard_opening
  before insert on public.topup_wallet_entries
  for each row execute function public.pos_guard_topup_funding();
-- Existing funding remains readable history, but changing or removing a post-cutover
-- entry would silently rewrite the operational balance without the sale lock.
revoke update, delete on public.topup_wallet_entries from authenticated;

-- Keep top-up cost and wallet availability authoritative at the insert boundary.
-- This covers both the dedicated route and the existing POS RPC.
create function public.pos_guard_topup_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate numeric(5, 4);
  v_balance numeric(12, 2);
  v_opening numeric(12, 2);
  v_opened_at timestamptz;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;
  if new.qty <> 1 or new.unit_price <= 0 then
    raise exception 'ยอดเติมเงินไม่ถูกต้อง' using errcode = 'P0001';
  end if;

  -- ponytail: one shop-wide lock serializes top-up sales across three carriers;
  -- use ordered per-carrier locks only if top-up throughput makes this a bottleneck.
  perform pg_catalog.pg_advisory_xact_lock(944421, 1);
  select c.commission_rate into v_rate
  from public.topup_carriers c
  where c.id = new.topup_carrier_id and c.is_active
  for update;
  if not found then
    raise exception 'ไม่พบค่ายที่เปิดใช้งาน' using errcode = 'P0001';
  end if;

  select o.amount, o.opened_at into v_opening, v_opened_at
  from public.topup_wallet_openings o where o.carrier_id = new.topup_carrier_id;
  if not found then
    raise exception 'ยังไม่ตั้งยอดวอลเล็ตค่ายนี้' using errcode = 'P0001';
  end if;

  new.unit_cost := round(new.unit_price * (1 - v_rate), 2);
  select
    v_opening + coalesce((select sum(e.amount) from public.topup_wallet_entries e
              where e.carrier_id = new.topup_carrier_id and e.created_at > v_opened_at), 0)
    - coalesce((select sum(i.unit_cost * i.qty) from public.sale_items i
                where i.topup_carrier_id = new.topup_carrier_id
                  and i.wallet_applied_at > v_opened_at), 0)
  into v_balance;

  if v_balance < new.unit_cost then
    raise exception 'วอลเล็ตค่ายนี้ไม่พอ กรุณาเติมเงินเข้าวอลเล็ตก่อนขาย'
      using errcode = 'P0001';
  end if;
  new.wallet_applied_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.pos_guard_topup_wallet() from public, anon, authenticated;
create trigger sale_items_guard_topup_wallet
  before insert on public.sale_items
  for each row when (new.kind = 'topup')
  execute function public.pos_guard_topup_wallet();

create function public.pos_keep_topup_sale_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'รายการขายเติมเงินแก้ย้อนหลังไม่ได้' using errcode = 'P0001';
end;
$$;
revoke all on function public.pos_keep_topup_sale_immutable() from public, anon, authenticated;
create trigger sale_items_topup_immutable_update
  before update on public.sale_items
  for each row when (old.kind = 'topup' or new.kind = 'topup')
  execute function public.pos_keep_topup_sale_immutable();
create trigger sale_items_topup_immutable_delete
  before delete on public.sale_items
  for each row when (old.kind = 'topup')
  execute function public.pos_keep_topup_sale_immutable();

create index sale_items_topup_carrier_idx on public.sale_items (topup_carrier_id)
  where topup_carrier_id is not null;
create index sale_items_wallet_applied_idx on public.sale_items(topup_carrier_id, wallet_applied_at)
  where wallet_applied_at is not null;
create index topup_wallet_entries_carrier_idx on public.topup_wallet_entries (carrier_id, created_at);

-- These views intentionally bypass base-table RLS, like the existing POS views.
-- The member gate and narrow columns prevent staff from reading cost or profit.
create view public.v_pos_topup_wallet_balance with (security_invoker = false) as
select
  c.id as carrier_id,
  c.name,
  o.carrier_id is not null as is_initialized,
  case when o.carrier_id is null then null else
    o.amount + coalesce((select sum(e.amount) from public.topup_wallet_entries e
              where e.carrier_id = c.id and e.created_at > o.opened_at), 0)
    - coalesce((select sum(i.unit_cost * i.qty) from public.sale_items i
                where i.topup_carrier_id = c.id and i.wallet_applied_at > o.opened_at), 0)
  end as balance,
  case when public.pos_is_owner() then
    coalesce((select sum(i.unit_price - i.unit_cost)
              from public.sale_items i
              join public.sales s on s.id = i.sale_id
              where i.topup_carrier_id = c.id
                and i.wallet_applied_at > o.opened_at
                and (s.sold_at at time zone 'Asia/Bangkok')::date =
                    (now() at time zone 'Asia/Bangkok')::date), 0)
    else null end as commission_today
from public.topup_carriers c
left join public.topup_wallet_openings o on o.carrier_id = c.id
where c.is_active and public.pos_is_member();

create or replace view public.v_topup_wallet_balance with (security_invoker = false) as
select c.id as carrier_id, c.name, c.commission_rate,
  coalesce((select sum(e.amount) from public.topup_wallet_entries e
            where e.carrier_id = c.id and e.created_at > o.opened_at), 0) as topped_up,
  coalesce((select sum(i.unit_cost * i.qty) from public.sale_items i
            where i.topup_carrier_id = c.id and i.wallet_applied_at > o.opened_at), 0) as spent,
  case when o.carrier_id is null then null else
    o.amount
    + coalesce((select sum(e.amount) from public.topup_wallet_entries e
                where e.carrier_id = c.id and e.created_at > o.opened_at), 0)
    - coalesce((select sum(i.unit_cost * i.qty) from public.sale_items i
                where i.topup_carrier_id = c.id and i.wallet_applied_at > o.opened_at), 0)
  end as balance,
  o.amount as opening_amount,
  o.opened_at
from public.topup_carriers c
left join public.topup_wallet_openings o on o.carrier_id = c.id
where public.pos_is_owner();

create view public.v_pos_topup_history with (security_invoker = false) as
select
  i.id as sale_item_id,
  s.id as sale_id,
  s.sold_at,
  s.is_imported,
  c.name as carrier_name,
  i.unit_price as amount,
  p.display_name as cashier_name,
  case when public.pos_is_owner() then i.unit_price - i.unit_cost else null end as commission
from public.sale_items i
join public.sales s on s.id = i.sale_id
join public.topup_carriers c on c.id = i.topup_carrier_id
left join public.profiles p on p.id = s.created_by
where i.kind = 'topup' and public.pos_is_member();

revoke all on public.v_pos_topup_wallet_balance from public, anon, authenticated;
revoke all on public.v_pos_topup_history from public, anon, authenticated;
grant select on public.v_pos_topup_wallet_balance to authenticated;
grant select on public.v_pos_topup_history to authenticated;
