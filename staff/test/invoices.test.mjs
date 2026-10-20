import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {invoiceSeed,invoiceInput} from '../src/invoice-model.mjs';
const origin='https://staff.yayasangambut.org',base='/finance/invoices/api';
async function setup(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0026_finance_invoices.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org'};
 for(const [id,email,role] of [['finance','rienaprasiddha@yayasangambut.org','staff'],['director','mulyadi@yayasangambut.org','admin'],['other','other@yayasangambut.org','admin']]){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,email,id,role,'2026-10-20','2026-10-20');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(id),id,Date.now()+3600000);}
 const objects=new Map();env.MEDIA={async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k),async arrayBuffer(){return new Uint8Array(objects.get(k)).buffer;}}:null;},async delete(k){objects.delete(k);}};
 db.exec("CREATE TABLE finance_transactions(id TEXT,amount INTEGER);INSERT INTO finance_transactions VALUES('historical',123456);CREATE TABLE team_agendas(id TEXT,title TEXT);INSERT INTO team_agendas VALUES('existing','Existing event');");return {env,db,objects};
}
const request=(path=base,user='finance',method='GET',data,headers={})=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/json',...headers},...(data?{body:typeof data==='string'?data:JSON.stringify(data)}:{})});
const call=(f,path=base,user='finance',method='GET',data)=>worker.fetch(request(path,user,method,data),f.env);
const seed=extra=>({...invoiceSeed,request_id:crypto.randomUUID(),...extra});
async function create(f,extra){const res=await call(f,base,'finance','POST',seed(extra));assert.equal(res.status,201,await res.clone().text());return res.json();}
async function attach(f,r,purpose){const res=await worker.fetch(request(base+'/'+r.id+'/files','finance','POST','%PDF-1.7 fixture',{'X-Filename':'Proof.pdf','X-Purpose':purpose,'X-Version':String(r.version)}),f.env);assert.equal(res.status,200,await res.clone().text());return res.json();}
test('invoice access is private, draft defaults are exact and no old finance/agenda rows are changed',async()=>{
 const f=await setup();assert.equal((await worker.fetch(new Request(origin+base),f.env)).status,401);assert.equal((await call(f,base,'other')).status,403);
 const defaults=await(await call(f)).json();assert.equal(defaults.seed.organization_address,'Jalan Gulama No. 8, RT 01/RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru, Riau 28282');
 let r=await create(f);assert.equal(r.number,'10/YG-RAPP/26');assert.equal(r.status,'draft');assert.equal(r.amount,199200000);assert.equal(r.total,199200000);assert.equal(r.issued_at,null);assert.ok(r.issues.length>=5);assert.equal(r.data.organization_address,defaults.seed.organization_address);
 const evil=request(base,'finance','POST',seed());evil.headers.set('Origin','https://evil.example');assert.equal((await worker.fetch(evil,f.env)).status,403);
 assert.equal((await call(f,'/finance/invoices/pdf/'+r.id,'other')).status,403);const pdf=await call(f,'/finance/invoices/pdf/'+r.id);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');const d=await PDFDocument.load(await pdf.arrayBuffer());assert.equal(d.getPageCount(),1);assert.ok(Math.abs(d.getPage(0).getWidth()-595.28)<.01);
 assert.deepEqual({...f.db.prepare('SELECT * FROM finance_transactions').get()},{id:'historical',amount:123456});assert.equal(f.db.prepare('SELECT COUNT(*) n FROM team_agendas').get().n,1);
});
test('annual numbers are atomic, canonical, ordered, never reused, and retry is idempotent',async()=>{
 const f=await setup(),b=seed();let res=await call(f,base,'finance','POST',b),r=await res.json();assert.equal(res.status,201);assert.equal((await call(f,base,'finance','POST',b)).status,200);
 assert.equal((await call(f,base,'finance','POST',seed({number:'010/YG-RAPP/26'}))).status,409);assert.equal((await call(f,base,'finance','POST',seed({number:'12/YG-RAPP/26'}))).status,409);
 const pair=await Promise.all([call(f,base,'finance','POST',seed({number:'11/YG-RAPP/26'})),call(f,base,'finance','POST',seed({number:'11/YG-RAPP/26'}))]);assert.deepEqual(pair.map(x=>x.status).sort(),[201,409]);
 assert.equal((await call(f,base+'/'+r.id+'/cancel','finance','POST',{version:r.version,reason:'Uji lokal'})).status,200);assert.equal((await call(f,base,'finance','POST',seed())).status,409);assert.equal(f.db.prepare('SELECT last_no FROM yg_invoice_sequences WHERE year=2026').get().last_no,11);
 assert.equal((await call(f,base,'finance','POST',seed({date:'2027-01-01',number:'1/YG-RAPP/27'}))).status,201);
});
test('draft revisions, private documents, issuance checks and immutable final PDF preserve history',async()=>{
 const f=await setup();let r=await create(f);const path=base+'/'+r.id;
 assert.equal((await call(f,path+'/issue','director','POST',{version:1,reviewed_version:1})).status,400);
 const complete={...r.data,number:r.number,customer_address:'Alamat pelanggan uji',contract_ref:'PO-UJI',tax_status:'non_pkp',tax_mode:'no_vat',tax_note:'Status diperiksa dengan dokumen uji',organization_address:'Alamat YG uji',organization_contact:'finance@example.org',bank:'Bank uji',account:'000000',account_name:'Yayasan uji',design_reviewed:true,number_reviewed:true};
 let res=await call(f,path,'finance','PUT',{...complete,version:r.version});assert.equal(res.status,200);r=await res.json();assert.equal((await call(f,path,'finance','PUT',{...complete,version:1})).status,409);r=await attach(f,r,'contract');r=await attach(f,r,'tax');assert.deepEqual(r.issues,[]);
 assert.equal((await call(f,path+'/files/'+r.files[0].id,'other')).status,403);assert.equal((await call(f,path+'/issue','finance','POST',{version:r.version,reviewed_version:r.version})).status,403);
 assert.equal((await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:1})).status,409);
 res=await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:r.version});assert.equal(res.status,200,await res.clone().text());r=await res.json();assert.equal(r.status,'issued');assert.ok(r.pdf_hash);assert.equal(r.events.filter(x=>x.action==='issued').length,1);
 const first=await(await call(f,'/finance/invoices/pdf/'+r.id)).arrayBuffer();assert.equal((await call(f,path,'finance','PUT',{...complete,version:r.version})).status,409);assert.equal((await call(f,path+'/cancel','director','POST',{version:r.version,reason:'cancel'})).status,409);const print=await call(f,'/finance/invoices/print/'+r.id);assert.equal(print.status,302);assert.equal(print.headers.get('Location'),'/finance/invoices/pdf/'+r.id);const second=await(await call(f,'/finance/invoices/pdf/'+r.id)).arrayBuffer();assert.deepEqual(new Uint8Array(first),new Uint8Array(second));
});
test('invalid dates, mismatched values, forged numbering and cancelled PDFs fail safely',async()=>{
 const f=await setup();assert.throws(()=>invoiceInput({...invoiceSeed,date:'2026-13-01'}));assert.throws(()=>invoiceInput({...invoiceSeed,date:'2026-02-30'}));assert.throws(()=>invoiceInput({...invoiceSeed,percentage:101}));assert.throws(()=>invoiceInput({...invoiceSeed,vat:1000}));
 assert.equal((await call(f,base,'finance','POST',seed({number:'10/YG-OTHER/26'}))).status,400);let r=await create(f);assert.equal((await call(f,base+'/'+r.id,'finance','PUT',{...r.data,number:'11/YG-RAPP/26',version:r.version})).status,409);
 r=await attach(f,r,'contract');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM yg_invoice_files').get().n,1);assert.equal((await call(f,base+'/'+r.id+'/cancel','director','POST',{version:r.version,reason:'Draf uji'})).status,200);assert.equal((await call(f,'/finance/invoices/pdf/'+r.id)).status,409);
});
test('print view escapes fields, preserves A4 format, and failed PDF archive cannot issue or advance history',async()=>{
 const f=await setup();let r=await create(f,{customer:'PT <script>alert(1)</script> Contoh'});const path=base+'/'+r.id;
 const preview=await(await call(f,'/finance/invoices/print/'+r.id)).text();assert.ok(preview.includes('size:A4 portrait'));assert.ok(preview.includes('&lt;script&gt;'));assert.ok(!preview.includes('<script>alert(1)'));assert.ok(preview.includes('DRAFT - BELUM DITERBITKAN'));assert.ok(preview.includes('Unduh PDF A4'));
 r=await(await call(f,path,'finance','PUT',{...r.data,number:r.number,version:r.version,language:'en',description:'Contract instalment payment.'})).json();assert.equal(r.data.language,'en');assert.equal(r.number,'10/YG-RAPP/26');assert.equal(r.total,199200000);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM yg_invoices').get().n,1);const english=await(await call(f,'/finance/invoices/print/'+r.id)).text();assert.ok(english.includes('DRAFT - NOT ISSUED'));assert.ok(english.includes('Please make payment to:'));assert.ok(english.includes('20 October 2026'));
 const complete={...r.data,number:r.number,customer_address:'Alamat uji',contract_ref:'PO-UJI',tax_status:'non_pkp',tax_mode:'no_vat',tax_note:'Bukti uji',organization_address:'Alamat YG uji',organization_contact:'finance@example.org',bank:'Bank uji',account:'000000',account_name:'YG uji',design_reviewed:true,number_reviewed:true};
 r=await(await call(f,path,'finance','PUT',{...complete,version:r.version})).json();r=await attach(f,r,'contract');r=await attach(f,r,'tax');const before=f.db.prepare('SELECT COUNT(*) n FROM yg_invoice_events').get().n;
 f.env.MEDIA.put=async()=>{throw Error('storage unavailable');};assert.equal((await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:r.version})).status,500);assert.equal(f.db.prepare('SELECT status FROM yg_invoices').get().status,'draft');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM yg_invoice_events').get().n,before);
});
