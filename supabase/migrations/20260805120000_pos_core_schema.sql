-- Ucom POS — core schema, constraints, RLS, seed
--
-- Target: Supabase project bihgcdceovfettoxmgme (`DailyGold & Ucom`), schema `public`.
--
-- WARNING: this `public` schema is SHARED with the DailyGold app (ADR 0008).
-- DailyGold owns `public.display_settings`. Never use blanket statements such as
-- `revoke all on all tables in schema public from anon` or `drop schema public cascade`
-- here: they would silently break DailyGold. Every grant/revoke below names our tables.
--
-- Access model (plan-rebuild.md):
--   owner -> base tables directly, guarded by RLS
--   staff -> read through cost-free views, write through SECURITY DEFINER RPCs only
-- Staff therefore gets NO policy on any base table. That is deliberate, not an omission.
--
-- `auth.users` is shared with DailyGold too, so a DailyGold user can hold a valid session
-- against this project. Membership in `public.profiles` — not `authenticated` — is the
-- real gate. Every policy goes through pos_is_owner()/pos_is_member().

-- ─────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('owner', 'staff')),
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- helpers
-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the policies on `profiles` can call these without recursing
-- into their own RLS check. search_path is pinned empty; everything is schema-qualified.
--
-- Note: `profiles` must exist before these are created — a `language sql` function is
-- planned at CREATE FUNCTION time, not deferred like plpgsql, so a forward reference to
-- a not-yet-existing table fails migration outright (caught by testing against a real
-- Postgres before this touched prod).

create or replace function public.pos_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
  );
$$;

create or replace function public.pos_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
  );
$$;

revoke all on function public.pos_is_owner() from public, anon;
revoke all on function public.pos_is_member() from public, anon;
grant execute on function public.pos_is_owner() to authenticated;
grant execute on function public.pos_is_member() to authenticated;

create or replace function public.pos_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- settings
-- ─────────────────────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0
);

create table public.topup_carriers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  commission_rate numeric(5, 4) not null default 0.03
                    check (commission_rate >= 0 and commission_rate < 1),
  is_active       boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- counted stock
-- ─────────────────────────────────────────────────────────────
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text unique,
  name        text not null,
  category_id uuid references public.categories (id) on delete set null,
  cost        numeric(12, 2) not null default 0 check (cost >= 0),
  price       numeric(12, 2) not null default 0 check (price >= 0),
  qty         int not null default 0 check (qty >= 0),
  is_active   boolean not null default true,
  is_imported boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_active_name_idx on public.products (name) where is_active;

-- ─────────────────────────────────────────────────────────────
-- devices
-- ─────────────────────────────────────────────────────────────
create table public.sf_orders (
  id         uuid primary key default gen_random_uuid(),
  order_no   text not null unique,
  ordered_at date not null,
  due_date   date,
  note       text,
  created_at timestamptz not null default now()
);

create table public.device_units (
  id              uuid primary key default gen_random_uuid(),
  imei            text not null unique,
  model_name      text not null,

  -- where it came from — never edited after intake
  acquisition     text not null
                    check (acquisition in ('purchased', 'sf_credit', 'consigned_in')),
  -- where it is right now
  status          text not null default 'in_stock'
                    check (status in ('in_stock', 'consigned_out', 'sold',
                                      'financed', 'written_off')),

  list_price      numeric(12, 2) not null check (list_price >= 0),
  cost            numeric(12, 2) check (cost >= 0),  -- null while unpaid (sf_credit)

  sf_order_id     uuid references public.sf_orders (id) on delete restrict,
  sf_paid_full_at timestamptz,   -- paid in full after the due date -> the shop owns it

  commission      numeric(12, 2) check (commission >= 0),
  financed_at     timestamptz,

  consignor_name  text,
  consigned_to    text,

  is_imported     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint device_financed_needs_commission
    check (status <> 'financed' or commission is not null),
  constraint device_financed_needs_date
    check (status <> 'financed' or financed_at is not null),
  constraint device_sf_credit_needs_order
    check (acquisition <> 'sf_credit' or sf_order_id is not null)
);

create index device_units_status_idx on public.device_units (status);
create index device_units_sf_order_idx on public.device_units (sf_order_id)
  where sf_order_id is not null;

-- ─────────────────────────────────────────────────────────────
-- sales
-- ─────────────────────────────────────────────────────────────
create table public.sales (
  id                   uuid primary key default gen_random_uuid(),
  sold_at              timestamptz not null default now(),
  payment_method       text not null check (payment_method in ('cash', 'transfer')),
  receiving_account    text,
  bill_discount        numeric(12, 2) not null default 0 check (bill_discount >= 0),
  bill_discount_reason text,
  note                 text,
  created_by           uuid references public.profiles (id) on delete set null,

  -- idempotency key for the offline queue: replaying the same bill returns the first one
  client_uuid          text unique,

  is_imported          boolean not null default false,
  created_at           timestamptz not null default now()
);

create index sales_sold_at_idx on public.sales (sold_at desc);

create table public.sale_items (
  id                   uuid primary key default gen_random_uuid(),
  sale_id              uuid not null references public.sales (id) on delete cascade,
  kind                 text not null check (kind in ('product', 'device', 'service', 'topup')),

  product_id           uuid references public.products (id) on delete set null,
  device_unit_id       uuid references public.device_units (id) on delete restrict,
  topup_carrier_id     uuid references public.topup_carriers (id) on delete restrict,

  name_snapshot        text not null,
  unit_cost            numeric(12, 2) not null default 0 check (unit_cost >= 0),
  unit_price           numeric(12, 2) not null check (unit_price >= 0),
  qty                  int not null default 1 check (qty > 0),
  item_discount        numeric(12, 2) not null default 0 check (item_discount >= 0),
  item_discount_reason text,

  -- a reference may only be set on the kind it belongs to
  constraint sale_item_ref_matches_kind check (
    (product_id       is null or kind = 'product') and
    (device_unit_id   is null or kind = 'device')  and
    (topup_carrier_id is null or kind = 'topup')
  ),
  -- device and topup lines are meaningless without their reference;
  -- `product` lines may have a null product_id — 574 of the 1,573 imported lines do,
  -- their identity lives in name_snapshot (ADR 0007)
  constraint sale_item_device_needs_unit
    check (kind <> 'device' or device_unit_id is not null),
  constraint sale_item_topup_needs_carrier
    check (kind <> 'topup' or topup_carrier_id is not null),
  constraint sale_item_device_qty check (kind <> 'device' or qty = 1)
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- one device can be sold exactly once
create unique index sale_items_device_sold_once
  on public.sale_items (device_unit_id)
  where device_unit_id is not null;

-- ─────────────────────────────────────────────────────────────
-- repairs
-- ─────────────────────────────────────────────────────────────
create table public.repair_jobs (
  id             uuid primary key default gen_random_uuid(),
  received_at    timestamptz not null default now(),
  customer_name  text not null,
  customer_phone text,
  device_desc    text not null,
  symptom        text,
  quoted_price   numeric(12, 2) check (quoted_price >= 0),

  -- both learned later, when the part actually arrives (ADR 0003)
  part_cost      numeric(12, 2) check (part_cost >= 0),
  part_paid_at   timestamptz,

  status         text not null default 'pending'
                   check (status in ('pending', 'in_progress', 'ready',
                                     'collected', 'abandoned')),
  closed_at      timestamptz,
  sale_id        uuid references public.sales (id) on delete set null,
  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint repair_collected_needs_closed_at
    check (status <> 'collected' or closed_at is not null)
);

create index repair_jobs_open_idx on public.repair_jobs (status, received_at desc)
  where status in ('pending', 'in_progress', 'ready');

-- ─────────────────────────────────────────────────────────────
-- money
-- ─────────────────────────────────────────────────────────────
create table public.topup_wallet_entries (
  id          uuid primary key default gen_random_uuid(),
  carrier_id  uuid not null references public.topup_carriers (id) on delete restrict,
  amount      numeric(12, 2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now()
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  spent_at    date not null default current_date,
  category    text,
  is_imported boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index expenses_spent_at_idx on public.expenses (spent_at desc);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.pos_touch_updated_at();

create trigger device_units_touch_updated_at
  before update on public.device_units
  for each row execute function public.pos_touch_updated_at();

create trigger repair_jobs_touch_updated_at
  before update on public.repair_jobs
  for each row execute function public.pos_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS + grants
--
-- Named table-by-table on purpose: `public` is shared with DailyGold (ADR 0008),
-- so nothing here may touch a table we do not own.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  t text;
  pos_tables text[] := array[
    'categories', 'topup_carriers', 'products', 'sf_orders', 'device_units',
    'sales', 'sale_items', 'repair_jobs', 'topup_wallet_entries', 'expenses'
  ];
begin
  foreach t in array pos_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
    -- owner only. staff reaches this data through views and RPCs, never directly.
    execute format($p$
      create policy %I on public.%I
        for all to authenticated
        using (public.pos_is_owner())
        with check (public.pos_is_owner())
    $p$, t || '_owner_all', t);
  end loop;
end;
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;

-- everyone reads their own row (the app needs to know its own role);
-- the owner reads and writes every row
create policy profiles_read_self_or_owner on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.pos_is_owner());

create policy profiles_owner_writes on public.profiles
  for all to authenticated
  using (public.pos_is_owner())
  with check (public.pos_is_owner());

-- ─────────────────────────────────────────────────────────────
-- seed
-- ─────────────────────────────────────────────────────────────
-- every top-up in the source file carries a 3.00% margin, 452/452 with no exception
insert into public.topup_carriers (name, commission_rate) values
  ('True', 0.03),
  ('Ais',  0.03),
  ('Dtac', 0.03)
on conflict (name) do nothing;
