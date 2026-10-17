-- ADR 0031: staff can depart with selected deposit days without pausing the receiving POS.
-- Closing keeps the explicit pause/ACK and version check. Body is otherwise identical to the
-- production definition dumped on 2026-10-17 (md5 3b6518abdbb0ed636b78fd969a87d5c4).
-- Signature is unchanged, so CREATE OR REPLACE replaces in place (no overload).

create or replace function public.rpc_cash_execute(p_operation_id uuid,p_epoch uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.ucom_cash_book%rowtype; o public.ucom_cash_operations%rowtype;
  h public.ucom_cash_handovers%rowtype; s public.ucom_cash_sources%rowtype;
  v_id uuid; v_amount numeric; v_bank numeric; v_drawer numeric; v_return numeric;
  v_fund text; v_method text; v_snapshot jsonb; v_result jsonb;
  v_today date := (now() at time zone 'Asia/Bangkok')::date; v_revision integer; v_item jsonb;
begin
  if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode='42501'; end if;
  if p_operation_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'ข้อมูลคำขอไม่ถูกต้อง' using errcode='22023'; end if;
  if p_action in ('open','correct','adjust','review','reminder','covered_sale') and not public.pos_is_owner() then
    raise exception 'เฉพาะเจ้าของร้าน' using errcode='42501'; end if;
  select * into b from public.ucom_cash_book where id for update;
  select * into o from public.ucom_cash_operations where id=p_operation_id;
  if found then
    if p_action='sale' and o.action='covered_sale' and o.payload->>'originalActor'=auth.uid()::text
      and o.payload->'payload'=p_payload->'payload' then return o.result; end if;
    if o.actor<>auth.uid() or o.action<>p_action or o.payload<>p_payload or o.epoch is distinct from p_epoch then
      raise exception 'เลขคำขอซ้ำแต่ข้อมูลไม่ตรงกัน' using errcode='22023'; end if;
    return o.result;
  end if;
  -- Already-recorded pre-cutover replay does not add opening-covered cash.
  if p_action='sale' then
    select x.id into v_id from public.sales x
      where x.client_uuid=p_payload->'payload'->>'client_uuid'
        and not exists(select 1 from public.ucom_cash_sources z where z.source_table='sales' and z.source_id=x.id)
        and (x.created_by=auth.uid() or public.pos_is_owner());
    if found then return jsonb_build_object('id',v_id,'openingCovered',true); end if;
  end if;
  if p_action='open' then
    if not b.day_allocations_enabled then raise exception 'ต้องติดตั้งการจัดสรรรายวันก่อนเปิดระบบ' using errcode='42501'; end if;
    if not b.activation_ready then raise exception 'ยังไม่อนุมัติเปิดระบบหลังตรวจครบทุกช่องทาง' using errcode='42501'; end if;
    if b.epoch is not null or p_epoch is not null or p_payload->>'queueDrained' is distinct from 'true'
      or p_payload->>'physicallyPaused' is distinct from 'true' or nullif(trim(p_payload->>'reason'),'') is null then
      raise exception 'ต้องหยุดรับเงิน ซิงก์ทุกบิล และนับยอดตั้งต้นก่อนเปิดระบบ' using errcode='P0001'; end if;
  elsif b.epoch is null or p_epoch is distinct from b.epoch then
    raise exception 'รอบเปิดระบบไม่ตรงกัน ต้องให้เจ้าของร้านจัดประเภทบิลค้างก่อน' using errcode='P0001';
  end if;
  insert into public.ucom_cash_operations(id,epoch,actor,action,payload)
    values(p_operation_id,p_epoch,auth.uid(),p_action,p_payload);
  perform set_config('ucom.cash_operation',p_operation_id::text,true);
  v_fund:=p_payload->>'fund';
  if p_action in ('expense','income','part','consign_pay','correct') then
    if v_fund is null or v_fund not in ('drawer','pending','transfer') then
      raise exception 'ต้องเลือกแหล่งเงิน' using errcode='22023'; end if;
    v_method:=case when v_fund='transfer' then 'transfer' else 'cash' end;
  end if;
  if p_action='handover' then raise exception 'กรุณาโหลดโปรแกรมใหม่และเลือกวันนำฝาก' using errcode='40001'; end if;
  -- ADR 0031: handover_days relies on exact per-line amounts in ucom_cash_depart_days under the book lock.
  if p_action='close' then
    if not b.receiving_paused or b.ack_version is distinct from b.version then
      raise exception 'กรุณาพักรับเงินและซิงก์คิวจากเครื่องหลักก่อน' using errcode='P0001'; end if;
    if (p_payload->>'version')::bigint is distinct from b.version then
      raise exception 'ยอดเปลี่ยนแล้ว กรุณาโหลดใหม่และนับอีกครั้ง' using errcode='40001'; end if;
  end if;
  if p_action in ('sale','repair_close','consign_sell','consign_settle','income') and b.receiving_paused then
    raise exception 'พักรับเงินอยู่ กรุณากลับมารับเงินที่เครื่องหลักก่อน' using errcode='P0001'; end if;
  if p_action in ('sale','repair_close','consign_sell','consign_settle','income') and
    ((p_payload->>'device')::uuid is distinct from b.receiving_device
      or b.device_key_hash is distinct from sha256(convert_to(p_payload->>'deviceToken','UTF8'))) then
    raise exception 'ต้องรับเงินจากเครื่องหลักที่กำหนด' using errcode='42501'; end if;
  if p_action in ('sale','repair_close','covered_sale') then
    -- Validate BEFORE legacy numeric(12,2) variables can silently round inputs.
    perform public.ucom_cash_money(coalesce(p_payload->'payload'->>'bill_discount','0'));
    for v_item in select * from jsonb_array_elements(p_payload->'payload'->'items') loop
      perform public.ucom_cash_money(v_item->>'unit_price');
      perform public.ucom_cash_money(coalesce(v_item->>'item_discount','0'));
    end loop;
  end if;
  case p_action
    when 'open' then
      if p_payload->>'deviceToken' is null or p_payload->>'deviceToken' !~ '^[0-9a-f]{64}$' then
        raise exception 'ต้องยืนยันเครื่องรับเงินหลัก' using errcode='22023'; end if;
      update public.ucom_cash_book set epoch=gen_random_uuid(),receiving_device=(p_payload->>'device')::uuid,
        device_key_hash=sha256(convert_to(p_payload->>'deviceToken','UTF8')),
        opened_at=clock_timestamp(),opened_by=auth.uid() where id;
      if (p_payload->>'device') is null then raise exception 'ต้องระบุเครื่องรับเงินหลัก' using errcode='22023'; end if;
      perform public.ucom_cash_post(p_operation_id,'drawer',public.ucom_cash_money(p_payload->>'drawer'),null,null,null,p_payload->>'reason');
      perform public.ucom_cash_post(p_operation_id,'pending',public.ucom_cash_money(p_payload->>'pending'),null,null,null,p_payload->>'reason');
    when 'handover_days' then
      perform public.ucom_cash_depart_days(p_operation_id,p_payload);
    when 'handover' then
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 or v_amount>(public.ucom_cash_balances()->>'available')::numeric then
        raise exception 'เงินรอฝากที่ใช้ได้ไม่พอ' using errcode='P0001'; end if;
      insert into public.ucom_cash_handovers(id,reporter,custodian,amount)
        values(p_operation_id,auth.uid(),trim(p_payload->>'custodian'),v_amount);
    when 'settle' then
      select * into h from public.ucom_cash_handovers where id=(p_payload->>'handoverId')::uuid for update;
      if not found or h.state<>'handed_over' or (h.reporter<>auth.uid() and not public.pos_is_owner()) then
        raise exception 'รายการส่งมอบนี้บันทึกฝากซ้ำไม่ได้' using errcode='P0001'; end if;
      v_bank:=public.ucom_cash_money(p_payload->>'bank'); v_drawer:=public.ucom_cash_money(p_payload->>'drawer');
      v_return:=public.ucom_cash_money(p_payload->>'returned');
      if v_bank<=0 or h.amount<>v_bank+v_drawer+v_return or p_payload->>'physicallyReturned' is distinct from 'true'
        or not coalesce(public.ucom_cash_evidence_valid(h.id,p_payload->>'evidencePath'),false)
        or (p_payload->>'depositedAt')::timestamptz is null
        or (p_payload->>'depositedAt')::timestamptz<h.created_at
        or (p_payload->>'depositedAt')::timestamptz>clock_timestamp()+interval '5 minutes' then
        raise exception 'ตรวจยอดคืนเงิน วันฝาก และสลิปให้ครบก่อนบันทึก' using errcode='22023'; end if;
      update public.ucom_cash_handovers set state='reported',bank=v_bank,drawer=v_drawer,returned=v_return,
        deposited_at=(p_payload->>'depositedAt')::timestamptz,evidence_path=p_payload->>'evidencePath' where id=h.id;
      perform public.ucom_cash_post(p_operation_id,'pending',-v_bank,'handover',h.id,h.id,'ฝากธนาคาร');
      perform public.ucom_cash_post(p_operation_id,'pending',-v_drawer,'handover',h.id,h.id,'เงินคืนเข้าเก๊ะหลังนำฝาก');
      perform public.ucom_cash_post(p_operation_id,'drawer',v_drawer,'handover',h.id,h.id);
      perform public.ucom_cash_release_handover(p_operation_id,h.id);
      v_id:=h.id;
    when 'return' then
      update public.ucom_cash_handovers set state='returned',review_note=p_payload->>'reason'
        where id=(p_payload->>'handoverId')::uuid and state='handed_over'
          and (reporter=auth.uid() or public.pos_is_owner()) and p_payload->>'physicallyReturned'='true'
          and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'ต้องคืนเงินทั้งหมดจริงก่อนยกเลิก' using errcode='P0001'; end if;
      perform public.ucom_cash_release_handover(p_operation_id,v_id);
    when 'review' then
      update public.ucom_cash_handovers set state=case when (p_payload->>'confirmed')::boolean then 'confirmed' else 'disputed' end,
        review_note=p_payload->>'reason',reviewer=auth.uid(),reviewed_at=clock_timestamp()
        where id=(p_payload->>'handoverId')::uuid and state in ('reported','disputed')
          and p_payload->>'confirmed' in ('true','false') and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'ตรวจสอบรายการฝากนี้ไม่ได้' using errcode='P0001'; end if;
    when 'evidence' then
      update public.ucom_cash_handovers set evidence_path=p_payload->>'evidencePath',state='reported',review_note=p_payload->>'reason'
        where id=(p_payload->>'handoverId')::uuid and state='disputed'
          and (reporter=auth.uid() or public.pos_is_owner())
          and coalesce(public.ucom_cash_evidence_valid(id,p_payload->>'evidencePath'),false)
          and length(trim(p_payload->>'reason'))>0 returning id into v_id;
      if not found then raise exception 'แนบหลักฐานใหม่ไม่ได้' using errcode='P0001'; end if;
    when 'close' then
      v_drawer:=public.ucom_cash_money(p_payload->>'drawerCount'); v_return:=public.ucom_cash_money(p_payload->>'pendingCount');
      perform public.rpc_close_day(v_drawer+v_return,left(coalesce(p_payload->>'note',''),1000));
      select coalesce(max(revision),0)+1 into v_revision from public.ucom_cash_closings where closing_date=v_today;
      v_snapshot:=public.ucom_cash_balances() || jsonb_build_object('id',p_operation_id,'date',v_today,'revision',v_revision,
        'asOf',clock_timestamp(),'version',b.version+1,'drawerCount',v_drawer::text,'pendingCount',v_return::text,
        'drawerVariance',(v_drawer-(public.ucom_cash_balances()->>'drawer')::numeric)::text,
        'pendingVariance',(v_return-(public.ucom_cash_balances()->>'available')::numeric)::text,
        'note',left(coalesce(p_payload->>'note',''),1000),'daily',public.rpc_close_day_digest(v_today));
      insert into public.ucom_cash_closings(id,closing_date,revision,snapshot) values(p_operation_id,v_today,v_revision,v_snapshot);
    when 'adjust' then
      if nullif(trim(p_payload->>'reason'),'') is null or p_payload->>'kind' is null
        or p_payload->>'kind' not in ('reconciliation','refund') or v_fund is null or v_fund not in ('drawer','pending')
        or not exists(select 1 from public.ucom_cash_operations where id=(p_payload->>'sourceOperationId')::uuid and result is not null) then
        raise exception 'ต้องอ้างอิงรายการต้นทางและเหตุผลการปรับเงิน' using errcode='22023'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount',true);
      if v_amount=0 or (p_payload->>'kind'='refund' and v_amount>=0) then raise exception 'ยอดคืนเงินไม่ถูกต้อง' using errcode='22023'; end if;
      if p_payload->>'kind'='refund' then
        select coalesce(sum(x.amount),0) into v_bank from public.ucom_cash_sources x
          where x.original_operation=(p_payload->>'sourceOperationId')::uuid and x.booked
            and x.source_table in ('sales','shop_income') and x.fund<>'transfer' and x.amount>0;
        select coalesce(sum(m.amount),0) into v_return from public.ucom_cash_movements m
          join public.ucom_cash_operations x on x.id=m.operation_id where x.action='adjust'
            and x.payload->>'kind'='refund' and m.source_operation_id=(p_payload->>'sourceOperationId')::uuid;
        if v_bank+v_return+v_amount<0 then raise exception 'ยอดคืนเกินเงินสดที่ต้นทางรับไว้' using errcode='22023'; end if;
      end if;
      perform public.ucom_cash_post(p_operation_id,v_fund,v_amount,null,null,(p_payload->>'sourceOperationId')::uuid,(p_payload->>'kind')||': '||(p_payload->>'reason'));
    when 'sale' then
      if p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text then
        raise exception 'เลขบิลไม่ตรงกับเลขคำขอ' using errcode='22023'; end if;
      if p_payload->'payload'->>'cash_epoch' is distinct from b.epoch::text then
        raise exception 'บิลค้างก่อนเปิดระบบต้องจัดประเภทโดยเจ้าของร้าน' using errcode='P0001'; end if;
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then
        raise exception 'ต้องรับเงินจากเครื่องหลักที่กำหนด' using errcode='P0001'; end if;
      v_id:=public.rpc_create_sale(p_payload->'payload');
    when 'covered_sale' then
      if nullif(trim(p_payload->>'reason'),'') is null or p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text
        or not exists(select 1 from public.profiles where id=(p_payload->>'originalActor')::uuid and role in ('owner','staff')) then
        raise exception 'ต้องจัดประเภทบิลพร้อมเหตุผลและเลขเดิม' using errcode='22023'; end if;
      v_id:=public.rpc_create_sale(p_payload->'payload');
      update public.sales set created_by=(p_payload->>'originalActor')::uuid where id=v_id;
    when 'expense' then
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 or length(trim(p_payload->>'name')) not between 1 and 200 then raise exception 'ข้อมูลรายจ่ายไม่ถูกต้อง' using errcode='22023'; end if;
      if p_payload->>'date' is not null and not public.pos_is_owner() then raise exception 'เฉพาะเจ้าของร้านเลือกวันที่ได้' using errcode='42501'; end if;
      insert into public.expenses(name,amount,spent_at,paid_from,created_by)
        values(trim(p_payload->>'name'),v_amount,coalesce((p_payload->>'date')::date,v_today),v_method,auth.uid()) returning id into v_id;
    when 'income' then
      if v_fund='drawer' then raise exception 'รายรับเงินสดเข้ากองรอฝาก' using errcode='22023'; end if;
      v_id:=public.rpc_add_shop_income(p_payload->>'name',public.ucom_cash_money(p_payload->>'amount'),v_method);
    when 'part' then
      if exists(select 1 from public.repair_jobs where id=(p_payload->>'id')::uuid and part_paid_at is not null) then
        raise exception 'อะไหล่จ่ายแล้วต้องแก้ไขโดยเจ้าของร้าน' using errcode='P0001'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount');
      if v_amount<=0 then raise exception 'ยอดจ่ายต้องมากกว่า 0' using errcode='22023'; end if;
      perform public.rpc_set_part_cost((p_payload->>'id')::uuid,v_amount,v_method); v_id:=(p_payload->>'id')::uuid;
    when 'repair_close' then
      if p_payload->'payload'->>'client_uuid' is distinct from p_operation_id::text then
        raise exception 'เลขบิลซ่อมไม่ตรงกับเลขคำขอ' using errcode='22023'; end if;
      if exists(select 1 from public.sales where client_uuid=p_operation_id::text)
        and not exists(select 1 from public.repair_jobs r join public.sales x on x.id=r.sale_id
          where r.id=(p_payload->>'id')::uuid and r.status='collected' and x.client_uuid=p_operation_id::text) then
        raise exception 'นำบิลอื่นมาปิดงานซ่อมนี้ไม่ได้' using errcode='22023'; end if;
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_close_repair_job((p_payload->>'id')::uuid,p_payload->'payload');
    when 'consign_sell' then
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_consignment_sell_in((p_payload->>'id')::uuid,public.ucom_cash_money(p_payload->>'amount'),
        public.ucom_cash_money(p_payload->>'share'),p_payload->>'method',p_payload->>'account');
    when 'consign_settle' then
      if (p_payload->>'device')::uuid is distinct from b.receiving_device then raise exception 'ต้องรับเงินที่เครื่องหลัก' using errcode='P0001'; end if;
      v_id:=public.rpc_consignment_settle_out((p_payload->>'id')::uuid,p_payload->>'method',p_payload->>'account');
    when 'consign_pay' then
      perform public.rpc_consignment_pay_in((p_payload->>'id')::uuid,v_method); v_id:=(p_payload->>'id')::uuid;
    when 'correct' then
      if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'ต้องระบุเหตุผลการแก้ไข' using errcode='22023'; end if;
      select * into s from public.ucom_cash_sources where source_table=p_payload->>'table' and source_id=(p_payload->>'id')::uuid;
      if not found or not s.booked then raise exception 'รายการเก่าต้องกระทบยอดอย่างชัดเจน' using errcode='P0001'; end if;
      if exists(select 1 from public.ucom_cash_operations where id=s.original_operation and action='covered_sale')
        or exists(select 1 from public.ucom_cash_operations where action='adjust' and payload->>'kind'='refund'
          and payload->>'sourceOperationId'=s.original_operation::text) then
        raise exception 'ต้นทางนี้มีการจัดยอดตั้งต้นหรือคืนเงินจริงแล้ว ต้องกระทบยอดแยก' using errcode='P0001'; end if;
      v_amount:=public.ucom_cash_money(p_payload->>'amount'); v_id:=s.source_id;
      case s.source_table
        when 'expenses' then update public.expenses set amount=v_amount,paid_from=v_method where id=v_id;
        when 'shop_income' then update public.shop_income set amount=v_amount,received_to=v_method where id=v_id;
        when 'repair_jobs' then update public.repair_jobs set part_cost=v_amount,part_paid_from=v_method where id=v_id;
        when 'consignments' then
          update public.consignments set status='selling',partner_share=v_amount,payout_method=v_method where id=v_id and direction='in' and status='paid';
          if not found then raise exception 'แก้ได้เฉพาะยอดจ่ายเจ้าของเครื่องฝากเข้า' using errcode='P0001'; end if;
          update public.device_units set cost=v_amount where id=(select device_unit_id from public.consignments where id=v_id);
          update public.sale_items set unit_cost=v_amount where sale_id=(select sale_id from public.consignments where id=v_id);
          update public.consignments set status='paid' where id=v_id;
        when 'sales' then
          select coalesce(sum(unit_price*qty-item_discount),0) into v_bank from public.sale_items where sale_id=v_id;
          if v_amount>v_bank then raise exception 'ยอดแก้ไขเกินยอดรายการในบิล ต้องกระทบยอดแยกพร้อมเหตุผล' using errcode='P0001'; end if;
          update public.sales set bill_discount=v_bank-v_amount,payment_method=v_method where id=v_id;
        else raise exception 'ต้นทางไม่รองรับการแก้ไข' using errcode='22023';
      end case;
    when 'reminder' then
      perform public.ucom_cash_configure_reminder(p_payload);
    else raise exception 'ไม่รองรับคำขอนี้' using errcode='22023';
  end case;
  perform public.ucom_cash_finalize_sources(p_operation_id,v_fund,p_action='covered_sale');
  update public.ucom_cash_book set version=version+1 where id;
  perform public.ucom_cash_assert_allocations();
  if p_action in ('handover_days','settle','return','review','evidence') then
    select * into h from public.ucom_cash_handovers where id=coalesce(v_id,p_operation_id);
    v_snapshot:=public.ucom_cash_balances()||jsonb_build_object('id',h.id,'handover',h.id,'handoverId',h.id,
      'event',p_action,'eventOperationId',p_operation_id,'state',h.state,'reporter',h.reporter,
      'reporterName',(select display_name from public.profiles where id=h.reporter),
      'actorId',auth.uid(),'custodian',h.custodian,'asOf',clock_timestamp(),'version',b.version+1,
      'selectedLines',h.selected_lines,'selectedTotal',(h.amount+h.drawer_before_departure)::text,
      'drawerBeforeDeparture',h.drawer_before_departure::text,'bankBound',h.amount::text,
      'bank',h.bank::text,'drawerAfterReturn',h.drawer::text,'returnedPending',h.returned::text,
      'depositedAt',h.deposited_at,'reviewNote',h.review_note,'evidencePath',h.evidence_path,
      'deposit',case when h.bank is null then null else jsonb_build_object('bank',h.bank::text,
        'drawer',h.drawer::text,'returned',h.returned::text,'custodian',h.custodian,'depositedAt',h.deposited_at) end);
    update public.ucom_cash_handovers set snapshot=v_snapshot where id=h.id;
  end if;
  v_result:=jsonb_build_object('id',coalesce(v_id,p_operation_id),'snapshot',v_snapshot);
  update public.ucom_cash_operations set result=v_result where id=p_operation_id;
  return v_result;
end $$;

revoke all on function public.rpc_cash_execute(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.rpc_cash_execute(uuid,uuid,text,jsonb) to authenticated;
