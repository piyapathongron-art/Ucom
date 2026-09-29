-- sales.bill_no: a permanent, human-readable bill number for receipts and the report.
-- One global counter (never resets, never reused). Existing bills are numbered once,
-- oldest first; new bills take the next value from the sequence at insert, so rpc_create_sale
-- needs no change. Queued offline bills are numbered when they reach the server.

create sequence if not exists public.sales_bill_no_seq;

alter table public.sales add column if not exists bill_no bigint;

with ordered as (
  select id, row_number() over (order by sold_at, created_at, id) as n
  from public.sales
  where bill_no is null
)
update public.sales s
   set bill_no = o.n + (select coalesce(max(bill_no), 0) from public.sales)
  from ordered o
 where s.id = o.id;

select setval('public.sales_bill_no_seq', (select coalesce(max(bill_no), 0) from public.sales) + 1, false);

alter table public.sales
  alter column bill_no set default nextval('public.sales_bill_no_seq'),
  alter column bill_no set not null;

alter sequence public.sales_bill_no_seq owned by public.sales.bill_no;

create unique index if not exists sales_bill_no_key on public.sales (bill_no);
