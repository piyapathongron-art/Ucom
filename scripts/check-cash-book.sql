\set ON_ERROR_STOP on
-- LOCAL ONLY: psql ucom_cash_check -f scripts/check-cash-book.sql
-- Prerequisites: fresh disposable DB, all PRE-20261007 repository migrations,
-- Supabase auth/storage bootstrap and authenticated/anon/service_role roles.
-- Real cash migrations/RPCs run below; storage metadata is a local fixture only.
-- Single-session acceptance does not prove concurrent transaction behavior.
do $$ begin
  if current_database() <> 'ucom_cash_check' then
    raise exception 'Refusing acceptance outside disposable ucom_cash_check database';
  end if;
  if to_regclass('public.ucom_cash_book') is not null then
    raise exception 'Use a fresh baseline database; cash migrations are applied by this check';
  end if;
end $$;
begin;
\ir ../supabase/migrations/20261009040000_cash_source_privileges.sql
\ir ../supabase/migrations/20261007104254_two_fund_cash_book.sql
\ir ../supabase/migrations/20261007104638_cash_source_guards.sql
\ir ../supabase/migrations/20261007104639_cash_commands_and_evidence.sql
\ir ../supabase/migrations/20261007104640_cash_reminders.sql

create function pg_temp.check_that(ok boolean, label text) returns void
language plpgsql as $$ begin
  if ok is not true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function pg_temp.rejects(statement text, expected_code text, label text) returns void
language plpgsql as $$ declare rejected boolean := false; actual_code text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_code = returned_sqlstate;
    if actual_code <> expected_code then
      raise exception 'FAIL: %, expected %, got % (%)',label,expected_code,actual_code,sqlerrm;
    end if;
    rejected := true;
  end;
  perform pg_temp.check_that(rejected,label);
end $$;
create function pg_temp.act(action text, payload jsonb, operation uuid default gen_random_uuid())
returns jsonb language plpgsql as $$ begin
  if action='income' then
    payload:=payload||jsonb_build_object('device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64));
  end if;
  return public.rpc_cash_execute(operation,(public.rpc_cash_status()->>'epoch')::uuid,action,payload);
end $$;
create function pg_temp.balance(drawer numeric,pending numeric,reserved numeric,label text)
returns void language plpgsql as $$ declare s jsonb := public.rpc_cash_status(); begin
  perform pg_temp.check_that((s->>'drawer')::numeric=drawer and (s->>'pending')::numeric=pending
    and (s->>'reserved')::numeric=reserved and (s->>'available')::numeric=pending-reserved,label);
end $$;
create function pg_temp.ack() returns void language plpgsql as $$ begin
  perform public.rpc_cash_pos_ack((public.rpc_cash_status()->>'epoch')::uuid,
    '00000000-0000-4000-8000-000000000010',repeat('a',64),(public.rpc_cash_status()->>'version')::bigint);
end $$;
create function pg_temp.resume() returns void language plpgsql as $$ begin
  perform public.rpc_cash_pos_resume((public.rpc_cash_status()->>'epoch')::uuid,
    '00000000-0000-4000-8000-000000000010',repeat('a',64));
end $$;
create function pg_temp.sale_payload(operation uuid,price text,epoch text default null)
returns jsonb language sql as $$ select jsonb_build_object('client_uuid',operation,
  'payment_method','cash','cash_epoch',epoch,'items',jsonb_build_array(jsonb_build_object(
    'kind','service','name','LOCAL CASH ACCEPTANCE','qty',1,'unit_price',price))) $$;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003');
insert into public.profiles(id,display_name,role) values
  ('00000000-0000-4000-8000-000000000001','LOCAL OWNER','owner'),
  ('00000000-0000-4000-8000-000000000002','LOCAL STAFF','staff');
update public.ucom_cash_book set activation_ready=true where id;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.rpc_create_sale(pg_temp.sale_payload('00000000-0000-4000-8000-000000000020','100'));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.rpc_cash_execute('00000000-0000-4000-8000-000000000030',null,'open',
  jsonb_build_object('drawer','200','pending','1000','device','00000000-0000-4000-8000-000000000010',
    'deviceToken',repeat('a',64),'queueDrained',true,'physicallyPaused',true,'reason','Verified local fixture'));
select pg_temp.balance(200,1000,0,'opening amounts are exact physical funds');

-- Already-known legacy replay is opening-covered, never another cash receipt.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.rpc_cash_execute('00000000-0000-4000-8000-000000000020',null,'sale',
  jsonb_build_object('payload',pg_temp.sale_payload('00000000-0000-4000-8000-000000000020','100')));
select pg_temp.balance(200,1000,0,'100 legacy cash already in opening 1000 does not become 1100');
select pg_temp.rejects(format('select public.rpc_cash_execute(%L::uuid,null,%L,%L::jsonb)',
  '00000000-0000-4000-8000-000000000021','sale',jsonb_build_object('payload',
    pg_temp.sale_payload('00000000-0000-4000-8000-000000000021','100'))),'P0001','unknown old-epoch sale blocked');

-- Owner classifies an unexpected pre-opening operation using its original ID.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.act('covered_sale',jsonb_build_object('payload',
  pg_temp.sale_payload('00000000-0000-4000-8000-000000000021','100'),
  'originalActor','00000000-0000-4000-8000-000000000002',
  'reason','Pre-opening cash was included in physical count'),
  '00000000-0000-4000-8000-000000000021');
select pg_temp.balance(200,1000,0,'owner-classified opening-covered sale adds no cash');
-- Original staff queue must be able to acknowledge owner-classified operation.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.rpc_cash_execute('00000000-0000-4000-8000-000000000021',null,'sale',
  jsonb_build_object('payload',pg_temp.sale_payload('00000000-0000-4000-8000-000000000021','100')));
select pg_temp.balance(200,1000,0,'classified source original sale replay adds no cash');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);

select pg_temp.rejects(format('select public.rpc_cash_pos_ack(%L::uuid,%L::uuid,%L,%L::bigint)',
  public.rpc_cash_status()->>'epoch','00000000-0000-4000-8000-000000000010',repeat('b',64),public.rpc_cash_status()->>'version'),
  'P0001','exposed device UUID without correct proof cannot acknowledge POS');
select pg_temp.ack();
select pg_temp.check_that((public.rpc_cash_status()->>'isReceivingPaused')::boolean,
  'explicit POS acknowledgement pauses cash intake at the server');
select pg_temp.rejects($q$select pg_temp.act('income',
  '{"name":"LOCAL forbidden receipt while paused","amount":"100","fund":"pending"}')$q$,
  'P0001','remote income cannot receive new cash during primary pause');
select pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb,%L::uuid)','sale',
  jsonb_build_object('payload',pg_temp.sale_payload('00000000-0000-4000-8000-000000000090','100',
    public.rpc_cash_status()->>'epoch'),'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64)),
  '00000000-0000-4000-8000-000000000090'),'P0001','valid primary proof cannot receive a new sale during pause');
select pg_temp.rejects(format('select public.rpc_cash_pos_resume(%L::uuid,%L::uuid,%L)',
  public.rpc_cash_status()->>'epoch','00000000-0000-4000-8000-000000000010',repeat('b',64)),
  'P0001','another device cannot resume primary receiving by exposed UUID');
select pg_temp.act('handover',jsonb_build_object('amount','900','custodian','LOCAL STAFF',
  'version',public.rpc_cash_status()->>'version'),'00000000-0000-4000-8000-000000000040');
select pg_temp.balance(200,1000,900,'handover reserves but does not deposit cash');
select pg_temp.rejects($q$select pg_temp.act('expense',
  '{"name":"LOCAL too much","amount":"101","fund":"pending"}')$q$,'P0001','spending cannot consume reserved cash');
select pg_temp.balance(200,1000,900,'failed payment rolls back source and cash atomically');

-- Real evidence validator and INSERT RLS read a storage fixture, never a mocked validator.
insert into storage.objects(bucket_id,name,metadata) values('ucom-cash-evidence',
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000040/00000000-0000-4000-8000-000000000050.jpg',
  '{"size":100,"mimetype":"image/jpeg"}');
do $$ declare payload jsonb; original jsonb; begin
  payload:=jsonb_build_object('handoverId','00000000-0000-4000-8000-000000000040',
    'bank','800','drawer','57','returned','43','physicallyReturned',true,
    'depositedAt',clock_timestamp(),'evidencePath',
    '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000040/00000000-0000-4000-8000-000000000050.jpg');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','settle',payload||
    '{"evidencePath":"missing.jpg"}'),'22023','missing evidence cannot settle');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','settle',payload||
    '{"depositedAt":"2000-01-01T00:00:00Z"}'),'22023','deposit cannot precede cash handover');
  original:=pg_temp.act('settle',payload,'00000000-0000-4000-8000-000000000041');
  perform pg_temp.balance(257,143,0,'partial deposit: 800 bank + 57 drawer + 43 returned pending');
  perform pg_temp.check_that(pg_temp.act('settle',payload,'00000000-0000-4000-8000-000000000041')=original,
    'same settlement ID and payload returns same result');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb,%L::uuid)','settle',
    payload||'{"bank":"799","returned":"44"}','00000000-0000-4000-8000-000000000041'),
    '22023','same ID changed allocation rejected');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','settle',payload),
    'P0001','new ID cannot settle handover twice');
end $$;
select pg_temp.act('review','{"handoverId":"00000000-0000-4000-8000-000000000040","confirmed":false,"reason":"Check receipt"}');
select pg_temp.balance(257,143,0,'rejected evidence does not fabricate returned cash');
select pg_temp.act('review','{"handoverId":"00000000-0000-4000-8000-000000000040","confirmed":true,"reason":"Bank receipt checked"}');
select pg_temp.balance(257,143,0,'confirmation does not remove cash again');
select pg_temp.check_that((public.rpc_cash_status()->>'isReceivingPaused')::boolean,
  'handover and deposit settlement do not implicitly resume cash taking');
select pg_temp.resume();
select pg_temp.rejects(format('select public.rpc_cash_pos_ack(%L::uuid,%L::uuid,%L,%L::bigint)',
  public.rpc_cash_status()->>'epoch','00000000-0000-4000-8000-000000000010',repeat('a',64),
  (public.rpc_cash_status()->>'version')::bigint-1),'P0001','delayed old pause cannot succeed after explicit resume');
select pg_temp.check_that((public.rpc_cash_status()->>'isReceivingPaused')::boolean=false
  and public.rpc_cash_status()->>'ackVersion' is null,'primary explicit resume clears pause and previous acknowledgement');
select pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','handover',
  jsonb_build_object('amount','1','custodian','LOCAL no pause','version',public.rpc_cash_status()->>'version')),
  'P0001','resuming receiving invalidates remote handover permission');
select pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','close',
  jsonb_build_object('version',public.rpc_cash_status()->>'version','drawerCount','257','pendingCount','143')),
  'P0001','resuming receiving invalidates remote closing permission');

do $$ declare payment jsonb; result jsonb; begin
  payment:='{"name":"LOCAL expense","amount":"20","fund":"drawer"}';
  result:=pg_temp.act('expense',payment,'00000000-0000-4000-8000-000000000060');
  perform pg_temp.act('expense',payment,'00000000-0000-4000-8000-000000000060');
  perform pg_temp.balance(237,143,0,'payment plus replay debits only chosen fund once');
  perform pg_temp.act('correct',jsonb_build_object('table','expenses','id',result->>'id',
    'amount','30','fund','pending','reason','Payment actually came from pending cash'));
  perform pg_temp.balance(257,113,0,'source correction compensates drawer and debits corrected pending amount');
end $$;
select pg_temp.act('expense','{"name":"LOCAL bank parts","amount":"999","fund":"transfer"}');
select pg_temp.balance(257,113,0,'bank transfer changes neither cash fund');
select pg_temp.rejects($q$select pg_temp.act('expense',
  '{"name":"LOCAL precision","amount":"1.001","fund":"pending"}')$q$,'22023','fractional satang rejected before source mutation');
select pg_temp.rejects($q$select pg_temp.act('adjust',
  '{"sourceOperationId":"00000000-0000-4000-8000-000000000060","amount":"1","fund":"drawer","reason":"Missing kind"}')$q$,
  '22023','adjustment cannot omit event kind');
select pg_temp.rejects($q$select pg_temp.act('adjust',
  '{"sourceOperationId":"00000000-0000-4000-8000-000000000060","amount":"1","fund":"transfer","kind":"reconciliation","reason":"Bad fund"}')$q$,
  '22023','cash adjustment cannot silently succeed against transfer fund');
select pg_temp.rejects($q$insert into public.expenses(name,amount,spent_at,paid_from)
  values('LOCAL bypass',1,current_date,'cash')$q$,'42501','owner direct insert cannot bypass cash posting');
select pg_temp.rejects($q$delete from public.expenses where name='LOCAL expense'$q$,
  '42501','owner direct deletion cannot erase linked cash history');
select pg_temp.rejects($q$select public.rpc_add_shop_expense('LOCAL legacy bypass',1,'cash')$q$,
  '42501','legacy SECURITY DEFINER RPC cannot bypass active book');

select pg_temp.ack();
do $$ declare stale_version text := public.rpc_cash_status()->>'version'; snapshot jsonb; begin
  perform pg_temp.resume();
  perform pg_temp.act('income','{"name":"LOCAL cash receipt","amount":"10","fund":"pending"}');
  perform pg_temp.ack();
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','close',
    jsonb_build_object('version',stale_version,'drawerCount','257','pendingCount','123','note','Stale')),
    '40001','intervening movement invalidates counted version even after acknowledgement');
  snapshot:=pg_temp.act('close',jsonb_build_object('version',public.rpc_cash_status()->>'version',
    'drawerCount','257','pendingCount','123','note','LOCAL verified count'));
  perform pg_temp.check_that((snapshot->'snapshot'->>'drawerVariance')::numeric=0
    and (snapshot->'snapshot'->>'pendingVariance')::numeric=0,'closing reconciles both physical funds');
  perform pg_temp.check_that((public.rpc_cash_status()->>'isReceivingPaused')::boolean,
    'closing cannot silently resume primary cash receiving');
  perform pg_temp.rejects($q$select pg_temp.act('income',
    '{"name":"LOCAL hidden offline cash after ACK","amount":"100","fund":"pending"}')$q$,
    'P0001','new cash remains blocked after closing until explicit primary resume');
  perform pg_temp.resume();
  perform pg_temp.act('income','{"name":"LOCAL later cash","amount":"1","fund":"pending"}');
  perform pg_temp.check_that((public.rpc_cash_status()->'closings'->0->>'pending')::numeric=123,
    'historical closing snapshot does not drift after later receipts');
end $$;
select pg_temp.balance(257,124,0,'counting observes money without resetting balances');

-- Actual new post-cutover sales must increase cash exactly once, unlike covered history.
do $$ declare payload jsonb; result jsonb; begin
  payload:=jsonb_build_object('payload',pg_temp.sale_payload(
    '00000000-0000-4000-8000-000000000022','100',public.rpc_cash_status()->>'epoch'),
    'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64));
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb,%L::uuid)','sale',
    payload||jsonb_build_object('deviceToken',repeat('b',64)),
    '00000000-0000-4000-8000-000000000022'),'42501','cash sale cannot spoof receiving device');
  result:=pg_temp.act('sale',payload,'00000000-0000-4000-8000-000000000022');
  perform pg_temp.check_that(pg_temp.act('sale',payload,'00000000-0000-4000-8000-000000000022')=result,
    'new post-cutover sale has stable replay result');
  perform pg_temp.balance(257,224,0,'new cash sale and replay add 100 once to pending only');
end $$;
select pg_temp.ack();
select pg_temp.act('handover',jsonb_build_object('amount','50','custodian','LOCAL return',
  'version',public.rpc_cash_status()->>'version'),'00000000-0000-4000-8000-000000000070');
select pg_temp.balance(257,224,50,'second handover reduces only available cash');
select pg_temp.act('return','{"handoverId":"00000000-0000-4000-8000-000000000070","physicallyReturned":true,"reason":"All cash returned"}');
select pg_temp.balance(257,224,0,'physical return releases reservation without creating new income');
select pg_temp.resume();

-- Exercise actual repair and consignment writers, not just standalone expense math.
do $$ declare job uuid; other_job uuid; paid_at timestamptz; before_funds jsonb;
  payload jsonb; result jsonb; case_in uuid; case_out uuid; device_out uuid;
begin
  before_funds:=public.rpc_cash_status();
  job:=public.rpc_create_repair_job('{"customer_name":"LOCAL repair","device_desc":"LOCAL phone","quoted_price":80}');
  perform pg_temp.act('part',jsonb_build_object('id',job,'amount','20','fund','drawer'));
  select part_paid_at into paid_at from public.repair_jobs where id=job;
  perform pg_temp.balance((before_funds->>'drawer')::numeric-20,(before_funds->>'pending')::numeric,0,
    'actual part payment debits selected drawer once');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','part',
    jsonb_build_object('id',job,'amount','21','fund','pending')),'P0001','already-paid part cannot be paid again');
  perform pg_temp.act('correct',jsonb_build_object('table','repair_jobs','id',job,
    'amount','30','fund','pending','reason','Correct paid part source and amount'));
  perform pg_temp.check_that((select part_paid_at=paid_at and part_cost=30 and part_paid_from='cash'
    from public.repair_jobs where id=job),'part correction preserves physical payment time');
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric-30,0,
    'part correction restores drawer and debits pending once');
  payload:=jsonb_build_object('id',job,'payload',pg_temp.sale_payload(
    '00000000-0000-4000-8000-000000000080','80',public.rpc_cash_status()->>'epoch'),
    'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64));
  result:=pg_temp.act('repair_close',payload,'00000000-0000-4000-8000-000000000080');
  perform pg_temp.act('repair_close',payload,'00000000-0000-4000-8000-000000000080');
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric+50,0,
    'repair nested sale receipt is posted once without paying its parts twice');
  perform pg_temp.check_that((select status='collected' and sale_id=(result->>'id')::uuid
    from public.repair_jobs where id=job),'repair closure is linked to its actual receipt bill');
  other_job:=public.rpc_create_repair_job('{"customer_name":"LOCAL second repair","device_desc":"Other phone"}');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','repair_close',payload||
    jsonb_build_object('id',other_job)),'22023','new repair operation cannot attach an unrelated existing receipt UUID');
  perform pg_temp.rejects(format('select public.rpc_close_repair_job(%L::uuid,%L::jsonb)',
    other_job,payload->'payload'),'42501','legacy repair collection cannot bypass wrapper with an existing bill');
  perform pg_temp.rejects(format('update public.repair_jobs set status=%L,sale_id=%L::uuid,closed_at=clock_timestamp() where id=%L::uuid',
    'collected',result->>'id',other_job),'42501','owner direct collection cannot replace transactional receipt link');

  case_in:=public.rpc_consignment_open_in('LOCAL-CASH-IN-IMEI','LOCAL consigned phone','LOCAL partner',100);
  before_funds:=public.rpc_cash_status();
  payload:=jsonb_build_object('id',case_in,'amount','100','share','40','method','cash','account','',
    'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64));
  perform pg_temp.act('consign_sell',payload,'00000000-0000-4000-8000-000000000081');
  perform pg_temp.act('consign_sell',payload,'00000000-0000-4000-8000-000000000081');
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric+100,0,
    'incoming consignment sale receives full customer cash once');
  perform pg_temp.act('consign_pay',jsonb_build_object('id',case_in,'fund','drawer'),
    '00000000-0000-4000-8000-000000000082');
  perform pg_temp.act('consign_pay',jsonb_build_object('id',case_in,'fund','drawer'),
    '00000000-0000-4000-8000-000000000082');
  perform pg_temp.balance((before_funds->>'drawer')::numeric-40,(before_funds->>'pending')::numeric+100,0,
    'consignment owner payout debits chosen drawer only once');
  perform pg_temp.act('correct',jsonb_build_object('table','consignments','id',case_in,
    'amount','30','fund','pending','reason','Correct actual owner payout'));
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric+70,0,
    'consignment correction moves payout attribution without duplicate deduction');
  perform pg_temp.check_that((select c.partner_share=30 and d.cost=30 and i.unit_cost=30
    from public.consignments c join public.device_units d on d.id=c.device_unit_id
    join public.sale_items i on i.sale_id=c.sale_id where c.id=case_in),
    'consignment correction keeps business payout, device cost and sale cost synchronized');
  insert into public.device_units(imei,model_name,acquisition,status,list_price,cost)
    values('LOCAL-CASH-OUT-IMEI','LOCAL purchased phone','purchased','in_stock',100,20) returning id into device_out;
  case_out:=public.rpc_consignment_open_out(device_out,'LOCAL reseller',100);
  perform public.rpc_consignment_report_out(case_out,80,10);
  before_funds:=public.rpc_cash_status();
  payload:=jsonb_build_object('id',case_out,'method','cash','account','',
    'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64));
  perform pg_temp.act('consign_settle',payload,'00000000-0000-4000-8000-000000000083');
  perform pg_temp.act('consign_settle',payload,'00000000-0000-4000-8000-000000000083');
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric+70,0,
    'outgoing consignment settles actual net receipt 80 minus partner 10 once');
end $$;

do $$ declare before_funds jsonb:=public.rpc_cash_status(); refund_payload jsonb; source_id uuid; begin
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb,%L::uuid)','sale',
    jsonb_build_object('payload',pg_temp.sale_payload('00000000-0000-4000-8000-000000000084','1.001',
      public.rpc_cash_status()->>'epoch'),'device','00000000-0000-4000-8000-000000000010','deviceToken',repeat('a',64)),
    '00000000-0000-4000-8000-000000000084'),'22023','sale rejects fractional satang before legacy variables round');
  refund_payload:='{"sourceOperationId":"00000000-0000-4000-8000-000000000022","amount":"-50","fund":"pending","kind":"refund","reason":"Actual customer cash refund"}';
  perform pg_temp.act('adjust',refund_payload,'00000000-0000-4000-8000-000000000085');
  perform pg_temp.act('adjust',refund_payload,'00000000-0000-4000-8000-000000000085');
  perform pg_temp.balance((before_funds->>'drawer')::numeric,(before_funds->>'pending')::numeric-50,0,
    'actual cash refund debits once under retry');
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','adjust',refund_payload||
    '{"amount":"-51"}'),'22023','cumulative refunds cannot exceed original cash receipt');
  select id into source_id from public.sales where client_uuid='00000000-0000-4000-8000-000000000022';
  perform pg_temp.rejects(format('select pg_temp.act(%L,%L::jsonb)','correct',
    jsonb_build_object('table','sales','id',source_id,'amount','50','fund','pending','reason','Would duplicate refund')),
    'P0001','bookkeeping correction cannot remove refunded receipt again');
end $$;

-- Reminder persistence uses its real service-only RPC and server clock.
reset role;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select pg_temp.check_that(public.rpc_cash_reminder_claim(clock_timestamp()) is null,'reminders are disabled until configured');
reset role;
set local role authenticated;
select pg_temp.act('reminder',jsonb_build_object('enabled',true,'weekday',extract(dow from clock_timestamp() at time zone 'Asia/Bangkok'),
  'time','00:00','minimum','0','overdueHours',24));
reset role;
set local role service_role;
do $$ declare first_claim jsonb; retry_claim jsonb; begin
  first_claim:=public.rpc_cash_reminder_claim(clock_timestamp());
  perform pg_temp.check_that(first_claim is not null,'configured actionable funds produce reminder claim');
  perform pg_temp.check_that(public.rpc_cash_reminder_claim(clock_timestamp()) is null,'active reminder lease prevents parallel claim');
  perform public.rpc_cash_reminder_finish((first_claim->>'id')::uuid,false);
  retry_claim:=public.rpc_cash_reminder_claim(clock_timestamp());
  perform pg_temp.check_that(retry_claim->>'retryKey'=first_claim->>'retryKey'
    and retry_claim->'snapshot'=first_claim->'snapshot','reminder retry keeps same payload and delivery key');
  perform public.rpc_cash_reminder_finish((retry_claim->>'id')::uuid,true);
  perform pg_temp.check_that(public.rpc_cash_reminder_claim(clock_timestamp()) is null,'successful reminder is not delivered again that day');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.check_that((select count(*) from storage.objects where bucket_id='ucom-cash-evidence')=0,
  'other staff cannot read owner-reported private evidence through storage RLS');
select pg_temp.rejects($q$insert into storage.objects(bucket_id,name,metadata) values('ucom-cash-evidence',
  '00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000040/00000000-0000-4000-8000-000000000051.jpg',
  '{"size":100,"mimetype":"image/jpeg"}')$q$,'42501','other staff cannot upload evidence for owner handover');
select pg_temp.rejects('select public.ucom_cash_balances()','42501','member cannot call internal cash helper directly');
select pg_temp.rejects($q$select pg_temp.act('adjust',
  '{"sourceOperationId":"00000000-0000-4000-8000-000000000060","amount":"1","fund":"drawer","kind":"reconciliation","reason":"Staff attempt"}')$q$,
  '42501','staff cannot adjust cash');
select pg_temp.rejects($q$select pg_temp.act('review',
  '{"handoverId":"00000000-0000-4000-8000-000000000040","confirmed":true,"reason":"Staff attempt"}')$q$,
  '42501','staff cannot confirm bank receipt');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.rejects('select public.rpc_cash_status()','42501','shared-project nonmember cannot read cash');
select pg_temp.rejects($q$select public.rpc_cash_execute(gen_random_uuid(),null,'open','{}')$q$,
  '42501','shared-project nonmember cannot mutate cash');
reset role;
rollback;
\echo Cash acceptance completed and all fixtures/migrations rolled back.
