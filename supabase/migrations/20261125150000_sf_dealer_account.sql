-- SF dealer account (ADR 0034). Follows 20261125120000.
--
-- SF+ phones come from a dealer shop on account. The dealer's statement lists invoices (SO, with
-- a due date), credit notes when a phone is financed through SF ("ลดหนี้-รับคืน"), other credit
-- notes ("ลดหนี้-อื่นๆ"), and the outstanding balance. The shop pays by transfer, per statement
-- cycle. Until now a cash sale cleared the debt immediately and there were no due dates.
--
-- This migration adds:
-- - sf_orders.due_date: the invoice's due date, optional.
-- - sf_dealer_entries: an append-only ledger of credits, payments and adjustments (void + re-add,
--   never edit). Invoices are the SF bills themselves (sf_orders + their phones' tag prices).
-- - rpc_finance_device writes a financed credit for the phone's tag price.
-- - Backfill: a financed credit for every phone already financed.
-- - Views (owner-only): v_sf_dealer_ledger, v_sf_dealer_invoices (FIFO ageing), v_sf_dealer_summary.
-- - v_sf_due.amount_due now comes from the ledger: a cash-sold phone stays owed until paid.
-- - Owner-only RPCs: rpc_sf_dealer_record, rpc_sf_dealer_void, rpc_set_sf_order_due_date.
--
-- No effect on sales, profit or the cash book: payments are transfers and not Expenses, and
-- credits are not income (ADR 0034). On go-live the owner records one opening adjustment so the
-- balance matches the dealer's latest statement.

-- ─────────────────────────────────────────────────────────────
-- 1. Schema
-- ─────────────────────────────────────────────────────────────
alter table public.sf_orders add column due_date date;

create table public.sf_dealer_entries (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('credit_financed', 'credit_other', 'payment', 'adjustment')),
  entry_date     date not null,
  -- credits and payments are positive and lower the debt; an adjustment is signed (+ raises the debt)
  amount         numeric(12, 2) not null check (amount <> 'NaN'::numeric),
  doc_no         text,
  method         text check (method is null or method = 'transfer'),
  reference      text,
  note           text,
  device_unit_id uuid references public.device_units (id),
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references public.profiles (id),
  void_reason    text,
  constraint sf_dealer_entries_amount_sign check (
    (kind = 'adjustment' and amount <> 0 and coalesce(btrim(note), '') <> '')
    or (kind <> 'adjustment' and amount > 0)
  ),
  constraint sf_dealer_entries_financed_device check (kind <> 'credit_financed' or device_unit_id is not null),
  constraint sf_dealer_entries_payment_method check (kind <> 'payment' or method = 'transfer'),
  constraint sf_dealer_entries_void check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and coalesce(btrim(void_reason), '') <> '')
  )
);

create unique index sf_dealer_entries_one_financed_credit
  on public.sf_dealer_entries (device_unit_id)
  where kind = 'credit_financed' and voided_at is null;

create index sf_dealer_entries_by_date on public.sf_dealer_entries (entry_date, created_at);

alter table public.sf_dealer_entries enable row level security;
create policy sf_dealer_entries_owner_read on public.sf_dealer_entries
  for select to authenticated using (public.pos_is_owner());
revoke all on public.sf_dealer_entries from anon, authenticated;
grant select on public.sf_dealer_entries to authenticated;

-- Append-only: the only change ever allowed is voiding a live row once.
create function public.pos_keep_sf_dealer_entries_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'รายการบัญชีร้านตัวแทนลบไม่ได้ ให้ยกเลิกพร้อมเหตุผลแทน' using errcode = 'P0001';
  end if;
  if old.voided_at is not null
     or new.voided_at is null
     or (new.id, new.kind, new.entry_date, new.amount, new.doc_no, new.method, new.reference, new.note,
         new.device_unit_id, new.created_by, new.created_at)
        is distinct from
        (old.id, old.kind, old.entry_date, old.amount, old.doc_no, old.method, old.reference, old.note,
         old.device_unit_id, old.created_by, old.created_at) then
    raise exception 'รายการบัญชีร้านตัวแทนแก้ไขไม่ได้ ให้ยกเลิกแล้วบันทึกใหม่' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.pos_keep_sf_dealer_entries_append_only() from public, anon, authenticated;

create trigger sf_dealer_entries_append_only
  before update or delete on public.sf_dealer_entries
  for each row execute function public.pos_keep_sf_dealer_entries_append_only();

-- ─────────────────────────────────────────────────────────────
-- 2. Financing a phone credits the dealer account
-- ─────────────────────────────────────────────────────────────
create or replace function public.rpc_finance_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_price numeric(12, 2);
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  update public.device_units d
     set status      = 'financed',
         financed_at = now()
   where d.id         = p_device_id
     and d.status     = 'in_stock'
     and d.acquisition = 'sf_credit'
  returning d.list_price into v_list_price;

  if not found then
    raise exception 'เครื่องนี้ปล่อยผ่อนไม่ได้ — ต้องเป็นเครื่อง SF ที่อยู่ในสต็อก'
      using errcode = 'P0001';
  end if;

  -- SF settles a financed phone with the dealer, so the shop's debt drops by its tag price.
  if v_list_price > 0 then
    insert into public.sf_dealer_entries (kind, entry_date, amount, device_unit_id, note, created_by)
    values ('credit_financed', (now() at time zone 'Asia/Bangkok')::date, v_list_price, p_device_id,
            'ลดหนี้อัตโนมัติเมื่อปล่อยผ่อน SF', auth.uid());
  end if;
end;
$$;

revoke all on function public.rpc_finance_device(uuid) from public, anon;
grant execute on function public.rpc_finance_device(uuid) to authenticated;

-- Phones financed before this migration get their credit too.
insert into public.sf_dealer_entries (kind, entry_date, amount, device_unit_id, note)
select 'credit_financed',
       coalesce((d.financed_at at time zone 'Asia/Bangkok')::date, (now() at time zone 'Asia/Bangkok')::date),
       d.list_price, d.id, 'ลดหนี้ย้อนหลังสำหรับเครื่องที่ผ่อนก่อนเปิดบัญชีร้านตัวแทน'
  from public.device_units d
 where d.acquisition = 'sf_credit'
   and d.status = 'financed'
   and d.list_price > 0;

-- ─────────────────────────────────────────────────────────────
-- 3. Views (owner-only)
-- ─────────────────────────────────────────────────────────────
-- One row per invoice. Credits and payments are applied to the oldest invoice first, the way the
-- dealer's statement ages them; adjustments move the balance the same way.
create view public.v_sf_dealer_invoices with (security_invoker = false) as
with invoices as (
  select o.id, o.order_no, o.ordered_at, o.due_date, o.created_at,
         coalesce(sum(d.list_price), 0)::numeric(12, 2) as total
    from public.sf_orders o
    left join public.device_units d on d.sf_order_id = o.id
   group by o.id
), reduced as (
  select coalesce(sum(case when e.kind = 'adjustment' then -e.amount else e.amount end), 0) as amount
    from public.sf_dealer_entries e
   where e.voided_at is null
), ordered as (
  select i.*,
         coalesce(sum(i.total) over (order by i.ordered_at, i.created_at, i.id
                                     rows between unbounded preceding and 1 preceding), 0) as before
    from invoices i
)
select o.id as sf_order_id,
       o.order_no,
       o.ordered_at,
       o.due_date,
       o.total,
       least(greatest(r.amount - o.before, 0), o.total)::numeric(12, 2) as applied,
       (o.total - least(greatest(r.amount - o.before, 0), o.total))::numeric(12, 2) as open_amount,
       case
         when o.total - least(greatest(r.amount - o.before, 0), o.total) > 0
          and o.due_date < (now() at time zone 'Asia/Bangkok')::date
         then (now() at time zone 'Asia/Bangkok')::date - o.due_date
       end as days_overdue
  from ordered o
 cross join reduced r
 where public.pos_is_owner();

-- Every invoice and entry with its effect on the debt and the running balance (voided rows show, count 0).
create view public.v_sf_dealer_ledger with (security_invoker = false) as
with lines as (
  select o.id, 'invoice'::text as kind, o.ordered_at as entry_date, o.created_at,
         o.order_no as doc_no, coalesce(sum(d.list_price), 0)::numeric(12, 2) as debt_change,
         o.due_date, null::text as method, null::text as reference, o.note,
         null::uuid as device_unit_id, null::timestamptz as voided_at, null::text as void_reason
    from public.sf_orders o
    left join public.device_units d on d.sf_order_id = o.id
   group by o.id
  union all
  select e.id, e.kind, e.entry_date, e.created_at, e.doc_no,
         case when e.kind = 'adjustment' then e.amount else -e.amount end,
         null::date, e.method, e.reference, e.note, e.device_unit_id, e.voided_at, e.void_reason
    from public.sf_dealer_entries e
)
select l.*,
       sum(case when l.voided_at is null then l.debt_change else 0 end)
         over (order by l.entry_date, l.created_at, l.id
               rows between unbounded preceding and current row)::numeric(12, 2) as balance
  from lines l
 where public.pos_is_owner();

create view public.v_sf_dealer_summary with (security_invoker = false) as
select coalesce(sum(i.open_amount), 0)::numeric(12, 2)                                    as balance_open_invoices,
       (select coalesce(sum(debt_change) filter (where voided_at is null), 0)
          from public.v_sf_dealer_ledger)::numeric(12, 2)                                 as balance,
       coalesce(sum(i.open_amount) filter (where i.days_overdue > 0), 0)::numeric(12, 2)  as overdue_amount,
       count(*) filter (where i.open_amount > 0)                                          as open_invoices,
       max(i.days_overdue)                                                                as max_days_overdue
  from public.v_sf_dealer_invoices i
 where public.pos_is_owner();

revoke all on public.v_sf_dealer_invoices, public.v_sf_dealer_ledger, public.v_sf_dealer_summary from anon, authenticated;
grant select on public.v_sf_dealer_invoices, public.v_sf_dealer_ledger, public.v_sf_dealer_summary to authenticated;

-- v_sf_due keeps its columns; amount_due is now the invoice's open amount from the ledger, so a
-- cash-sold phone stays owed until a payment covers it. due_date and days_overdue are appended.
create or replace view public.v_sf_due with (security_invoker = false) as
select
  o.id       as sf_order_id,
  o.order_no,
  o.ordered_at,
  o.note,
  count(d.id)                                        as device_count,
  count(d.id) filter (where d.status = 'financed')   as financed_count,
  count(d.id) filter (where d.status = 'in_stock')   as unfinanced_count,
  case when public.pos_is_owner() then
    (select i.open_amount from public.v_sf_dealer_invoices i where i.sf_order_id = o.id)::numeric
  end as amount_due,
  o.due_date,
  case when public.pos_is_owner() then
    (select i.days_overdue from public.v_sf_dealer_invoices i where i.sf_order_id = o.id)
  end as days_overdue
from public.sf_orders o
left join public.device_units d on d.sf_order_id = o.id
where public.pos_is_member()
group by o.id, o.order_no, o.ordered_at, o.note, o.due_date;

-- ─────────────────────────────────────────────────────────────
-- 4. Owner RPCs
-- ─────────────────────────────────────────────────────────────
create function public.rpc_sf_dealer_record(
  p_kind text,
  p_entry_date date,
  p_amount numeric,
  p_doc_no text default null,
  p_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.pos_is_owner() then
    raise exception 'เจ้าของร้านเท่านั้นที่บันทึกบัญชีร้านตัวแทนได้' using errcode = '42501';
  end if;
  if p_kind not in ('credit_other', 'payment', 'adjustment') then
    raise exception 'ประเภทรายการไม่ถูกต้อง' using errcode = 'P0001';
  end if;
  if p_entry_date is null or p_entry_date > (now() at time zone 'Asia/Bangkok')::date
     or p_entry_date < date '2024-01-01' then
    raise exception 'วันที่ต้องไม่เป็นวันในอนาคต' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount = 'NaN'::numeric or p_amount <> round(p_amount, 2) then
    raise exception 'จำนวนเงินไม่ถูกต้อง' using errcode = 'P0001';
  end if;
  if p_kind = 'adjustment' then
    if p_amount = 0 or coalesce(btrim(p_note), '') = '' then
      raise exception 'การปรับยอดต้องมีจำนวนเงินและเหตุผล' using errcode = 'P0001';
    end if;
  elsif p_amount <= 0 then
    raise exception 'จำนวนเงินต้องมากกว่า 0' using errcode = 'P0001';
  end if;

  insert into public.sf_dealer_entries (kind, entry_date, amount, doc_no, method, reference, note, created_by)
  values (p_kind, p_entry_date, p_amount, nullif(btrim(p_doc_no), ''),
          case when p_kind = 'payment' then 'transfer' end,
          nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create function public.rpc_sf_dealer_void(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_owner() then
    raise exception 'เจ้าของร้านเท่านั้นที่ยกเลิกรายการได้' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'ต้องระบุเหตุผลที่ยกเลิก' using errcode = 'P0001';
  end if;

  update public.sf_dealer_entries
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_id and voided_at is null;

  if not found then
    raise exception 'ไม่พบรายการ หรือถูกยกเลิกไปแล้ว' using errcode = 'P0001';
  end if;
end;
$$;

create function public.rpc_set_sf_order_due_date(p_order_id uuid, p_due_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_owner() then
    raise exception 'เจ้าของร้านเท่านั้นที่กำหนดวันครบกำหนดได้' using errcode = '42501';
  end if;

  update public.sf_orders
     set due_date = p_due_date
   where id = p_order_id
     and (p_due_date is null or p_due_date >= ordered_at);

  if not found then
    raise exception 'ไม่พบบิล หรือวันครบกำหนดก่อนวันที่รับบิล' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.rpc_sf_dealer_record(text, date, numeric, text, text, text) from public, anon;
revoke all on function public.rpc_sf_dealer_void(uuid, text) from public, anon;
revoke all on function public.rpc_set_sf_order_due_date(uuid, date) from public, anon;
grant execute on function public.rpc_sf_dealer_record(text, date, numeric, text, text, text) to authenticated;
grant execute on function public.rpc_sf_dealer_void(uuid, text) to authenticated;
grant execute on function public.rpc_set_sf_order_due_date(uuid, date) to authenticated;
