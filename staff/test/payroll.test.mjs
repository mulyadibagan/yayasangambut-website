import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {payrollInput} from '../src/payroll.mjs';
const origin='https://staff.yayasangambut.org',path='/finance/payroll/api';
const sample={period:'2026-10',notes:'Contoh pengujian, bukan gaji nyata.',items:[{name:'Penerima uji',program:'Program uji',bank:'Bank uji',account:'001234',base:5000000,allowance:500000,deduction:100000}]};
async function setup(){
 const db=new DatabaseSync(':memory:');
 for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0021_payroll_requests.sql','0022_payroll_payments.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',PAYROLL_FINANCE_EMAIL:'rienaprasiddha@yayasangambut.org'};
 for(const [id,email,role] of [['finance',env.PAYROLL_FINANCE_EMAIL,'staff'],['director','mulyadi@yayasangambut.org','admin'],['other','other@yayasangambut.org','admin']]){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,email,id,role,'2026-10-19','2026-10-19');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(id),id,Date.now()+60000);}
 const objects=new Map();env.MEDIA={async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}};
 db.exec("CREATE TABLE finance_transactions(id TEXT,amount INTEGER);INSERT INTO finance_transactions VALUES('historical',123456);CREATE TABLE team_agendas(id TEXT,title TEXT);INSERT INTO team_agendas VALUES('existing','Existing event');");
 return {env,db,objects};
}
const request=(suffix='',user='finance',method='GET',data)=>new Request(origin+path+suffix,{method,headers:{Cookie:'__Host-yg-session='+user,Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
async function call(env,suffix='',user='finance',method='GET',data,status=200){const r=await worker.fetch(request(suffix,user,method,data),env);assert.equal(r.status,status,await r.clone().text());return r.json();}
const create=env=>call(env,'','finance','POST',sample,201);
test('only designated Finance and director access payroll; Finance cannot reach private legacy APIs or approve',async()=>{
 const {env,db}=await setup();
 assert.equal((await worker.fetch(new Request(origin+path),env)).status,401);
 await call(env,'','other','GET',null,403);
 const created=await create(env);
 await call(env,'/'+created.id+'/approve','finance','POST',{version:1},403);
 await call(env,'','director','POST',sample,403);
 for(const p of ['/finance/api/requests','/finance/email-sync','/finance/assets/app.js'])assert.equal((await worker.fetch(new Request(origin+p,{headers:{Cookie:'__Host-yg-session=finance'}}),env)).status,403);
 const root=await worker.fetch(new Request(origin+'/finance',{headers:{Cookie:'__Host-yg-session=finance'}}),env);assert.equal(root.status,302);assert.equal(root.headers.get('location'),origin+'/finance/payroll');
 const evil=request('','finance','POST',sample);evil.headers.set('Origin','https://evil.example');assert.equal((await worker.fetch(evil,env)).status,403);
 db.prepare('UPDATE users SET disabled=1 WHERE id=?').run('finance');await call(env,'','finance','GET',null,401);
});
test('submit, return, revise and approve preserve audit snapshots and existing financial and agenda rows',async()=>{
 const {env,db}=await setup();const a=await create(env);assert.equal(a.total,5400000);assert.equal(a.items[0].account,'001234');
 let r=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});assert.equal(r.status,'submitted');
 await call(env,'/'+a.id,'finance','PUT',{...sample,version:r.version},409);
 await call(env,'/'+a.id+'/return','director','POST',{version:r.version,note:''},400);
 r=await call(env,'/'+a.id+'/return','director','POST',{version:r.version,note:'Perbaiki komponen tunjangan.'});assert.equal(r.status,'returned');
 r=await call(env,'/'+a.id,'finance','PUT',{...sample,version:r.version,items:[{...sample.items[0],allowance:600000}]});
 r=await call(env,'/'+a.id+'/submit','finance','POST',{version:r.version});
 r=await call(env,'/'+a.id+'/approve','director','POST',{version:r.version,note:'Disetujui.'});assert.equal(r.status,'approved');assert.equal(r.total,5500000);assert.equal(r.reviewer_email,'mulyadi@yayasangambut.org');
 assert.deepEqual(r.events.map(e=>e.action),['created','submitted','returned','updated','submitted','approved']);assert.equal(r.events[1].snapshot.total,5400000);assert.equal(r.events.at(-1).snapshot.total,5500000);
 await call(env,'/'+a.id,'finance','PUT',{...sample,version:r.version},409);
 await call(env,'/'+a.id+'/approve','director','POST',{version:r.version},409);
 assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);assert.equal(db.prepare('SELECT title FROM team_agendas').get().title,'Existing event');
});
test('stale edits and duplicate monthly submissions cannot replace records or generate audit events',async()=>{
 const {env}=await setup();let a=await create(env),b=await create(env);
 a=await call(env,'/'+a.id,'finance','PUT',{...sample,version:1,notes:'Updated'});
 await call(env,'/'+a.id,'finance','PUT',{...sample,version:1,notes:'Stale'},409);
 a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});
 await call(env,'/'+b.id+'/submit','finance','POST',{version:b.version},409);
 b=await call(env,'/'+b.id);assert.equal(b.status,'draft');assert.equal(b.events.length,1);
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version-1},409);
 const latest=await call(env,'/'+a.id);assert.equal(latest.status,'submitted');assert.equal(latest.events.length,3);
});
test('private attachments bump version, require Finance and freeze after submission',async()=>{
 const {env,objects}=await setup();let a=await create(env);
 const upload=(who,v,bytes='%PDF-1.7\nfixture')=>new Request(origin+path+'/'+a.id+'/files',{method:'POST',headers:{Cookie:'__Host-yg-session='+who,Origin:origin,'X-Filename':encodeURIComponent('Daftar gaji.pdf'),'X-Payroll-Version':String(v)},body:bytes});
 assert.equal((await worker.fetch(upload('director',1),env)).status,403);
 assert.equal((await worker.fetch(upload('finance',1,'<html>bad</html>'),env)).status,400);
 let r=await worker.fetch(upload('finance',1),env);assert.equal(r.status,201,await r.clone().text());a=await r.json();assert.equal(a.version,2);assert.equal(a.files.length,1);assert.equal(objects.size,1);
 const file='/'+a.id+'/files/'+a.files[0].id;
 await call(env,file,'other','GET',null,403);
 r=await worker.fetch(request(file,'director'),env);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/%PDF/);
 await call(env,'/'+a.id+'/submit','finance','POST',{version:1},409);
 a=await call(env,'/'+a.id+'/submit','finance','POST',{version:2});assert.equal(a.events.at(-1).snapshot.files.length,1);
 assert.equal((await worker.fetch(upload('finance',3),env)).status,409);
});
test('server computes totals, validates rupiah integers and rejects duplicates and invalid periods',()=>{
 assert.equal(payrollInput({...sample,total:1}).total,5400000);
 for(const body of [{...sample,period:'2026-13'},{...sample,items:[]},{...sample,items:[sample.items[0],sample.items[0]]},...[-1,1.5,Infinity,'5000',10000000001].map(base=>({...sample,items:[{...sample.items[0],base}]})),{...sample,items:[{...sample.items[0],deduction:9000000}]}])assert.throws(()=>payrollInput(body));
});

const sourceFixture=()=>({asOf:'2026-10-01',mode:'snapshot',policy:{'Penerima uji':{active:true,monthlySalary:5400000},'Tidak aktif':{active:false,monthlySalary:100}},profiles:{profiles:{'Penerima uji':{bank:'Bank contoh',account:'009900',account_name:'Penerima uji',description:'Gaji penerima uji'}},applicant:'Pengaju contoh',title:'Bendahara'},rows:[{staff:'Penerima uji',year:2026,expenseDate:'2026-09-01',carryForward:0,claimAmount:9000000,paidAmount:0,usageAmount:0,savingId:'allocation-test',project:'Program uji'}],entries:[],bank:{account:'BANK-SOURCE-TEST',closing:20000000},generalSaving:11000000});
function bindSource(env,source=sourceFixture()){env.FINANCE={async fetch(req){assert.equal(new URL(req.url).pathname,'/finance/api/payroll-source');return Response.json(source);}};return source;}
async function approve(env){let a=await create(env);a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});return call(env,'/'+a.id+'/approve','director','POST',{version:a.version});}
async function proof(env,a){const r=await worker.fetch(new Request(origin+path+'/'+a.id+'/files',{method:'POST',headers:{Cookie:'__Host-yg-session=finance',Origin:origin,'X-Filename':'Transfer.pdf','X-Payroll-Version':String(a.version),'X-File-Purpose':'payment'},body:'%PDF-1.7\nsynthetic transfer proof'}),env);assert.equal(r.status,201,await r.clone().text());return r.json();}
const payment=(a,amount=2000000)=>({id:crypto.randomUUID(),version:a.version,paid_date:'2026-10-02',source_account:'BANK-SOURCE-TEST',reference:'TEST-TRANSFER-001',notes:'Test only',allocations:[{staff_id:'staff:penerima-uji',amount}],proof_ids:a.files.filter(f=>f.purpose==='payment').map(f=>f.id)});

test('auto-fill uses effective monthly policy and private profile, keeps allocation snapshot and prints reference layout',async()=>{
 const {env}=await setup();bindSource(env);
 const defaults=await call(env,'/defaults?period=2026-10','director');assert.equal(defaults.items.length,1);assert.equal(defaults.items[0].base,5400000);assert.equal(defaults.items[0].account,'009900');assert.equal(defaults.items[0].allocation_snapshot.position,9000000);assert.equal(defaults.form_meta.applicant,'Pengaju contoh');
 const data={...sample,items:defaults.items,form_meta:defaults.form_meta};let a=await call(env,'','finance','POST',data,201);assert.equal(a.items[0].allocation_snapshot.source_ids[0],'allocation-test');assert.ok(a.form_meta.number);
 await call(env,'/'+a.id,'finance','PUT',{...data,version:a.version,items:[{...data.items[0],base:1}]},400);
 const printed=await worker.fetch(new Request(origin+'/finance/payroll/print/'+a.id,{headers:{Cookie:'__Host-yg-session=director'}}),env);assert.equal(printed.status,200);const html=await printed.text();assert.match(html,/Formulir Permintaan Dana/);assert.match(html,/Kode Anggaran/);assert.match(html,/Menunggu persetujuan/);assert.match(html,/Lima juta empat ratus ribu/);assert.equal(printed.headers.get('cache-control'),'no-store');
 for(const suffix of ['/defaults?period=2026-10','/report','/bank'])await call(env,suffix,'other','GET',null,403);
});

test('payments require approval, Finance, private proof, positive approved allocations; partial and full payments stay audited',async()=>{
 const {env,db}=await setup();bindSource(env);let a=await create(env);
 await call(env,'/'+a.id+'/payments','finance','POST',payment(a),409);
 a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});a=await call(env,'/'+a.id+'/approve','director','POST',{version:a.version});
 await call(env,'/'+a.id+'/payments','director','POST',payment(a),403);
 await call(env,'/'+a.id+'/payments','finance','POST',payment(a),400);
 a=await proof(env,a);let p=payment(a);
 await call(env,'/'+a.id+'/payments','finance','POST',{...p,allocations:[{staff_id:'staff:penerima-uji',amount:5400001}]},400);
 await call(env,'/'+a.id+'/payments','finance','POST',{...p,proof_ids:['foreign-file']},400);
 a=await call(env,'/'+a.id+'/payments','finance','POST',p,201);assert.equal(a.paid,2000000);assert.equal(a.remaining,3400000);assert.equal(a.payment_status,'partial');
 let retry=await call(env,'/'+a.id+'/payments','finance','POST',p);assert.equal(retry.payments.length,1);
 await call(env,'/'+a.id+'/payments','finance','POST',{...p,reference:'CHANGED'},409);
 await call(env,'/'+a.id+'/payments','finance','POST',{...payment(a),reference:p.reference},409);
 await call(env,'/'+a.id+'/payments','finance','POST',{...payment(a),version:a.version-1,reference:'SECOND'},409);
 a=await call(env,'/'+a.id+'/payments','finance','POST',{...payment(a,3400000),reference:'SECOND'},201);assert.equal(a.remaining,0);assert.equal(a.payment_status,'paid');assert.equal(a.events.filter(e=>e.action==='paid').length,2);
 await call(env,'/'+a.id+'/payments','finance','POST',{...payment(a,1),reference:'THIRD'},400);
 const report=await call(env,'/report','director');assert.equal(report.totalPaid,5400000);assert.equal(report.bookBalance,14600000);assert.equal(report.staff[0].position,3600000);
 assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);assert.equal(db.prepare('SELECT title FROM team_agendas').get().title,'Existing event');
});

test('one canonical bank entry cannot fund multiple payroll payments and matching payment is not deducted twice',async()=>{
 const {env}=await setup(),source=bindSource(env);source.entries=[{index:1,date:'2026-10-01',reference:'BANK-REF',debit:2000000,credit:0}];source.rows.push({staff:'Penerima uji',year:2026,expenseDate:'2026-10-01',paidAmount:2000000});
 let a=await proof(env,await approve(env));let p={...payment(a),paid_date:'2026-10-01',reference:'BANK-REF',bank_entry_id:'bank:2026:1'};
 a=await call(env,'/'+a.id+'/payments','finance','POST',p,201);
 const report=await call(env,'/report');assert.equal(report.bankMatched,2000000);assert.equal(report.bankAdditional,0);assert.equal(report.bookBalance,20000000);assert.equal(report.staff[0].position,7000000);
 await call(env,'/'+a.id+'/payments','finance','POST',{...p,id:crypto.randomUUID(),version:a.version},409);
});


test('director print preview uses defaults without creating a request or approval',async()=>{
 const {env,db}=await setup();bindSource(env);const response=await worker.fetch(new Request(origin+'/finance/payroll/print-preview?period=2026-10',{headers:{Cookie:'__Host-yg-session=director'}}),env);
 assert.equal(response.status,200);const html=await response.text();assert.match(html,/PRATINJAU · BELUM DIAJUKAN/);assert.match(html,/5.400.000/);assert.match(html,/Belum disimpan, diajukan, atau disetujui/);assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_requests').get().n,0);
});
