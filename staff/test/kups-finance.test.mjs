import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {finance,validDate,validateTransaction,assertGroupAccess} from '../src/kups-finance.mjs';
import {sha} from '../src/core.mjs';
import worker from '../src/worker.mjs';
const g='dayun-rimba-sejahtera',email='admin@yayasangambut.org';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,role TEXT,disabled INTEGER DEFAULT 0); INSERT INTO users VALUES('u','admin@yayasangambut.org','Admin','admin',0); INSERT INTO users VALUES('member','member@gmail.com','Member','staff',0);");
 db.exec(readFileSync(new URL('../migrations/0005_webgis_sso.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0006_kups_finance.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0007_kups_accounts_documents.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/0029_kups_closing_reconciliation.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO webgis_access VALUES('member@gmail.com','kups-finance',0)");
 const adapter={prepare(sql){let args=[];const wrapper={bind(...v){args=v;return wrapper;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};return wrapper;},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};return {db,env:{DB:adapter}};
}
async function auth(f,user='u'){const raw='yg-google-'+user;await f.env.DB.prepare('INSERT INTO webgis_sessions VALUES(?,?,?,?,?)').bind(await sha(raw),user,user==='u'?'webgis-staff':'kups-finance',user==='u'?'admin':'kups',Date.now()+100000).run();return raw;}
const tx=(extra={})=>({date:'2026-08-10',kind:'income',category:extra.kind==='expense'?'Biaya lainnya':'Penjualan nanas',description:'Nanas',amount:10000,...extra});
async function call(f,raw,path,method='GET',b){const url=new URL('https://staff.yayasangambut.org/api/kups'+path);url.searchParams.set('group',g);const req=new Request(url,{method,headers:{Origin:'https://webgisyg.id',Authorization:'Bearer '+raw,'Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const r=await finance(req,f.env,url);return {status:r.status,data:await r.json()};}

test('closing reconciliation preserves openings, transactions, account mapping and open periods',async()=>{
 const f=fixture(),raw=await auth(f);
 await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:10000.855265,version:1});
 await call(f,raw,'/transactions','POST',tx({amount:3000}));
 const before=(await call(f,raw,'/ledger?month=2026-08')).data;
 const request={month:'2026-08',cash_amount:5001,bank_amount:8000,note:'Saldo akhir sesuai laporan',version:0};
 assert.equal((await call(f,raw,'/reconciliation?month=2026-08','POST',request)).status,200);
 const after=(await call(f,raw,'/ledger?month=2026-08')).data;
 assert.deepEqual(after.summary,before.summary);assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.accounts,before.accounts);
 assert.deepEqual(after.group,before.group);assert.equal(after.period,null);
 assert.equal(after.reconciliation.cash_amount,5001);assert.equal(after.reconciliation.bank_amount,8000);
 assert.equal(after.reconciliation.book_amount,13000.855265);assert.equal(after.reconciliation.version,1);
 assert.ok(Math.abs(after.reconciliation.cash_amount+after.reconciliation.bank_amount-after.summary.closing-0.144735)<1e-8);
 assert.equal((await call(f,raw,'/reconciliation?month=2026-08','POST',request)).status,409);
 assert.equal(f.db.prepare("SELECT COUNT(*) n FROM kups_audit WHERE action='closing-reconciliation'").get().n,1);
 assert.equal((await call(f,raw,'/reconciliation?month=2026-08','POST',{...request,note:'Diperiksa ulang',version:1})).status,200);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM kups_reconciliations').get().n,1);
 assert.equal((await call(f,raw,'/ledger?month=2026-09')).data.reconciliation,null);
});

test('September reconciliation carries bank and cash into October without writing or duplicating transactions',async()=>{
 const f=fixture(),raw=await auth(f);
 await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:30508299.855265,version:1});
 await call(f,raw,'/transactions','POST',tx({date:'2026-09-01',amount:353000}));
 await call(f,raw,'/transactions','POST',tx({date:'2026-09-30',kind:'expense',amount:8370000}));
 const september=(await call(f,raw,'/ledger?month=2026-09')).data;
 assert.equal((await call(f,raw,'/reconciliation?month=2026-09','POST',{month:'2026-09',bank_amount:9314784,cash_amount:13176516,note:'BKU September',version:0})).status,200);
 const snapshot=()=>JSON.stringify({group:f.db.prepare('SELECT * FROM kups_groups').all(),rows:f.db.prepare('SELECT * FROM kups_transactions').all(),opens:f.db.prepare('SELECT * FROM kups_account_openings').all(),audit:f.db.prepare('SELECT * FROM kups_audit').all()});
 const before=snapshot();
 for(let i=0;i<2;i++){
  const october=(await call(f,raw,'/ledger?month=2026-10')).data;
  assert.equal(october.summary.opening,22491300);assert.equal(october.summary.closing,22491300);
  assert.equal(october.accounts.find(a=>a.id==='bank').opening,9314784);
  assert.equal(october.accounts.find(a=>a.id==='cash').opening,13176516);
  assert.equal(october.accounts.find(a=>a.id==='unassigned').opening,0);
  assert.equal(october.rows.length,0);assert.equal(october.opening_reconciliation.month,'2026-09');
 }
 assert.equal(snapshot(),before);
 assert.deepEqual((await call(f,raw,'/ledger?month=2026-09')).data.summary,september.summary);
 // Subsequent cash movements are counted once; deleted movements stay excluded.
 await call(f,raw,'/transactions','POST',tx({date:'2026-10-02',amount:10000,account:'bank'}));
 await call(f,raw,'/transactions','POST',tx({date:'2026-10-03',kind:'expense',amount:3000,account:'cash'}));
 await call(f,raw,'/transfers','POST',{date:'2026-10-04',from_account:'bank',to_account:'cash',amount:2000,description:'Tarik tunai'});
 let november=(await call(f,raw,'/ledger?month=2026-11')).data;
 assert.equal(november.summary.opening,22498300);
 assert.equal(november.accounts.find(a=>a.id==='bank').opening,9322784);
 assert.equal(november.accounts.find(a=>a.id==='cash').opening,13175516);
 assert.equal((await call(f,raw,'/reconciliation?month=2026-10','POST',{month:'2026-10',bank_amount:9322784,cash_amount:13175516,note:'Oktober',version:0})).status,200);
 const october=(await call(f,raw,'/ledger?month=2026-10')).data;
 assert.equal(october.reconciliation.book_amount,october.summary.closing);
 november=(await call(f,raw,'/ledger?month=2026-11')).data;
 assert.equal(november.opening_reconciliation.month,'2026-10');assert.equal(november.summary.opening,22498300);
});

test('reconciliation is admin only and rejects mismatched month, invalid amounts and stale versions',async()=>{
 const f=fixture(),admin=await auth(f),member=await auth(f,'member');
 f.db.exec("INSERT INTO kups_members VALUES('dayun-rimba-sejahtera','member@gmail.com','treasurer',0)");
 await call(f,admin,'/setup','POST',{start_date:'2026-08-01',opening_amount:10000,version:1});
 const b={month:'2026-08',cash_amount:5000,bank_amount:5000,note:'',version:0};
 assert.equal((await call(f,member,'/reconciliation?month=2026-08','POST',b)).status,403);
 for(const patch of [{month:'2026-09'},{cash_amount:-1},{bank_amount:1.5},{bank_amount:1e12+1},{version:-1},{note:'x'.repeat(501)}])assert.equal((await call(f,admin,'/reconciliation?month=2026-08','POST',{...b,...patch})).status,400);
 assert.equal((await call(f,admin,'/reconciliation?month=2026-07','POST',{...b,month:'2026-07'})).status,400);
 assert.equal((await call(f,admin,'/reconciliation?month=2026-08','POST',{...b,version:2})).status,409);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM kups_reconciliations').get().n,0);
});
test('dates and integer money reject invalid calendar days and decimal currency',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-99-99'),false);assert.throws(()=>validateTransaction(tx({amount:1.1})));assert.throws(()=>validateTransaction(tx({quantity:5,unit:''})));});
test('KUPS role cannot impersonate administrator or cross group boundaries',()=>{assert.throws(()=>assertGroupAccess({scope:'kups-finance',role:'admin'},null));assert.throws(()=>assertGroupAccess({scope:'kups-finance',role:'kups'},{role:'viewer',disabled:0},true));assert.throws(()=>assertGroupAccess({scope:'webgis-staff',role:'staff'},null));});
test('anonymous, unlisted member and incorrect Origin are rejected',async()=>{const f=fixture(),raw=await auth(f,'member');assert.equal((await call(f,'bad','/groups')).status,401);assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,403);const r=await finance(new Request('https://staff.yayasangambut.org/api/kups/groups',{headers:{Origin:'https://evil.example',Authorization:'Bearer '+raw}}),f.env,new URL('https://staff.yayasangambut.org/api/kups/groups'));assert.equal(r.status,403);});
test('cash ledger survives edit, trash, restore and next month carry forward',async()=>{const f=fixture(),raw=await auth(f);assert.equal((await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:50000,version:1})).status,200);const created=await call(f,raw,'/transactions','POST',tx());const id=created.data.id;await call(f,raw,'/transactions','POST',tx({kind:'expense',amount:3000}));assert.equal((await call(f,raw,'/ledger?month=2026-08')).data.summary.closing,57000);assert.equal((await call(f,raw,'/transactions/'+id,'PUT',tx({amount:12000,version:1}))).status,200);assert.equal((await call(f,raw,'/transactions/'+id,'PUT',tx({amount:20000,version:1}))).status,409);await call(f,raw,'/transactions/'+id+'/trash','POST',{version:2,reason:'Duplikat'});assert.equal((await call(f,raw,'/ledger?month=2026-08')).data.summary.closing,47000);await call(f,raw,'/transactions/'+id+'/restore','POST',{version:3});assert.equal((await call(f,raw,'/ledger?month=2026-09')).data.summary.opening,59000);assert.equal(f.db.prepare("SELECT count(*) n FROM kups_audit WHERE action='edit'").get().n,1);});
test('closing protects create, edit, delete and stale report version',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:50000,version:1});const id=(await call(f,raw,'/transactions','POST',tx())).data.id;assert.equal((await call(f,raw,'/period','POST',{month:'2026-08',action:'close',counted_amount:60000,note:'Diperiksa',version:1})).status,409);assert.equal(f.db.prepare('SELECT count(*) n FROM kups_periods').get().n,0);await call(f,raw,'/period','POST',{month:'2026-08',action:'close',counted_amount:60000,note:'Diperiksa',version:2});assert.equal((await call(f,raw,'/transactions','POST',tx())).status,409);assert.equal((await call(f,raw,'/transactions/'+id+'/trash','POST',{version:1,reason:'Koreksi'})).status,409);assert.equal((await call(f,raw,'/transactions/'+id,'PUT',tx({date:'2026-09-01',version:1}))).status,409);await call(f,raw,'/period','POST',{month:'2026-08',action:'reopen',note:'Koreksi',version:3});assert.equal((await call(f,raw,'/transactions/'+id,'PUT',tx({amount:11000,version:1}))).status,200);});
test('viewer can read but cannot edit; evidence from another group is rejected',async()=>{const f=fixture(),raw=await auth(f,'member'),owner=await auth(f);f.db.exec("INSERT INTO kups_members VALUES('dayun-rimba-sejahtera','member@gmail.com','viewer',0)");await call(f,owner,'/setup','POST',{start_date:'2026-08-01',opening_amount:0,version:1});assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,200);assert.equal((await call(f,raw,'/transactions','POST',tx())).status,403);assert.equal((await call(f,owner,'/transactions','POST',tx({evidence_id:'other'}))).status,400);assert.equal((await call(f,raw,'/members','GET')).status,403);});
test('import is atomic and cannot duplicate source or include closed dates',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:0,version:1});assert.equal((await call(f,raw,'/import','POST',{rows:[tx({source_ref:'old:10'}),tx({source_ref:'old:11'})]})).status,200);assert.equal((await call(f,raw,'/import','POST',{rows:[tx({source_ref:'old:10'})]})).status,409);assert.equal((await call(f,raw,'/import','POST',{rows:[tx({source_ref:'old:12'}),tx({date:'2026-07-10',source_ref:'old:13'})]})).status,409);assert.equal(f.db.prepare('SELECT count(*) n FROM kups_transactions').get().n,2);});
test('historical import retains transactions while opening remains unknown',async()=>{const f=fixture(),raw=await auth(f);assert.equal((await call(f,raw,'/import','POST',{rows:[tx({source_ref:'archive:10'})]})).status,200);const result=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(result.summary.opening,null);assert.equal(result.summary.closing,null);assert.equal(result.summary.income,10000);assert.equal((await call(f,raw,'/setup','POST',{start_date:'2026-08-20',opening_amount:50000,version:1})).status,400);});
test('legacy opening fractions are preserved without changing integer transaction amounts',async()=>{const f=fixture(),raw=await auth(f);const initial=50000.855265;assert.equal((await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:initial,version:1})).status,200);await call(f,raw,'/transactions','POST',tx());const s=(await call(f,raw,'/ledger?month=2026-08')).data.summary;assert.equal(s.opening,initial);assert.equal(s.closing,initial+10000);assert.equal((await call(f,raw,'/transactions','POST',tx({amount:10.85}))).status,400);});
test('external KUPS identity cannot use website cookie APIs even with a forged scope role',async()=>{const f=fixture();f.db.exec('CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires INTEGER)');const raw='external-cookie';await f.env.DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await sha(raw),'member',Date.now()+100000).run();const r=await worker.fetch(new Request('https://staff.yayasangambut.org/api/me',{headers:{Cookie:'__Host-yg-session='+raw}}),{...f.env,APP_ORIGIN:'https://staff.yayasangambut.org',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',GOOGLE_CLIENT_ID:'configured',GOOGLE_CLIENT_SECRET:'configured'});assert.equal(r.status,403);});
test('Workspace members designated finance-only also cannot reuse website cookie sessions',async()=>{const f=fixture();f.db.exec("CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires INTEGER); UPDATE users SET email='member@yayasangambut.org' WHERE id='member'; UPDATE webgis_access SET email='member@yayasangambut.org' WHERE email='member@gmail.com';");const raw='workspace-member-cookie';await f.env.DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await sha(raw),'member',Date.now()+100000).run();const r=await worker.fetch(new Request('https://staff.yayasangambut.org/api/me',{headers:{Cookie:'__Host-yg-session='+raw}}),{...f.env,APP_ORIGIN:'https://staff.yayasangambut.org',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',GOOGLE_CLIENT_ID:'configured',GOOGLE_CLIENT_SECRET:'configured'});assert.equal(r.status,403);});
const invoice=(extra={})=>({date:'2026-08-10',kind:'income',category:'Penjualan nanas',description:'Penjualan Queen',total_amount:100000,counterparty:'Pembeli',quantity:20,unit:'buah',unit_price:5000,product:'Queen grade A',amount:30000,account:'cash',...extra});
test('partial sale creates one document and only received cash; subsequent payments settle without duplicate sale',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:50000,version:1});const created=await call(f,raw,'/documents','POST',invoice());assert.equal(created.status,201,JSON.stringify(created));const id=created.data.id;let result=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(result.summary.income,30000);assert.equal(result.summary.closing,80000);assert.equal(result.outstanding.receivable,70000);assert.equal(result.documents.length,1);assert.equal((await call(f,raw,'/documents/'+id+'/payment','POST',{date:'2026-09-01',amount:70000,account:'bank'})).status,201);result=(await call(f,raw,'/ledger?month=2026-09')).data;assert.equal(result.summary.income,70000);assert.equal(result.outstanding.receivable,0);assert.equal(result.documents.length,1);assert.equal((await call(f,raw,'/ledger?month=2026-08')).data.outstanding.receivable,70000);assert.equal((await call(f,raw,'/documents/'+id+'/payment','POST',{date:'2026-09-02',amount:1,account:'bank'})).status,409);});
test('unpaid expense creates a payable without affecting cash; sales/wages/category validation enforced',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:50000,version:1});assert.equal((await call(f,raw,'/documents','POST',invoice({kind:'expense',category:'Pupuk & Ethrel',amount:0,counterparty:'Toko pupuk'}))).status,201);let r=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(r.summary.expense,0);assert.equal(r.summary.closing,50000);assert.equal(r.outstanding.payable,100000);assert.equal((await call(f,raw,'/documents','POST',invoice({kind:'expense',category:'Penjualan nanas'}))).status,400);assert.equal((await call(f,raw,'/documents','POST',invoice({counterparty:''}))).status,201);assert.equal((await call(f,raw,'/documents','POST',invoice({unit:'hari'}))).status,400);assert.equal((await call(f,raw,'/documents','POST',invoice({kind:'expense',category:'Upah',activity:'',unit:'hari'}))).status,201);assert.equal((await call(f,raw,'/documents','POST',invoice({kind:'expense',category:'Upah',activity:'Pemupukan A',unit:'hari'}))).status,201);});
test('transfer moves balances between cash/bank without business income/expense; trash and restore stay balanced',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:100000,version:1});assert.equal((await call(f,raw,'/accounts','POST',{cash:20000,bank:80000,version:2})).status,200);const t={date:'2026-08-12',from_account:'bank',to_account:'cash',amount:10000,description:'Tarik tunai'};const created=await call(f,raw,'/transfers','POST',t);assert.equal(created.status,201);let r=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(r.summary.income,0);assert.equal(r.summary.expense,0);assert.equal(r.summary.closing,100000);assert.equal(r.accounts.find(a=>a.id==='cash').closing,30000);assert.equal(r.accounts.find(a=>a.id==='bank').closing,70000);assert.equal((await call(f,raw,'/transfers/'+created.data.id+'/trash','POST',{version:1,reason:'Koreksi'})).status,200);r=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(r.accounts.find(a=>a.id==='cash').closing,20000);assert.equal((await call(f,raw,'/transfers/'+created.data.id+'/restore','POST',{version:2})).status,200);assert.equal((await call(f,raw,'/transfers','POST',{...t,to_account:'bank'})).status,400);});
test('closed invoice can receive a future payment; closed-month transfer/edit stays blocked',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:100000,version:1});const id=(await call(f,raw,'/documents','POST',invoice())).data.id;await call(f,raw,'/period','POST',{month:'2026-08',action:'close',counted_amount:130000,note:'Pemeriksaan',version:2});assert.equal((await call(f,raw,'/documents/'+id+'/payment','POST',{date:'2026-08-20',amount:70000,account:'cash'})).status,409);assert.equal((await call(f,raw,'/documents/'+id+'/payment','POST',{date:'2026-09-01',amount:70000,account:'cash'})).status,201);assert.equal((await call(f,raw,'/documents/'+id,'PUT',invoice({version:1}))).status,409);assert.equal((await call(f,raw,'/transfers','POST',{date:'2026-08-20',from_account:'bank',to_account:'cash',amount:1000,description:'Tarik'})).status,409);});
test('payment edits/restores cannot exceed document total; document cannot be deleted while cash payments remain',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:100000,version:1});const doc=(await call(f,raw,'/documents','POST',invoice())).data.id;const p=(await call(f,raw,'/ledger?month=2026-08')).data.rows[0];assert.equal((await call(f,raw,'/documents/'+doc+'/trash','POST',{version:1,reason:'Koreksi'})).status,409);assert.equal((await call(f,raw,'/documents/'+doc,'PUT',invoice({total_amount:20000,version:1}))).status,409);assert.equal((await call(f,raw,'/transactions/'+p.id,'PUT',tx({amount:100001,version:1}))).status,409);await call(f,raw,'/transactions/'+p.id+'/trash','POST',{version:1,reason:'Koreksi'});await call(f,raw,'/documents/'+doc+'/payment','POST',{date:'2026-08-15',amount:100000,account:'bank'});assert.equal((await call(f,raw,'/transactions/'+p.id+'/restore','POST',{version:2})).status,409);});
test('repeat submission is idempotent and unknown historical accounts remain unassigned',async()=>{const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:100000,version:1});const b=invoice({request_id:crypto.randomUUID()});const first=await call(f,raw,'/documents','POST',b),second=await call(f,raw,'/documents','POST',b);assert.equal(first.status,201);assert.equal(second.status,200);assert.equal(second.data.id,first.data.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM kups_transactions').get().n,1);await call(f,raw,'/import','POST',{rows:[tx({source_ref:'old-account:10'})]});const r=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(r.rows.find(t=>t.source_ref==='old-account:10').account,'unassigned');assert.equal(r.accounts.find(a=>a.id==='cash').closing,null);const viewer=await auth(f,'member');f.db.exec("INSERT INTO kups_members VALUES('dayun-rimba-sejahtera','member@gmail.com','viewer',0)");assert.equal((await call(f,viewer,'/documents','POST',invoice())).status,403);assert.equal((await call(f,viewer,'/transfers','POST',{date:'2026-08-20',from_account:'bank',to_account:'cash',amount:1000,description:'Tarik'})).status,403);});

const accessMigration=()=>readFileSync(new URL('../migrations/0008_kups_read_access.sql',import.meta.url),'utf8');
async function workspaceAuth(f){
 f.db.exec("INSERT INTO users VALUES('ygstaff','staff@yayasangambut.org','YG Staff','staff',0)");
 const raw='yg-google-ygstaff';
 await f.env.DB.prepare('INSERT INTO webgis_sessions VALUES(?,?,?,?,?)').bind(await sha(raw),'ygstaff','webgis-staff','staff',Date.now()+100000).run();
 return raw;
}
test('verified YG staff can read groups and ledger, but cannot mutate finance or manage members',async()=>{
 const f=fixture(),raw=await workspaceAuth(f);
 const groups=await call(f,raw,'/groups');assert.equal(groups.status,200);assert.equal(groups.data.groups[0].access,'viewer');
 assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,200);
 for(const path of ['/transactions','/documents','/transfers','/members','/setup','/period','/import','/evidence'])assert.equal((await call(f,raw,path,'POST',{})).status,403,path);
 assert.equal((await call(f,raw,'/members')).status,403);
 f.db.exec("INSERT INTO kups_members VALUES('dayun-rimba-sejahtera','staff@yayasangambut.org','viewer',1)");
 assert.equal((await call(f,raw,'/groups')).data.groups.length,0);
 assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,403);
 f.db.exec("UPDATE kups_members SET disabled=0,role='treasurer' WHERE email='staff@yayasangambut.org'");
 assert.equal((await call(f,raw,'/groups')).data.groups[0].access,'treasurer');
 assert.equal((await call(f,raw,'/transactions','POST',tx())).status,409); // Authorized; opening balance still missing.
});
test('domain read access requires exact domain and staff scope',()=>{
 for(const email of ['staff@yayasangambut.org.evil.com','staff@evilyayasangambut.org','staff@gmail.com','staff@@yayasangambut.org'])assert.throws(()=>assertGroupAccess({email,scope:'webgis-staff',role:'staff'},null));
 assert.throws(()=>assertGroupAccess({email:'staff@yayasangambut.org',scope:'kups-finance',role:'kups'},null));
});
test('Alfred migration allows Dayun read only, preserves grants, and cannot reach other groups or website APIs',async()=>{
 const f=fixture();f.db.exec(accessMigration());f.db.exec(accessMigration());
 f.db.exec("INSERT INTO users VALUES('alfred','alfrednobel951@gmail.com','Alfred','staff',0); INSERT INTO kups_groups(id,name,created_at) VALUES('other','Other','2026-10-14')");
 const raw=await auth(f,'alfred');const groups=await call(f,raw,'/groups');assert.equal(groups.data.groups.length,1);assert.equal(groups.data.groups[0].id,g);assert.equal(groups.data.groups[0].access,'viewer');
 assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,200);assert.equal((await call(f,raw,'/transactions','POST',tx())).status,403);
 const url=new URL('https://staff.yayasangambut.org/api/kups/ledger?group=other&month=2026-08');assert.equal((await finance(new Request(url,{headers:{Origin:'https://webgisyg.id',Authorization:'Bearer '+raw}}),f.env,url)).status,403);
 f.db.exec("UPDATE kups_members SET role='treasurer',disabled=1 WHERE email='alfrednobel951@gmail.com'");f.db.exec(accessMigration());assert.equal(f.db.prepare("SELECT role,disabled FROM kups_members WHERE email='alfrednobel951@gmail.com'").get().role,'treasurer');assert.equal((await call(f,raw,'/ledger?month=2026-08')).status,403);
});

test('daily income and expenses require only date, category, nominal and description',async()=>{
 const f=fixture(),raw=await auth(f);await call(f,raw,'/setup','POST',{start_date:'2026-08-01',opening_amount:100000,version:1});
 for(const [kind,category] of [['income','Penjualan nanas'],['expense','Upah'],['expense','Pupuk & Ethrel']]){
  const b={date:'2026-08-10',kind,category,description:'Transaksi harian',total_amount:10000,amount:10000,payment_date:'2026-08-10',account:'cash'};
  assert.equal((await call(f,raw,'/documents','POST',b)).status,201);
  assert.equal((await call(f,raw,'/documents','POST',{...b,description:''})).status,400);
  assert.equal((await call(f,raw,'/documents','POST',{...b,total_amount:0})).status,400);
  assert.equal((await call(f,raw,'/documents','POST',{...b,quantity:2})).status,400);
 }
 const ledger=(await call(f,raw,'/ledger?month=2026-08')).data;assert.equal(ledger.summary.income,10000);assert.equal(ledger.summary.expense,20000);assert.equal(ledger.summary.closing,90000);
});
