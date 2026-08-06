-- Ucom POS — phase 4 additions
--
-- Same gating rule as pos_views.sql: security_invoker = false, so each view must gate
-- itself with pos_is_member()/pos_is_owner() — RLS on the base tables does not apply.

-- ─────────────────────────────────────────────────────────────
-- v_pos_topup_carriers — staff could not read topup_carriers directly (owner-only RLS).
-- Name only, no commission_rate: staff does not need it and it is a margin number.
-- ─────────────────────────────────────────────────────────────
create view public.v_pos_topup_carriers with (security_invoker = false) as
select
  c.id,
  c.name
from public.topup_carriers c
where c.is_active
  and public.pos_is_member();

-- ─────────────────────────────────────────────────────────────
-- v_pos_top_products — quick-add shortcuts, all-time count, products only (devices are
-- unique by IMEI so "sells often" does not apply to them). Same row shape as
-- v_pos_catalog on purpose: the frontend reuses one type for both.
-- ─────────────────────────────────────────────────────────────
create view public.v_pos_top_products with (security_invoker = false) as
select
  'product'::text as kind,
  p.id,
  p.name,
  p.sku        as code,
  p.price,
  p.qty,
  c.name       as category_name
from public.sale_items i
join public.products p on p.id = i.product_id
left join public.categories c on c.id = p.category_id
where i.kind = 'product'
  and p.is_active
  and public.pos_is_member()
group by p.id, p.name, p.sku, p.price, p.qty, c.name
order by sum(i.qty) desc
limit 10;

-- ─────────────────────────────────────────────────────────────
-- grants
-- ─────────────────────────────────────────────────────────────
revoke all on public.v_pos_topup_carriers from anon;
revoke all on public.v_pos_top_products   from anon;

grant select on public.v_pos_topup_carriers to authenticated;
grant select on public.v_pos_top_products   to authenticated;
