-- Phase 2 acceptance: the imported numbers must reproduce the source file exactly.
\pset format aligned

select 'row counts' as section;
select
  (select count(*) from public.categories)     as categories,
  (select count(*) from public.products)       as products,
  (select count(*) from public.device_units)   as device_units,
  (select count(*) from public.sales)          as sales,
  (select count(*) from public.sale_items)     as sale_items,
  (select count(*) from public.expenses)       as expenses;

select 'device split (expect sold=182, in_stock=29)' as section;
select status, count(*) from public.device_units group by status order by status;

select 'sale_items by kind (expect product=999, service=122, topup=452)' as section;
select kind, count(*) from public.sale_items group by kind order by kind;

-- THE acceptance number from plan-rebuild.md phase 2.
-- net_revenue is computed by v_sale_profit as
--   sum(unit_price*qty) - sum(item_discount) - bill_discount
-- which must equal the source file's `total` field, summed = 1,454,600.
select 'REVENUE CHECK — expect exactly 1454600' as section;
select
  sum(gross - item_discount - bill_discount) as imported_net_revenue,
  1454600                                    as source_file_total,
  sum(gross - item_discount - bill_discount) - 1454600 as difference
from (
  select
    s.bill_discount,
    coalesce(sum(i.unit_price * i.qty), 0)  as gross,
    coalesce(sum(i.item_discount), 0)       as item_discount
  from public.sales s
  left join public.sale_items i on i.sale_id = s.id
  group by s.id, s.bill_discount
) per_bill;

select 'revenue by payment method (expect cash=1238586, transfer=216014)' as section;
select payment_method, sum(net) as revenue from (
  select s.payment_method,
         coalesce(sum(i.unit_price * i.qty), 0)
           - coalesce(sum(i.item_discount), 0)
           - s.bill_discount as net
  from public.sales s
  left join public.sale_items i on i.sale_id = s.id
  group by s.id, s.payment_method, s.bill_discount
) t group by payment_method order by payment_method;

select 'topup margin must be exactly 3.00% on every line (expect 0 bad rows)' as section;
select count(*) as lines_with_wrong_margin
from public.sale_items
where kind = 'topup'
  and round((unit_price - unit_cost) / nullif(unit_price, 0), 4) <> 0.03;

select 'expenses imported (expect 53, none SF/repair)' as section;
select count(*) as expense_rows, sum(amount) as expense_total from public.expenses;
select name, count(*) from public.expenses
where name in ('SF+','ไทยช่วยไทย','ผ่อน','ผ่อน jmart','หักมัดจำ')
   or name like 'ต้นทุนงานซ่อม%'
group by name;

select 'every imported row flagged is_imported (expect 0 unflagged)' as section;
select
  (select count(*) from public.products     where not is_imported) as products_unflagged,
  (select count(*) from public.device_units where not is_imported) as devices_unflagged,
  (select count(*) from public.sales        where not is_imported) as sales_unflagged,
  (select count(*) from public.expenses     where not is_imported) as expenses_unflagged;

select 'idempotency: re-running an import batch must add nothing' as section;
