import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
// The advance workflow does not call HTML sanitization. Isolate that unrelated
// dependency so these API tests can also run in a dependency-free checkout.
const hook=registerHooks({resolve(specifier,context,next){if(specifier==='sanitize-html')return {url:'data:text/javascript,export default function(){throw Error("Sanitizer must not be used in advance API tests");}',shortCircuit:true};return next(specifier,context);}});
const {advancesRoute,advanceInput,advanceAccess}=await import('../src/advances.mjs');
hook.deregister();
const origin='https://staff.yayasangambut.org',prefix='/finance/advances/api';
const users={director:{id:'mul',name:'Mulyadi',email:'mulyadi@yayasangambut.org',role:'admin'},finance:{id:'riena',name:'Riena',email:'rienaprasiddha@yayasangambut.org',role:'staff'},staff:{id:'ariel',name:'Zamharir',email:'zamharier@yayasangambut.org',role:'editor'},other:{id:'other',name:'Other',email:'other@yayasangambut.org',role:'admin'}};
const sample={project:'Proyek uji',activity:'Kegiatan uji',location:'Riau',start:'2026-11-01',end:'2026-11-02',items:[{description:'Perjalanan',quantity:2,days:2,unit:'orang',rate:250000}],notes:''};
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);');for(const u of Object.values(users))db.prepare('INSERT INTO users VALUES(?)').run(u.id);db.exec(readFileSync(new URL('../migrations/0044_advance_requests.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0046_pjum_evidence.sql',import.meta.url),'utf8'));db.exec('CREATE TABLE finance_transactions(id TEXT,amount INTEGER);INSERT INTO finance_transactions VALUES(\'old\',123);');const objects=new Map();const env={APP_ORIGIN:origin,DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},MEDIA:{async put(k,b){objects.set(k,b);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}}};return {env,db,objects};}
async function call(env,user,path='',method='GET',data){return advancesRoute(new Request(origin+prefix+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env,users[user]);}
const body=async r=>r.json();
async function reject(fn,status){await assert.rejects(fn,e=>e.status===status);}
async function upload(env,user,row,purpose,pages=1){const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();for(let i=0;i<pages;i++)pdf.addPage();const proof=await pdf.save();const r=await advancesRoute(new Request(origin+prefix+'/'+row.id+'/files?'+new URLSearchParams({purpose,name:'bukti.pdf',version:row.version}),{method:'POST',headers:{Origin:origin},body:proof}),env,users[user]);return r.json();}
test('only the three named active accounts can submit; volume arithmetic is server-owned',()=>{for(const who of ['director','finance','staff'])assert.equal(advanceAccess(users[who]),true);assert.equal(advanceAccess(users.other),false);assert.equal(advanceAccess({...users.staff,disabled:1}),false);assert.equal(advanceInput({...sample,total:1}).total,1000000);assert.throws(()=>advanceInput({...sample,items:[{...sample.items[0],quantity:-1}]}));assert.throws(()=>advanceInput({...sample,end:'2026-10-01'}));});
test('end-to-end UM, PJUM and refund with finance review, immutable evidence and audit',async()=>{
 const {env,db,objects}=setup();let row=await body(await call(env,'staff','','POST',sample));assert.equal(row.total,1000000);assert.match(row.number,/^UM-20\d{2}-\d{5}$/);const id=row.id;
 assert.equal((await body(await call(env,'director'))).length,1);assert.equal((await body(await call(env,'finance'))).length,1);
 await reject(()=>call(env,'other','/'+id),403);await reject(()=>call(env,'staff','/'+id+'/approve','POST',{version:row.version}),403);
 row=await body(await call(env,'staff','/'+id+'/submit','POST',{version:row.version}));
 await reject(()=>call(env,'director','/'+id+'/approve','POST',{version:row.version}),409);
 row=await body(await call(env,'finance','/'+id+'/check','POST',{version:row.version}));row=await body(await call(env,'director','/'+id+'/approve','POST',{version:row.version}));
 await reject(()=>call(env,'finance','/'+id+'/disburse','POST',{version:row.version,date:'2026-11-01',reference:'BANK-1'}),400);
 row=await upload(env,'finance',row,'payment');row=await body(await call(env,'finance','/'+id+'/disburse','POST',{version:row.version,date:'2026-11-01',reference:'BANK-1'}));
 assert.equal(row.status,'disbursed');const before=row.version;
 row=await body(await call(env,'staff','/'+id+'/report','POST',{version:row.version,items:[{...sample.items[0],rate:200000,date:'2026-11-01',receipt_no:'1',recipient:'Penerima uji'}]}));assert.equal(row.actual,800000);
 await reject(()=>call(env,'staff','/'+id+'/report','POST',{version:before,items:[]}),409);
 await reject(()=>call(env,'staff','/'+id+'/report_submit','POST',{version:row.version}),400);
 row=await upload(env,'staff',row,'pjum');const duplicate=await advancesRoute(new Request(origin+prefix+'/'+row.id+'/files?'+new URLSearchParams({purpose:'pjum',name:'bukti.pdf',version:row.version}),{method:'POST',headers:{Origin:origin},body:[...objects.values()].at(-1)}),env,users.staff);const same=await duplicate.json();assert.equal(same.version,row.version);assert.equal(same.files.length,row.files.length);row=await body(await call(env,'staff','/'+id+'/report','POST',{version:row.version,items:row.report.items.map(i=>({...i,file_id:row.files.find(f=>f.purpose==='pjum').id,page:1})),notes:'Kuitansi diperiksa manual oleh Finance.'}));row=await body(await call(env,'staff','/'+id+'/report_submit','POST',{version:row.version}));
 row=await body(await call(env,'finance','/'+id+'/report_check','POST',{version:row.version,evidence_reviewed:true,note:'Bukti dan tanda tangan telah diperiksa.'}));row=await body(await call(env,'director','/'+id+'/report_approve','POST',{version:row.version}));assert.equal(row.status,'settlement');
 row=await upload(env,'finance',row,'settlement');await reject(()=>call(env,'finance','/'+id+'/settle','POST',{version:row.version,date:'2026-11-02',reference:'RETURN-1',amount:1}),400);
 row=await body(await call(env,'finance','/'+id+'/settle','POST',{version:row.version,date:'2026-11-02',reference:'RETURN-1',amount:200000}));assert.equal(row.status,'closed');assert.equal(row.files.length,3);assert.equal(row.events.length,row.version);assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123);
 await reject(()=>upload(env,'staff',row,'pjum'),403);
});
test('director and finance can create their own UM; author identity cannot be spoofed and staff cannot see others',async()=>{
 const {env}=setup();for(const who of ['director','finance']){let row=await body(await call(env,who,'','POST',{...sample,creator:users.staff.id}));assert.equal(row.creator,users[who].id);assert.equal((await body(await call(env,'staff'))).length,0);await reject(()=>call(env,'staff','/'+row.id),403);row=await body(await call(env,who,'/'+row.id+'/submit','POST',{version:row.version}));await reject(()=>call(env,'director','/'+row.id+'/approve','POST',{version:row.version}),409);}
 const row=await body(await call(env,'staff','','POST',sample));await reject(()=>advancesRoute(new Request(origin+prefix+'/'+row.id+'/submit',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify({version:row.version})}),env,users.staff),403);
});

test('legacy link is unique, keeps the original amount and never creates bank transactions or a new budget allocation',async()=>{
 const {env,db}=setup();db.exec('ALTER TABLE users ADD COLUMN email TEXT;ALTER TABLE users ADD COLUMN name TEXT;ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0;');for(const u of Object.values(users))db.prepare('UPDATE users SET email=?,name=? WHERE id=?').run(u.email,u.name,u.id);
 env.FINANCE={async fetch(){return Response.json({requests:[{id:'archive-10',type:'UM',code:'10/YG_ARC3/10/2026',documentNumber:'10/YG_ARC3/10/2026',bankDate:'5 Okt 2026',bankStatus:'Cocok',bankAmount:55200000,status:'Dicairkan',title:'4.1 Community Based Protection Termin 2',amount:55200000,project:'ARC3',applicant:'Mulyadi'}]});}};
 await reject(()=>call(env,'staff','/legacy'),403);
 await reject(()=>call(env,'director','/legacy','POST',{id:'archive-10',owner_email:users.director.email,paid_date:'2026-10-05',reference:'OLD-BANK',owner_email:users.staff.email}),400);
 const data={id:'archive-10',owner_email:users.director.email,paid_date:'2026-10-05',reference:'OLD-BANK',confirm_existing_payment:true};
 const a=await body(await call(env,'director','/legacy','POST',data)),b=await body(await call(env,'director','/legacy','POST',data));assert.equal(a.id,b.id);assert.equal(a.total,55200000);assert.equal(a.status,'disbursed');assert.deepEqual(a.payload.allocations,[]);assert.equal(a.number,'10/YG_ARC3/10/2026');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM finance_transactions').get().n,1);
 const proof=await upload(env,'director',a,'pjum');let row=await body(await call(env,'director','/'+a.id+'/report','POST',{version:proof.version,report_date:'2099-11-16',items:[{date:'2026-11-15',description:'Honor patroli',recipient:'Penerima',receipt_no:'1',file_id:proof.files[0].id,page:1,quantity:1,times:1,days:1,unit:'orang',rate:55200000}],notes:'Bukti diperiksa manual.'}));
 await reject(()=>call(env,'director','/'+row.id+'/report_submit','POST',{version:row.version}),400);
 row=await body(await call(env,'director','/'+row.id+'/report','POST',{version:row.version,report_date:'2026-11-15',items:row.report.items,notes:'Bukti diperiksa manual.'}));
 row=await body(await call(env,'director','/'+row.id+'/report_submit','POST',{version:row.version}));await reject(()=>call(env,'finance','/'+row.id+'/report_check','POST',{version:row.version}),400);
 assert.equal(row.status,'pjum_submitted');assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123);
});

test('batch OCR persists three page results once, rejects foreign evidence and reuses successful page reads',async()=>{
 const {env,db}=setup();let row=await body(await call(env,'director','','POST',sample));db.prepare("UPDATE yg_advance_requests SET status='disbursed' WHERE id=?").run(row.id);row=await body(await call(env,'director','/'+row.id));row=await upload(env,'director',row,'pjum',3);const fid=row.files[0].id,version=row.version;
 await reject(()=>call(env,'director','/'+row.id+'/scan','POST',{version,pages:[{file_id:fid,page:1},{file_id:'other',page:2}]}),400);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM yg_advance_ocr').get().n,0);
 row=await body(await call(env,'director','/'+row.id+'/scan','POST',{version,pages:[1,2,3].map(page=>({file_id:fid,page}))}));assert.equal(row.version,version+1);assert.equal(row.ocr.length,3);assert.equal(row.status,'disbursed');assert.equal(row.actual,null);
 db.prepare("UPDATE yg_advance_ocr SET result='{}'").run();const stable=row.version;row=await body(await call(env,'director','/'+row.id+'/scan','POST',{version:stable,pages:[1,2,3].map(page=>({file_id:fid,page}))}));assert.equal(row.version,stable);
 await reject(()=>call(env,'director','/'+row.id+'/scan','POST',{version:stable,pages:[{file_id:fid,page:4}]}),400);assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123);
});
