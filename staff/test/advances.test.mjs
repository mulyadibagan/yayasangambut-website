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
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY);');for(const u of Object.values(users))db.prepare('INSERT INTO users VALUES(?)').run(u.id);db.exec(readFileSync(new URL('../migrations/0044_advance_requests.sql',import.meta.url),'utf8'));db.exec('CREATE TABLE finance_transactions(id TEXT,amount INTEGER);INSERT INTO finance_transactions VALUES(\'old\',123);');const objects=new Map();const env={APP_ORIGIN:origin,DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},MEDIA:{async put(k,b){objects.set(k,b);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}}};return {env,db,objects};}
async function call(env,user,path='',method='GET',data){return advancesRoute(new Request(origin+prefix+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env,users[user]);}
const body=async r=>r.json();
async function reject(fn,status){await assert.rejects(fn,e=>e.status===status);}
async function upload(env,user,row,purpose){const r=await advancesRoute(new Request(origin+prefix+'/'+row.id+'/files?'+new URLSearchParams({purpose,name:'bukti.pdf',version:row.version}),{method:'POST',headers:{Origin:origin},body:'%PDF-1.7\nexample'}),env,users[user]);return r.json();}
test('only the three named active accounts can submit; volume arithmetic is server-owned',()=>{for(const who of ['director','finance','staff'])assert.equal(advanceAccess(users[who]),true);assert.equal(advanceAccess(users.other),false);assert.equal(advanceAccess({...users.staff,disabled:1}),false);assert.equal(advanceInput({...sample,total:1}).total,1000000);assert.throws(()=>advanceInput({...sample,items:[{...sample.items[0],quantity:-1}]}));assert.throws(()=>advanceInput({...sample,end:'2026-10-01'}));});
test('end-to-end UM, PJUM and refund with finance review, immutable evidence and audit',async()=>{
 const {env,db}=setup();let row=await body(await call(env,'staff','','POST',sample));assert.equal(row.total,1000000);assert.match(row.number,/^UM-20\d{2}-\d{5}$/);const id=row.id;
 assert.equal((await body(await call(env,'director'))).length,1);assert.equal((await body(await call(env,'finance'))).length,1);
 await reject(()=>call(env,'other','/'+id),403);await reject(()=>call(env,'staff','/'+id+'/approve','POST',{version:row.version}),403);
 row=await body(await call(env,'staff','/'+id+'/submit','POST',{version:row.version}));
 await reject(()=>call(env,'director','/'+id+'/approve','POST',{version:row.version}),409);
 row=await body(await call(env,'finance','/'+id+'/check','POST',{version:row.version}));row=await body(await call(env,'director','/'+id+'/approve','POST',{version:row.version}));
 await reject(()=>call(env,'finance','/'+id+'/disburse','POST',{version:row.version,date:'2026-11-01',reference:'BANK-1'}),400);
 row=await upload(env,'finance',row,'payment');row=await body(await call(env,'finance','/'+id+'/disburse','POST',{version:row.version,date:'2026-11-01',reference:'BANK-1'}));
 assert.equal(row.status,'disbursed');const before=row.version;
 row=await body(await call(env,'staff','/'+id+'/report','POST',{version:row.version,items:[{...sample.items[0],rate:200000,date:'2026-11-01'}]}));assert.equal(row.actual,800000);
 await reject(()=>call(env,'staff','/'+id+'/report','POST',{version:before,items:[]}),409);
 await reject(()=>call(env,'staff','/'+id+'/report_submit','POST',{version:row.version}),400);
 row=await upload(env,'staff',row,'pjum');row=await body(await call(env,'staff','/'+id+'/report_submit','POST',{version:row.version}));
 row=await body(await call(env,'finance','/'+id+'/report_check','POST',{version:row.version}));row=await body(await call(env,'director','/'+id+'/report_approve','POST',{version:row.version}));assert.equal(row.status,'settlement');
 row=await upload(env,'finance',row,'settlement');await reject(()=>call(env,'finance','/'+id+'/settle','POST',{version:row.version,date:'2026-11-02',reference:'RETURN-1',amount:1}),400);
 row=await body(await call(env,'finance','/'+id+'/settle','POST',{version:row.version,date:'2026-11-02',reference:'RETURN-1',amount:200000}));assert.equal(row.status,'closed');assert.equal(row.files.length,3);assert.equal(row.events.length,row.version);assert.equal(db.prepare('SELECT amount FROM finance_transactions').get().amount,123);
 await reject(()=>upload(env,'staff',row,'pjum'),403);
});
test('director and finance can create their own UM; author identity cannot be spoofed and staff cannot see others',async()=>{
 const {env}=setup();for(const who of ['director','finance']){let row=await body(await call(env,who,'','POST',{...sample,creator:users.staff.id}));assert.equal(row.creator,users[who].id);assert.equal((await body(await call(env,'staff'))).length,0);await reject(()=>call(env,'staff','/'+row.id),403);row=await body(await call(env,who,'/'+row.id+'/submit','POST',{version:row.version}));await reject(()=>call(env,'director','/'+row.id+'/approve','POST',{version:row.version}),409);}
 const row=await body(await call(env,'staff','','POST',sample));await reject(()=>advancesRoute(new Request(origin+prefix+'/'+row.id+'/submit',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify({version:row.version})}),env,users.staff),403);
});
