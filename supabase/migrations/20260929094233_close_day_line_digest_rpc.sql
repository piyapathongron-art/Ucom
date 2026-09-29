-- Staff-safe close-day snapshot for one LINE card. Values are derived at send time.
create function public.rpc_close_day_digest(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closing public.day_closings%rowtype;
  v_closed_by text;
  v_sales_total numeric := 0;
  v_cash numeric := 0;
  v_transfer numeric := 0;
  v_thai numeric := 0;
  v_income numeric := 0;
  v_expenses numeric := 0;
  v_payouts numeric := 0;
  v_parts numeric := 0;
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'ต้องระบุวันที่' using errcode = 'P0001';
  end if;
  select * into v_closing from public.day_closings where closing_date = p_date;
  if not found then
    raise exception 'ยังไม่ได้ปิดร้านวันนี้' using errcode = 'P0001';
  end if;
  select p.display_name into v_closed_by from public.profiles p where p.id = v_closing.closed_by;

  select coalesce(sum(b.bill_total), 0),
    coalesce(sum(b.bill_total) filter (where b.payment_method = 'cash'), 0),
    coalesce(sum(b.bill_total) filter (where b.payment_method = 'transfer' and s.receiving_account is distinct from 'ไทยช่วยไทย'), 0),
    coalesce(sum(b.bill_total) filter (where b.payment_method = 'transfer' and s.receiving_account = 'ไทยช่วยไทย'), 0)
  into v_sales_total, v_cash, v_transfer, v_thai
  from public.v_close_day_bills b
  join public.sales s on s.id = b.sale_id
  where b.day = p_date;

  select coalesce(sum(i.amount), 0) into v_income
  from public.v_close_day_income i where i.day = p_date and i.received_to = 'cash';
  select coalesce(sum(e.amount), 0) into v_expenses
  from public.v_close_day_expenses e where e.day = p_date and e.paid_from = 'cash';
  select coalesce(sum(c.amount), 0) into v_payouts
  from public.v_close_day_consignment_payouts c where c.day = p_date and c.paid_from = 'cash';
  select coalesce(sum(r.amount), 0) into v_parts
  from public.v_close_day_parts r where r.day = p_date;

  return jsonb_build_object(
    'date', p_date,
    'closedBy', coalesce(v_closed_by, 'ไม่ระบุ'),
    'closedAt', v_closing.closed_at,
    'createdAt', v_closing.created_at,
    'countedCash', v_closing.counted_cash,
    'salesTotal', v_sales_total,
    'toSend', v_cash + v_income - v_expenses - v_payouts - v_parts,
    'receipts', jsonb_build_object('cash', v_cash, 'transfer', v_transfer, 'thaiChuaiThai', v_thai),
    'salesLines', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'amount', x.amount, 'isRepair', x.is_repair)
        order by x.amount desc, x.name, x.is_repair)
      from (
        select q.name, sum(q.amount) as amount, q.is_repair
        from (
          select i.name_snapshot as name, i.unit_price * i.qty - i.item_discount as amount,
            exists (select 1 from public.repair_jobs r where r.sale_id = s.id) as is_repair
          from public.sale_items i
          join public.sales s on s.id = i.sale_id
          left join public.products p on p.id = i.product_id
          where (s.sold_at at time zone 'Asia/Bangkok')::date = p_date
            and i.kind in ('product', 'service')
            and (i.kind <> 'product' or p.carrier_id is null)
          union all
          select 'ส่วนลดท้ายบิล', -sum(s.bill_discount), false
          from public.sales s
          where (s.sold_at at time zone 'Asia/Bangkok')::date = p_date
          having sum(s.bill_discount) > 0
        ) q
        group by q.name, q.is_repair
      ) x
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('model', x.model, 'imeiLast4', x.imei_last4, 'amount', x.amount)
        order by x.amount desc, x.model, x.imei_last4)
      from (
        select i.name_snapshot as model, right(d.imei, 4) as imei_last4,
          i.unit_price * i.qty - i.item_discount as amount
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        join public.device_units d on d.id = i.device_unit_id
        where i.kind = 'device' and (s.sold_at at time zone 'Asia/Bangkok')::date = p_date
      ) x
    ), '[]'::jsonb),
    'sims', coalesce((
      select jsonb_agg(jsonb_build_object('carrier', c.name, 'sold', coalesce(si.sold, 0),
        'free', coalesce(si.free, 0), 'stockLeft', coalesce(st.stock_left, 0), 'amount', coalesce(si.amount, 0))
        order by coalesce(si.amount, 0) desc, c.name)
      from public.topup_carriers c
      left join lateral (
        select sum(i.qty) filter (where i.unit_price * i.qty - i.item_discount > 0) as sold,
          sum(i.qty) filter (where i.unit_price * i.qty - i.item_discount = 0) as free,
          sum(i.unit_price * i.qty - i.item_discount) as amount
        from public.sale_items i
        join public.sales s on s.id = i.sale_id
        join public.products p on p.id = i.product_id
        where p.carrier_id = c.id and i.kind = 'product'
          and (s.sold_at at time zone 'Asia/Bangkok')::date = p_date
      ) si on true
      left join lateral (
        select sum(p.qty) as stock_left from public.products p where p.carrier_id = c.id and p.is_active
      ) st on true
      where coalesce(si.sold, 0) + coalesce(si.free, 0) > 0 or coalesce(st.stock_left, 0) > 0
    ), '[]'::jsonb),
    'topups', coalesce((
      select jsonb_agg(jsonb_build_object('carrier', c.name, 'sold', coalesce(sa.sold, 0),
        'walletBalance', wb.balance,
        'entered', coalesce(day_entries.amount, 0), 'amount', coalesce(sa.sold, 0))
        order by coalesce(sa.sold, 0) desc, c.name)
      from public.topup_carriers c
      left join public.v_pos_topup_wallet_balance wb on wb.carrier_id = c.id
      left join lateral (
        select sum(i.unit_price * i.qty - i.item_discount) as sold
        from public.sale_items i join public.sales s on s.id = i.sale_id
        where i.kind = 'topup' and i.topup_carrier_id = c.id
          and (s.sold_at at time zone 'Asia/Bangkok')::date = p_date
      ) sa on true
      left join lateral (
        select sum(e.amount) as amount from public.topup_wallet_entries e
        where e.carrier_id = c.id and (e.occurred_at at time zone 'Asia/Bangkok')::date = p_date
      ) day_entries on true
      where coalesce(sa.sold, 0) > 0 or coalesce(day_entries.amount, 0) > 0
    ), '[]'::jsonb),
    'cashOutLines', coalesce((
      select jsonb_agg(jsonb_build_object('label', x.label, 'amount', x.amount)
        order by x.amount desc, x.label)
      from (
        select e.name as label, e.amount from public.v_close_day_expenses e
        where e.day = p_date and e.paid_from = 'cash'
        union all
        select 'จ่ายเจ้าของเครื่องฝากเข้า', c.amount from public.v_close_day_consignment_payouts c
        where c.day = p_date and c.paid_from = 'cash'
        union all
        select 'อะไหล่ · ' || r.job_label, r.amount from public.v_close_day_parts r
        where r.day = p_date
      ) x
    ), '[]'::jsonb),
    'repairsClosed', (
      select count(*) from public.repair_jobs r
      where r.status = 'collected' and (r.closed_at at time zone 'Asia/Bangkok')::date = p_date
    ),
    'sfReleased', (
      select count(*) from public.v_close_day_sf sf where sf.day = p_date
    )
  );
end;
$$;

revoke all on function public.rpc_close_day_digest(date) from public, anon;
grant execute on function public.rpc_close_day_digest(date) to authenticated;
