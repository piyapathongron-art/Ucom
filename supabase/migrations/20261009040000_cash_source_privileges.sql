-- Repair existing financial-table privileges before cash-book activation.
-- Keep legacy authenticated expense writes; their RLS and later cash guards apply.
revoke all on table public.sales, public.sale_items, public.expenses,
  public.shop_income, public.repair_jobs, public.consignments,
  public.day_closings, public.profiles from public, anon;

-- TRUNCATE bypasses RLS and row triggers, including cash cutover guards.
revoke truncate on table public.sales, public.sale_items, public.expenses,
  public.shop_income, public.repair_jobs, public.consignments,
  public.day_closings, public.profiles from authenticated;

-- Income writes already use membership-checked SECURITY DEFINER RPCs.
revoke insert, update, delete, references, trigger
  on table public.shop_income from authenticated;
grant select on table public.shop_income to authenticated;
alter table public.shop_income enable row level security;
create policy shop_income_member_read on public.shop_income
  for select to authenticated using (public.pos_is_member());
