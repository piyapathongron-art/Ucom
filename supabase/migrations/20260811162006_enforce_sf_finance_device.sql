-- Restrict SF+ financing to SF-credit devices that are still in stock.
create or replace function public.rpc_finance_device(p_device_id uuid, p_commission numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;

  if p_commission is null or p_commission < 0 then
    raise exception 'ต้องระบุค่าคอมมิชชั่น' using errcode = 'P0001';
  end if;

  update public.device_units d
     set status = 'financed',
         commission = p_commission,
         financed_at = now()
   where d.id = p_device_id
     and d.status = 'in_stock'
     and d.acquisition = 'sf_credit';

  if not found then
    raise exception 'เครื่องนี้ปล่อยผ่อนไม่ได้ — ต้องเป็นเครื่อง SF ที่อยู่ในสต็อก'
      using errcode = 'P0001';
  end if;
end;
$$;
