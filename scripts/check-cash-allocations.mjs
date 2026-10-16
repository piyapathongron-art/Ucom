// Isolated Docker fixture: never reads .env, never contacts production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const container = 'ucom-cash-review-20261007';
const db = 'ucom_cash_daily_' + Date.now();
const sql = (text, database = db) => {
  const r = spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], { input: text, encoding: 'utf8' });
  if (r.status) throw Error(r.stderr);
  return r.stdout.trim();
};
sql(`create database ${db} template ucom_cash_check;`, 'postgres');
for (const f of ['20261007104254_two_fund_cash_book.sql','20261007104638_cash_source_guards.sql','20261007104639_cash_commands_and_evidence.sql','20261007104640_cash_reminders.sql','20261009090327_daily_cash_allocations.sql','20261017090000_handover_without_receiving_pause.sql']) sql(readFileSync('supabase/migrations/' + f, 'utf8'));
const owner = '00000000-0000-4000-8000-000000000001';
const staff = '00000000-0000-4000-8000-000000000002';
sql(`create or replace function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
insert into auth.users(id) values('${owner}'),('${staff}');
insert into public.profiles(id,display_name,role) values('${owner}','LOCAL OWNER','owner'),('${staff}','LOCAL STAFF','staff');
update public.ucom_cash_book set activation_ready=true;
grant select on public.day_closings to authenticated;`);
const quoted = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const member = (query, actor = owner) => sql(`set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false); ${query}`).split('\n').at(-1);
const read = (query, actor) => JSON.parse(member('select ' + query + ';', actor), (_key, value) =>
  typeof value === 'string' && /^-?\d+\.\d+$/.test(value) ? value.replace(/0+$/, '').replace(/\.$/, '') : value);
const status = () => read('public.rpc_cash_status()');
const device = '20000000-0000-4000-8000-000000000001';
const proof = { device, deviceToken: 'a'.repeat(64) };
const opened = read(`public.rpc_cash_execute('${randomUUID()}',null,'open',${quoted({drawer:'100',pending:'57',...proof,queueDrained:true,physicallyPaused:true,reason:'Local count'})})`);
assert.ok(opened.id);
const epoch = status().epoch;
const command = (action, payload, actor = owner, id = randomUUID()) => read(`public.rpc_cash_execute('${id}','${epoch}','${action}',${quoted(payload)})`, actor);
const fail = (work, pattern) => assert.throws(work, pattern);
const days = (version = null, after = null, limit = 100) => read(`public.rpc_cash_pending_days(${version ?? 'null'},${after ? quoted(after) : 'null'},${limit})`);
const pause = () => member(`select public.rpc_cash_pos_ack('${epoch}','${device}','${proof.deviceToken}',${status().version});`);
const resume = () => member(`select public.rpc_cash_pos_resume('${epoch}','${device}','${proof.deviceToken}');`);
const receipt = (amount, day, method = 'cash') => {
  const id = randomUUID();
  return command('sale', { ...proof,payload:{client_uuid:id,cash_epoch:epoch,sold_at:day+'T10:00:00+07:00',payment_method:method,receiving_account:method==='transfer'?'local':null,items:[{kind:'service',name:'LOCAL',qty:1,unit_price:amount,unit_cost:'0',item_discount:'0'}]}},owner,id);
};
receipt('1000','2026-10-01'); receipt('500','2026-10-02');
assert.deepEqual(days().lines.map(l => l.available), ['57','1000','500']);
const expense = command('expense',{name:'FIFO',amount:'60',fund:'pending'});
assert.deepEqual(days().lines.map(l => l.available), ['997','500']);
command('correct',{table:'expenses',id:expense.id,amount:'40',fund:'pending',reason:'Reverse first 20'});
assert.deepEqual(days().lines.map(l => l.available), ['20','997','500']);
command('correct',{table:'expenses',id:expense.id,amount:'0',fund:'pending',reason:'Reverse last 40'});
assert.deepEqual(days().lines.map(l => l.available), ['57','1000','500']);
command('correct',{table:'expenses',id:expense.id,amount:'50',fund:'pending',reason:'Spend again'});
command('correct',{table:'expenses',id:expense.id,amount:'50',fund:'transfer',reason:'Bank-funded reversal'});
assert.deepEqual(days().lines.map(l => l.available), ['57','1000','500']);
const page = days(null,null,1); assert.ok(page.nextCursor);
assert.equal(days(page.version,page.nextCursor,1).lines[0].key,'date:2026-10-01');
fail(() => days(page.version-1), /ยอดเปลี่ยน/);
const departure = () => ({version:status().version,lines:days().lines.filter(l => l.receiptDay).map(l=>({key:l.key,amount:l.available})),drawerBeforeDeparture:'57',custodian:'LOCAL STAFF',drawerPhysicallySeparated:true});
pause();
fail(()=>command('handover',{version:status().version,amount:'1',custodian:'X'}), /เลือกวัน/);
fail(()=>command('handover_days',{...departure(),drawerPhysicallySeparated:false}), /ยืนยัน/);
fail(()=>command('handover_days',{...departure(),lines:[{key:'date:2026-10-01',amount:'1'}]}), /ยอดรายวันเปลี่ยน/);
const departId = randomUUID(); const depPayload = departure();
const handed = command('handover_days',depPayload,staff,departId);
assert.equal(handed.snapshot.selectedTotal,'1500'); assert.equal(handed.snapshot.bankBound,'1443');
assert.equal(status().drawer,'157'); assert.equal(status().reserved,'1443');
assert.equal(days().lines.find(l=>l.key==='date:2026-10-01').available,'0');
assert.deepEqual(command('handover_days',depPayload,staff,departId),handed);
fail(()=>command('handover_days',depPayload,owner,departId),/ข้อมูลไม่ตรงกัน/);
command('expense',{name:'Not reserved',amount:'50',fund:'pending'});
fail(()=>command('expense',{name:'Too much',amount:'8',fund:'pending'}),/ไม่พอ/);
const settlePayload={handoverId:departId,bank:'1200',drawer:'0',returned:'243',depositedAt:new Date().toISOString(),evidencePath:`${staff}/${departId}/${randomUUID()}.png`,physicallyReturned:true};
fail(()=>command('settle',settlePayload,staff),/สลิป/);
sql(`insert into storage.objects(bucket_id,name,metadata) values('ucom-cash-evidence','${settlePayload.evidencePath}','{"mimetype":"image/png","size":10}');`);
const settled = command('settle',settlePayload,staff);
assert.equal(settled.snapshot.bank,'1200'); assert.equal(status().reserved,'0');
assert.deepEqual(days().lines.map(l=>[l.key,l.available]),[[page.lines[0].key,'7'],['date:2026-10-02','243']]);
fail(()=>command('settle',settlePayload,staff),/ฝากซ้ำ/);
const review = command('review',{handoverId:departId,confirmed:true,reason:'Checked'});
assert.equal(review.snapshot.state,'confirmed');
assert.deepEqual(read(`public.rpc_cash_operation_snapshot('${settled.snapshot.eventOperationId}')`,staff).snapshot,settled.snapshot);
assert.equal(read(`public.rpc_cash_operation_snapshot('${settled.snapshot.eventOperationId}')`,staff).operationId,settled.snapshot.eventOperationId);
assert.equal(read(`public.rpc_cash_handover('${departId}')`,staff).state,'confirmed');
// ADR 0031: departure needs no receiving pause, and a receipt after loading the days does not block it.
resume(); const cancelPayload={version:status().version,lines:[{key:'date:2026-10-02',amount:'243'}],drawerBeforeDeparture:'3',custodian:'LOCAL',drawerPhysicallySeparated:true};
command('income',{name:'Concurrent bank income',amount:'1',fund:'transfer',...proof});
const canceled = command('handover_days',cancelPayload);
command('return',{handoverId:canceled.id,reason:'Canceled',physicallyReturned:true});
assert.equal(days().lines.find(l=>l.receiptDay).available,'240'); assert.equal(status().drawer,'160');
const transfer = receipt('100','2026-10-03','transfer');
fail(()=>sql(`update public.sales set sold_at='2026-10-04' where id='${transfer.id}';`),/วันที่รับเงิน/);
command('correct',{table:'sales',id:transfer.id,amount:'100',fund:'pending',reason:'Cash reclassification'});
assert.equal(days().lines.at(-1).receiptDay,'2026-10-03');
const aSale = sql("select source_id from public.ucom_cash_sources where source_table='sales' and receipt_day='2026-10-01';");
command('correct',{table:'sales',id:aSale,amount:'900',fund:'pending',reason:'Deposited receipt correction'});
assert.equal(days().lines.find(l=>l.receiptDay==='2026-10-02').available,'147');
assert.deepEqual(read(`public.rpc_cash_operation_snapshot('${settled.snapshot.eventOperationId}')`).snapshot,settled.snapshot);
// Every existing writer uses the journal, including nested repair/consignment sales.
const income = command('income',{name:'LOCAL income',amount:'100',fund:'pending',...proof});
command('correct',{table:'shop_income',id:income.id,amount:'80',fund:'pending',reason:'Reduce income'});
command('correct',{table:'shop_income',id:income.id,amount:'80',fund:'transfer',reason:'Bank income'});
fail(()=>sql(`update public.shop_income set received_at='2026-09-01' where id='${income.id}';`),/วันที่รับเงิน/);
command('correct',{table:'shop_income',id:income.id,amount:'90',fund:'pending',reason:'Back to frozen cash day'});
const job = member(`select public.rpc_create_repair_job('{"customer_name":"LOCAL","device_desc":"Phone","quoted_price":80}');`);
command('part',{id:job,amount:'20',fund:'pending'});
command('correct',{table:'repair_jobs',id:job,amount:'10',fund:'pending',reason:'Part cost reduced'});
command('correct',{table:'repair_jobs',id:job,amount:'10',fund:'drawer',reason:'Part cost from drawer'});
command('correct',{table:'repair_jobs',id:job,amount:'12',fund:'pending',reason:'Part cost switched back'});
const repairOperation=randomUUID();
command('repair_close',{id:job,...proof,payload:{client_uuid:repairOperation,cash_epoch:epoch,sold_at:'2026-10-04T10:00:00+07:00',payment_method:'cash',items:[{kind:'service',name:'Repair',qty:1,unit_price:'80'}]}},owner,repairOperation);
assert.equal(sql(`select count(*) from public.ucom_cash_origins where receipt_day='2026-10-04';`),'1');
const caseIn=member(`select public.rpc_consignment_open_in('LOCAL-DAILY-IN','LOCAL phone','LOCAL partner',100);`);
command('consign_sell',{id:caseIn,amount:'100',share:'40',method:'cash',account:'',...proof});
command('consign_pay',{id:caseIn,fund:'pending'});
command('correct',{table:'consignments',id:caseIn,amount:'30',fund:'pending',reason:'Payout reduced'});
command('correct',{table:'consignments',id:caseIn,amount:'30',fund:'transfer',reason:'Bank payout'});
command('correct',{table:'consignments',id:caseIn,amount:'25',fund:'pending',reason:'Cash payout again'});
const deviceOut=sql("insert into public.device_units(imei,model_name,acquisition,status,list_price,cost) values('LOCAL-DAILY-OUT','LOCAL phone','purchased','in_stock',100,20) returning id;").split('\n')[0];
const caseOut=member(`select public.rpc_consignment_open_out('${deviceOut}','LOCAL reseller',100);`);
member(`select public.rpc_consignment_report_out('${caseOut}',80,10);`);
command('consign_settle',{id:caseOut,method:'cash',account:'',...proof});
const beforeAdjust=status(); const sourceOperation=sql(`select original_operation from public.ucom_cash_sources where source_table='sales' and source_id='${transfer.id}';`);
command('adjust',{sourceOperationId:sourceOperation,amount:'-20',fund:'pending',kind:'refund',reason:'Actual refund'});
command('adjust',{sourceOperationId:sourceOperation,amount:'-5',fund:'drawer',kind:'refund',reason:'Drawer refund'});
fail(()=>command('adjust',{sourceOperationId:sourceOperation,amount:'-76',fund:'pending',kind:'refund',reason:'Excess'}),/ยอดคืนเกิน/);
command('adjust',{sourceOperationId:sourceOperation,amount:'25',fund:'pending',kind:'reconciliation',reason:'Unknown current cash'});
command('adjust',{sourceOperationId:sourceOperation,amount:'-25',fund:'pending',kind:'reconciliation',reason:'Physical shortfall'});
assert.equal(Number(status().pending),Number(beforeAdjust.pending)-20);
assert.equal(Number(status().drawer),Number(beforeAdjust.drawer)-5);
// Pagination cannot truncate more than 100 distinct unknown batches.
for(let i=0;i<102;i++) command('adjust',{sourceOperationId:sourceOperation,amount:'1',fund:'pending',kind:'reconciliation',reason:'Batch '+i});
const largePage=days(null,null,100); assert.equal(largePage.lines.length,100); assert.ok(largePage.nextCursor);
const remainingPage=days(largePage.version,largePage.nextCursor,100); assert.ok(remainingPage.lines.length>2); assert.equal(remainingPage.nextCursor,null);
fail(()=>sql(readFileSync('supabase/migrations/20261009090327_daily_cash_allocations.sql','utf8')),/unopened/);
sql('select public.ucom_cash_assert_allocations();');
assert.equal(sql("select count(*) from public.ucom_cash_sources where source_table in ('sales','shop_income') and not day_frozen;"),'0');
console.log('SQL allocation checks passed; local database:',db);

// Real PostgREST instance against this isolated database; signed fixture JWT only.
const rest = 'ucom-cash-daily-rest-'+Date.now();
const port = 55445;
const secret = 'ucom-local-cash-fixture-jwt-secret-20261007-32chars';
const run = spawnSync('docker',['run','-d','--name',rest,'-p',`127.0.0.1:${port}:3000`,
  '-e',`PGRST_DB_URI=postgres://postgres@host.docker.internal:55439/${db}`,
  '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+secret,
  'public.ecr.aws/supabase/postgrest:v16.1'],{encoding:'utf8'});
if(run.status) throw Error(run.stderr);
const token = actor => {
  const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const b=Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
  return h+'.'+b+'.'+createHmac('sha256',secret).update(h+'.'+b).digest('base64url');
};
// The parent PostgreSQL container may not publish this port; HTTP executes inside its network.
const http = (name,payload,actor=owner) => {
  const program = `const r=await fetch(${JSON.stringify('http://127.0.0.1:'+port+'/rpc/'+name)},{method:'POST',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json',Authorization:${JSON.stringify('Bearer '+token(actor))}},body:${JSON.stringify(JSON.stringify(payload))}});console.log(await r.text());console.log(r.status);`;
  const response=spawnSync(process.execPath,['--input-type=module','-e',program],{encoding:'utf8',timeout:6500});
  if(response.status) throw Error(response.stderr);
  const output=response.stdout.trim().split('\n'); const code=Number(output.pop());
  return {code,body:JSON.parse(output.join('\n')||'null')};
};
for(let retry=0;retry<15;retry++) {
  try {if(http('rpc_cash_status',{}).code===200)break;} catch {await new Promise(resolve=>setTimeout(resolve,200));}
}
assert.equal(http('rpc_cash_status',{},staff).body.dayAllocationsEnabled,true);
assert.equal(http('rpc_cash_pending_days',{p_limit:1},staff).code,200);
assert.equal(http('rpc_cash_pending_days',{p_version:-1},staff).code,500);
assert.equal(http('rpc_cash_handover',{p_handover_id:departId},staff).body.state,'confirmed');
assert.equal(http('rpc_cash_operation_snapshot',{p_operation_id:settled.snapshot.eventOperationId},staff).body.snapshot.state,'reported');
assert.equal(http('rpc_cash_pending_days',{},'00000000-0000-4000-8000-000000000003').code,403);
assert.equal(http('rpc_cash_execute',{p_operation_id:departId,p_epoch:epoch,p_action:'handover_days',p_payload:depPayload},owner).code,400);
const current=http('rpc_cash_status',{}).body;
assert.equal(http('rpc_cash_pos_ack',{p_epoch:epoch,p_device:device,p_device_token:proof.deviceToken,p_version:current.version}).code,204);
const availableDate=http('rpc_cash_pending_days',{}).body.lines.find(l=>Number(l.available)>0);
const httpId=randomUUID();
const httpDeparture={p_operation_id:httpId,p_epoch:epoch,p_action:'handover_days',p_payload:{version:current.version,lines:[{key:availableDate.key,amount:availableDate.available}],drawerBeforeDeparture:'0',drawerPhysicallySeparated:true,custodian:'HTTP STAFF'}};
const httpHanded=http('rpc_cash_execute',httpDeparture,staff); assert.equal(httpHanded.code,200);
assert.deepEqual(http('rpc_cash_execute',httpDeparture,staff),httpHanded);
// ADR 0031: without the pause gate, re-reserving the same lines fails on the exact per-line amount check.
const reReserve=http('rpc_cash_execute',{...httpDeparture,p_operation_id:randomUUID()},staff); assert.equal(reReserve.code,500); assert.equal(reReserve.body.code,'40001');
const evidencePath=`${staff}/${httpId}/${randomUUID()}.png`;
sql(`insert into storage.objects(bucket_id,name,metadata) values('ucom-cash-evidence','${evidencePath}','{"mimetype":"image/png","size":10}');`);
const httpSettle={p_operation_id:randomUUID(),p_epoch:epoch,p_action:'settle',p_payload:{handoverId:httpId,bank:httpHanded.body.snapshot.bankBound,drawer:'0',returned:'0',depositedAt:new Date().toISOString(),evidencePath,physicallyReturned:true}};
const httpSettled=http('rpc_cash_execute',httpSettle,staff); assert.equal(httpSettled.code,200);
assert.deepEqual(http('rpc_cash_execute',httpSettle,staff),httpSettled);
assert.equal(http('rpc_cash_execute',{...httpSettle,p_operation_id:randomUUID()},staff).code,400);
sql('select public.ucom_cash_assert_allocations();');
console.log('Real local PostgREST checks passed; retained fixture container:',rest);
spawnSync('docker',['stop',rest],{encoding:'utf8'});

// Concurrent commands race through the real singleton book lock.
const parallelSql = text => new Promise(resolve => {
  const child=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',db]);
  let output=''; let errors='';
  child.stdout.on('data',chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{errors+=chunk;});
  child.on('close',code=>resolve({code,output,errors})); child.stdin.end(text);
});
const raceDays=days(); const raceLine=raceDays.lines.find(l=>Number(l.available)>0);
pause();
const raceId=randomUUID();
const racePayload={version:status().version,lines:[{key:raceLine.key,amount:raceLine.available}],drawerBeforeDeparture:'0',drawerPhysicallySeparated:true,custodian:'RACE'};
const races=await Promise.all([
  parallelSql(`begin; select set_config('request.jwt.claim.sub','${owner}',true); select 1 from public.ucom_cash_book for update; select pg_sleep(0.3); select public.rpc_cash_execute('${raceId}','${epoch}','handover_days',${quoted(racePayload)}); commit;`),
  parallelSql(`begin; set role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); select public.rpc_cash_execute('${randomUUID()}','${epoch}','expense',${quoted({name:'RACE expense',amount:'1',fund:'pending'})}); commit;`)
]);
// Either both effects serialize safely or departure loses expected version and rolls back.
assert.equal(races[1].code,0);
if(races[0].code!==0) assert.match(races[0].errors,/ยอดเปลี่ยน|พักรับเงิน/);
sql('select public.ucom_cash_assert_allocations();');
assert.equal(sql("select count(*) from public.ucom_cash_origin_balances() where available<0 or reserved<0;"),'0');
assert.equal(sql("select has_table_privilege('anon','public.ucom_cash_origins','SELECT') or has_table_privilege('authenticated','public.ucom_cash_allocations','INSERT');"),'f');
fail(()=>sql(`update public.ucom_cash_operations set result='{}' where id='${departId}';`),/immutable/);
fail(()=>sql(`update public.ucom_cash_sources set receipt_day='2026-01-01' where source_id='${transfer.id}';`),/immutable/);
console.log('Concurrent departure/spending, direct-privilege and immutable-history checks passed.');
const allAvailable=[]; let cursor=null; let selectionVersion=null;
do {
  const page=days(selectionVersion,cursor,100); selectionVersion=page.version;
  allAvailable.push(...page.lines.filter(l=>Number(l.available)>0).map(l=>({key:l.key,amount:l.available})));
  cursor=page.nextCursor;
} while(cursor);
pause();
const fullyReserved=command('handover_days',{version:status().version,lines:allAvailable,drawerBeforeDeparture:'0',drawerPhysicallySeparated:true,custodian:'All remaining cash'});
assert.equal(status().available,'0');
fail(()=>command('correct',{table:'sales',id:aSale,amount:'899',fund:'pending',reason:'Cannot consume bank-bound money'}),/ไม่พอ/);
fail(()=>command('expense',{name:'Reserved is not spendable',amount:'1',fund:'pending'}),/ไม่พอ/);
command('return',{handoverId:fullyReserved.id,reason:'Local full physical return',physicallyReturned:true});
sql('select public.ucom_cash_assert_allocations();');

// Read installed bodies back instead of assuming the file was installed as intended.
// Later migrations replace earlier bodies, so compare against the last definition of each function.
const migrationText=readFileSync('supabase/migrations/20261009090327_daily_cash_allocations.sql','utf8');
const expectedBodies=new Map();
for(const file of ['20261009090327_daily_cash_allocations.sql','20261017090000_handover_without_receiving_pause.sql'])
  for(const match of readFileSync('supabase/migrations/'+file,'utf8').matchAll(/create (?:or replace )?function public\.(\w+)\([^]*?as \$\$([^]*?)\$\$;/g)) expectedBodies.set(match[1],match[2].trim());
for(const [name,body] of expectedBodies) {
  const actual=sql(`select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${name}';`);
  assert.equal(actual,body,name+' body readback');
}
const installDb='ucom_cash_install_race_'+Date.now();
sql(`create database ${installDb} template ucom_cash_check;`,'postgres');
for(const file of ['20261007104254_two_fund_cash_book.sql','20261007104638_cash_source_guards.sql','20261007104639_cash_commands_and_evidence.sql','20261007104640_cash_reminders.sql']) sql(readFileSync('supabase/migrations/'+file,'utf8'),installDb);
sql(`insert into auth.users(id) values('${owner}'); insert into public.profiles(id,display_name,role) values('${owner}','LOCAL OWNER','owner'); update public.ucom_cash_book set activation_ready=true;`,installDb);
const installParallel = text => new Promise(resolve=> {
  const child=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',installDb]);
  let errors=''; child.stderr.on('data',chunk=>{errors+=chunk;});child.on('close',code=>resolve({code,errors}));child.stdin.end(text);
});
const installing=installParallel(migrationText.replace('end $$;',()=> 'end $$;\nselect pg_sleep(0.5);'));
await new Promise(resolve=>setTimeout(resolve,100));
const opening=installParallel(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select public.rpc_cash_execute('${randomUUID()}',null,'open',${quoted({drawer:'1',pending:'1',...proof,queueDrained:true,physicallyPaused:true,reason:'Concurrent install opening'})});`);
const installationRace=await Promise.all([installing,opening]);
assert.deepEqual(installationRace.map(r=>r.code),[0,0],JSON.stringify(installationRace));
assert.equal(sql('select count(*) from public.ucom_cash_origins;',installDb),'1');
sql('select public.ucom_cash_assert_allocations();',installDb);
console.log('Installed function bodies match source; migration/open concurrency conserves provenance.');
