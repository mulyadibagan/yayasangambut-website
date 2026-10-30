import {PDFDocument} from 'pdf-lib';
import {pdfHash} from '../src/payroll-pdf.mjs';
import {sendPayrollNotifications,payrollRecipients} from '../src/payroll-notifications.mjs';
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
 for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0021_payroll_requests.sql','0022_payroll_payments.sql','0023_payroll_review_notifications.sql','0024_payroll_documents_cancellation.sql','0037_payroll_staff_terms.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',PAYROLL_FINANCE_EMAIL:'rienaprasiddha@yayasangambut.org'};
 for(const [id,email,role] of [['finance',env.PAYROLL_FINANCE_EMAIL,'staff'],['director','mulyadi@yayasangambut.org','admin'],['other','other@yayasangambut.org','admin']]){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,email,id,role,'2026-10-19','2026-10-19');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(id),id,Date.now()+60000);}
 const objects=new Map();env.MEDIA={async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k),async arrayBuffer(){return new Uint8Array(objects.get(k)).buffer;}}:null;},async delete(k){objects.delete(k);}};
 db.exec("CREATE TABLE finance_transactions(id TEXT,amount INTEGER);INSERT INTO finance_transactions VALUES('historical',123456);CREATE TABLE team_agendas(id TEXT,title TEXT);INSERT INTO team_agendas VALUES('existing','Existing event');");
 return {env,db,objects};
}
const request=(suffix='',user='finance',method='GET',data)=>new Request(origin+path+suffix,{method,headers:{Cookie:'__Host-yg-session='+user,Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
async function call(env,suffix='',user='finance',method='GET',data,status=200){const r=await worker.fetch(request(suffix,user,method,data),env);assert.equal(r.status,status,await r.clone().text());return r.json();}
const create=env=>call(env,'','finance','POST',sample,201);
test('designated Finance reaches the full dashboard but cannot approve payroll',async()=>{
 const {env,db}=await setup();
 assert.equal((await worker.fetch(new Request(origin+path),env)).status,401);
 await call(env,'','other','GET',null,403);
 const created=await create(env);
 await call(env,'/'+created.id+'/approve','finance','POST',{version:1},403);
 await call(env,'','director','POST',sample,201);
 env.FINANCE={async fetch(){return Response.json({sync:{},candidates:[]});}};
 for(const p of ['/finance','/finance/api/requests','/finance/email-sync','/finance/assets/app.js'])assert.equal((await worker.fetch(new Request(origin+p,{headers:{Cookie:'__Host-yg-session=finance'}}),env)).status,200);
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
 r=await call(env,'/'+a.id+'/approve','director','POST',{version:r.version,note:'Disetujui.',review_confirmed:true,review_token:await reviewToken(env,r)});assert.equal(r.status,'approved');assert.equal(r.total,5500000);assert.equal(r.reviewer_email,'mulyadi@yayasangambut.org');
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
async function approve(env){let a=await create(env);a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});return reviewedApprove(env,a);}
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
 a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});a=await reviewedApprove(env,a);
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


test('Director can create and edit own draft; Finance can review it; other administrators remain excluded',async()=>{
 const {env}=await setup();let a=await call(env,'','director','POST',sample,201);
 assert.equal(a.creator_email,'mulyadi@yayasangambut.org');
 a=await call(env,'/'+a.id,'director','PUT',{...sample,version:a.version,notes:'Prepared by Director'});
 a=await call(env,'/'+a.id,'finance','PUT',{...sample,version:a.version,notes:'Reviewed by Finance'});
 assert.equal(a.creator_email,'mulyadi@yayasangambut.org');assert.equal(a.events.at(-1).actor_email,env.PAYROLL_FINANCE_EMAIL);
 await call(env,'/'+a.id,'other','PUT',{...sample,version:a.version},403);
 const guide=await worker.fetch(new Request(origin+'/finance/payroll/guide',{headers:{Cookie:'__Host-yg-session=finance'}}),env);
 assert.equal(guide.status,200);assert.match(await guide.text(),/Unggah bukti saja belum mencatat pembayaran/);
 assert.equal((await worker.fetch(new Request(origin+'/finance/payroll/guide',{headers:{Cookie:'__Host-yg-session=other'}}),env)).status,403);
});


test('Director may submit and approve own payroll with explicit audit flag; Finance payment permissions unchanged',async()=>{
 const {env,db}=await setup();bindSource(env);let a=await call(env,'','director','POST',sample,201);
 a=await call(env,'/'+a.id+'/submit','director','POST',{version:a.version});assert.equal(a.status,'submitted');assert.equal(a.events.at(-1).snapshot.submitted_by,'mulyadi@yayasangambut.org');
 a=await reviewedApprove(env,a);assert.equal(a.status,'approved');assert.equal(a.events.at(-1).snapshot.self_approved,true);assert.equal(a.events.at(-1).actor_email,'mulyadi@yayasangambut.org');
 await call(env,'/'+a.id+'/payments','director','POST',payment(a),403);
 a=await proof(env,a);a=await call(env,'/'+a.id+'/payments','finance','POST',payment(a,5400000),201);assert.equal(a.payment_status,'paid');
 assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);
});

async function reviewToken(env,a,openPrint=true){
 const page=await worker.fetch(new Request(origin+'/finance/payroll/review/'+a.id,{headers:{Cookie:'__Host-yg-session=director'}}),env);
 assert.equal(page.status,200);const html=await page.text();assert.match(html,/Formulir Permintaan Dana/);assert.match(html,/Rincian pemeriksaan/);
 const token=html.match(/data-token="([^"]+)"/)[1];
 if(openPrint){const printed=await worker.fetch(new Request(origin+'/finance/payroll/print/'+a.id+'?review='+token,{headers:{Cookie:'__Host-yg-session=director'}}),env);assert.equal(printed.status,200);}
 return token;
}
async function reviewedApprove(env,a){return call(env,'/'+a.id+'/approve','director','POST',{version:a.version,review_confirmed:true,review_token:await reviewToken(env,a)});}
test('approval requires Director review and printed version; return and resubmit invalidate evidence',async()=>{
 const {env,db}=await setup();let a=await create(env);a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version},409);
 const token=await reviewToken(env,a,false);
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version,review_confirmed:true,review_token:token},409);
 a=await call(env,'/'+a.id+'/return','director','POST',{version:a.version,note:'Revise'});
 a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version,review_confirmed:true,review_token:token},409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_notifications').get().n,0);
 a=await reviewedApprove(env,a);
 assert.equal(a.notification.status,'pending');assert.ok(a.events.at(-1).snapshot.review_evidence.print_opened_at);
 const payload=JSON.parse(db.prepare('SELECT payload FROM yg_payroll_notifications').get().payload);
 assert.deepEqual(payload.recipients,['hisamsetiawan@yayasangambut.org','serena@gec.org.my','rienaprasiddha@yayasangambut.org']);
 assert.equal(payload.total,5400000);assert.equal(payload.account,undefined);
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version,review_confirmed:true,review_token:token},409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_notifications').get().n,1);
});

test('email queue deduplicates confirmed delivery, validates recipients, and does not modify approval or financial rows',async()=>{
 const {env,db}=await setup();const a=await approve(env);const before=db.prepare('SELECT * FROM yg_payroll_requests').get();
 db.exec("CREATE TABLE finance_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT);INSERT INTO finance_settings VALUES('webhook_url','https://script.google.com/macros/s/test/exec'),('webhook_secret','test-secret')");
 let sends=0;
 const send=async(url,options)=>{sends++;const payload=JSON.parse(options.body);assert.equal(payload.action,'sendPayrollApproval');assert.equal(payload.account,undefined);return Response.json({ok:true,sent:true,messageId:'test-gmail-id',recipients:payrollRecipients,attachmentVerified:true,attachmentSha256:payload.approvalPdfSha256});};
 await Promise.all([sendPayrollNotifications(env,a.id,send),sendPayrollNotifications(env,a.id,send)]);
 assert.equal(sends,1);assert.equal(db.prepare('SELECT status FROM yg_payroll_notifications').get().status,'sent');
 await sendPayrollNotifications(env,a.id,send);assert.equal(sends,1);
 assert.deepEqual(db.prepare('SELECT * FROM yg_payroll_requests').get(),before);
 assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);
});
test('uncertain email response stays pending and cannot falsely claim success',async()=>{
 const {env,db}=await setup();const a=await approve(env);
 db.exec("CREATE TABLE finance_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT);INSERT INTO finance_settings VALUES('webhook_url','https://script.google.com/macros/s/test/exec'),('webhook_secret','test-secret')");
 await sendPayrollNotifications(env,a.id,async()=>Response.json({ok:true,sent:true,messageId:'wrong-recipient',recipients:['other@example.org']}));
 assert.equal(db.prepare('SELECT status FROM yg_payroll_notifications').get().status,'pending');
 assert.equal(db.prepare('SELECT status FROM yg_payroll_requests').get().status,'approved');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_payments').get().n,0);
});

test('approved PDF is immutable, private and identical to the email attachment after payment',async()=>{
 const {env}=await setup();bindSource(env);let a=await approve(env);
 const getPdf=who=>worker.fetch(new Request(origin+'/finance/payroll/pdf/'+a.id,{headers:{Cookie:'__Host-yg-session='+who}}),env);
 assert.equal((await getPdf('other')).status,403);
 const before=new Uint8Array(await (await getPdf('director')).arrayBuffer());
 assert.equal(await pdfHash(before),a.document.sha256);assert.equal((await PDFDocument.load(before)).getPageCount(),1);
 a=await proof(env,a);await call(env,'/'+a.id+'/payments','finance','POST',payment(a),201);
 assert.deepEqual(new Uint8Array(await (await getPdf('finance')).arrayBuffer()),before);
});
test('Finance and Director can cancel unpaid test requests; month reusable, audit retained, no sends after cancellation',async()=>{
 const {env,db}=await setup();let a=await approve(env);
 await call(env,'/'+a.id+'/cancel','other','POST',{version:a.version,reason:'test'},403);
 await call(env,'/'+a.id+'/cancel','finance','POST',{version:a.version,reason:''},400);
 await call(env,'/'+a.id+'/cancel','finance','POST',{version:1,reason:'test'},409);
 a=await call(env,'/'+a.id+'/cancel','finance','POST',{version:a.version,reason:'Uji coba'});
 assert.equal(a.status,'cancelled');assert.equal(a.events.at(-1).actor_email,env.PAYROLL_FINANCE_EMAIL);assert.equal(a.notification.status,'cancelled');
 await sendPayrollNotifications(env,a.id,async()=>{throw Error('Must not send');});
 for(const action of ['submit','approve','payments','notify'])await call(env,'/'+a.id+'/'+action,'director','POST',{version:a.version},409);
 const revoked=await worker.fetch(new Request(origin+'/finance/payroll/pdf/'+a.id,{headers:{Cookie:'__Host-yg-session=director'}}),env);assert.equal(revoked.status,409);
 let replacement=await create(env);replacement=await call(env,'/'+replacement.id+'/submit','finance','POST',{version:replacement.version});
 replacement=await call(env,'/'+replacement.id+'/cancel','director','POST',{version:replacement.version,reason:'Uji coba Direktur'});assert.equal(replacement.status,'cancelled');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_requests').get().n,2);
 assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);
});
test('cancellation cannot erase a payment or race an active email delivery',async()=>{
 const {env,db}=await setup();bindSource(env);let a=await approve(env);
 db.prepare('UPDATE yg_payroll_notifications SET lease_until=?').run(new Date(Date.now()+90000).toISOString());
 await call(env,'/'+a.id+'/cancel','director','POST',{version:a.version,reason:'test'},409);
 db.prepare('UPDATE yg_payroll_notifications SET lease_until=NULL').run();
 a=await proof(env,a);a=await call(env,'/'+a.id+'/payments','finance','POST',payment(a),201);
 await call(env,'/'+a.id+'/cancel','director','POST',{version:a.version,reason:'test'},409);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_payments').get().n,1);
});
test('PDF storage failure leaves request submitted and does not enqueue notification',async()=>{
 const {env,db}=await setup();let a=await create(env);a=await call(env,'/'+a.id+'/submit','finance','POST',{version:a.version});
 const token=await reviewToken(env,a);env.MEDIA.put=async()=>{throw Error('storage unavailable');};
 await call(env,'/'+a.id+'/approve','director','POST',{version:a.version,review_confirmed:true,review_token:token},503);
 assert.equal(db.prepare('SELECT status FROM yg_payroll_requests').get().status,'submitted');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_payroll_notifications').get().n,0);
});

test('Director records future recurring salary terms privately without changing cash or historical payroll',async()=>{
 const {env,db}=await setup();bindSource(env);
 const term={name:'Staf tambahan uji',monthlySalary:4700000,effectiveMonth:'2026-11',fundingSource:'Program contoh',notes:'Pendanaan belum cair.'};
 await call(env,'/staff-terms','other','GET',null,403);
 await call(env,'/staff-terms','finance','POST',term,403);
 await call(env,'/staff-terms','director','POST',term,201);
 await call(env,'/staff-terms','director','POST',term,409);
 const list=await call(env,'/staff-terms','finance');assert.equal(list.rows.length,1);assert.equal(list.director,false);
 const oct=await call(env,'/defaults?period=2026-10','finance');assert(!oct.items.some(i=>i.name===term.name));
 const nov=await call(env,'/defaults?period=2026-11','finance'),item=nov.items.find(i=>i.name===term.name);assert.equal(item.base,term.monthlySalary);assert.equal(item.program,term.fundingSource);assert.equal(item.allocation_snapshot.position,0);
 const dec=await call(env,'/defaults?period=2026-12','finance');assert.equal(dec.items.find(i=>i.name===term.name).base,term.monthlySalary);
 const report=await call(env,'/report','director');assert.equal(report.bankBalance,20000000);assert.equal(report.generalSaving,11000000);assert.equal(report.staff.find(s=>s.name===term.name).allocation,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM yg_payroll_requests').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM yg_payroll_payments').get().n,0);
 assert.throws(()=>db.prepare('DELETE FROM yg_payroll_staff_terms').run());
 await call(env,'/staff-terms','director','POST',{...term,name:'Invalid',monthlySalary:-1},400);
});
