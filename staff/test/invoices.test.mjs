import test from 'node:test';
import {createHash} from 'node:crypto';
import {sealToken} from '../src/google-calendar.mjs';
import {archiveInvoiceDrive,syncInvoiceDrive} from '../src/invoice-drive.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {pdfHash} from '../src/payroll-pdf.mjs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {invoicePdf} from '../src/invoice-pdf.mjs';
import {invoiceSeed,invoiceInput} from '../src/invoice-model.mjs';
const origin='https://staff.yayasangambut.org',base='/finance/invoices/api';
async function setup(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0026_finance_invoices.sql','0027_invoice_drive.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
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
 assert.equal((await call(f,'/finance/invoices/pdf/'+r.id+'?signature=with')).status,403);assert.equal((await call(f,'/finance/invoices/print/'+r.id+'?signature=with')).status,403);assert.equal((await call(f,'/finance/invoices/pdf/'+r.id+'?signature=without')).status,200);
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
 const complete={...r.data,number:r.number,customer_address:'Alamat pelanggan uji',contract_ref:'',tax_status:'unknown',tax_mode:'unknown',tax_note:'',organization_address:'Alamat YG uji',organization_contact:'finance@example.org',bank:'Bank uji',account:'000000',account_name:'Yayasan uji',design_reviewed:true,number_reviewed:true};
 let res=await call(f,path,'finance','PUT',{...complete,version:r.version});assert.equal(res.status,200);r=await res.json();assert.equal((await call(f,path,'finance','PUT',{...complete,version:1})).status,409);assert.ok(r.issues.some(i=>i.startsWith('Lampirkan dokumen kontrak/PO.')));r=await attach(f,r,'contract');assert.equal(r.data.contract_ref,'');assert.deepEqual(r.issues,[]);assert.equal(r.files.some(f=>f.purpose==='tax'),false);
 assert.equal((await call(f,path+'/files/'+r.files[0].id,'other')).status,403);assert.equal((await call(f,path+'/issue','finance','POST',{version:r.version,reviewed_version:r.version})).status,403);
 assert.equal((await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:1})).status,409);
 assert.equal((await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:r.version,signature_mode:'without',reviewed_signature_mode:'with'})).status,409);
 res=await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:r.version});assert.equal(res.status,200,await res.clone().text());r=await res.json();assert.equal(r.status,'issued');assert.ok(r.pdf_hash);assert.equal(r.events.filter(x=>x.action==='issued').length,1);
 const first=await(await call(f,'/finance/invoices/pdf/'+r.id)).arrayBuffer();const compact=await call(f,'/finance/invoices/pdf/'+r.id+'?layout=compact');assert.equal(compact.status,200);assert.equal((await PDFDocument.load(await compact.arrayBuffer())).getPageCount(),1);assert.equal((await call(f,path,'finance','PUT',{...complete,version:r.version})).status,409);assert.equal((await call(f,path+'/cancel','director','POST',{version:r.version,reason:'cancel'})).status,409);const print=await call(f,'/finance/invoices/print/'+r.id);assert.equal(print.status,302);assert.equal(print.headers.get('Location'),'/finance/invoices/pdf/'+r.id);const second=await(await call(f,'/finance/invoices/pdf/'+r.id)).arrayBuffer();assert.deepEqual(new Uint8Array(first),new Uint8Array(second));
});
test('Director can preview signature on a watermarked draft without approval or changing its saved version',async()=>{
 const f=await setup(),r=await create(f),png=new Uint8Array(readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url))),hash=await pdfHash(png),get=f.env.MEDIA.get;
 f.env.MEDIA.get=async k=>k==='document-private/director-signature-v1.png'?{customMetadata:{activated_by:'mulyadi@yayasangambut.org',activated_at:'2020-01-01',sha256:hash},async arrayBuffer(){return png.buffer;}}:get(k);
 const path='/finance/invoices/print/'+r.id,html=await(await call(f,path+'?signature=with','director')).text();assert.ok(html.includes('data:image/png;base64,'));assert.ok(html.includes('PRATINJAU — BELUM DISETUJUI / DITERBITKAN'));assert.ok(html.includes('Dengan TTD'));assert.ok(! (await(await call(f,path+'?signature=without','director')).text()).includes('alt="Tanda tangan Mulyadi"'));
 assert.equal((await call(f,path+'?signature=with','finance')).status,403);
 const response=await call(f,'/finance/invoices/pdf/'+r.id+'?signature=with','director');assert.equal(response.status,200);const pdf=await PDFDocument.load(await response.arrayBuffer());assert.ok(pdf.getPage(0).node.Resources().lookup(PDFName.of('XObject'),PDFDict).keys().length>0);
 const saved=f.db.prepare('SELECT status,version,issued_at FROM yg_invoices WHERE id=?').get(r.id);assert.deepEqual({...saved},{status:'draft',version:1,issued_at:null});assert.equal(f.db.prepare('SELECT COUNT(*) n FROM yg_invoice_events').get().n,1);
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


test('Word contract attachments are stored privately, count as contracts, and download with correct types',async()=>{
 const f=await setup();let r=await create(f);
 for(const [name,bytes,mime] of [
  ['Kontrak.doc',new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0,0]),'application/msword'],
  ['Kontrak.docx',new Uint8Array([0x50,0x4b,3,4,...new TextEncoder().encode('[Content_Types].xml word/document.xml')]),'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 ]){
  const headers={Origin:origin,Cookie:'__Host-yg-session=finance','X-Filename':encodeURIComponent(name),'X-Purpose':'contract','X-Version':String(r.version),'Content-Type':'application/octet-stream'};
  const res=await worker.fetch(new Request(origin+base+'/'+r.id+'/files',{method:'POST',headers,body:bytes}),f.env);assert.equal(res.status,200,await res.clone().text());r=await res.json();assert.ok(!r.issues.some(i=>i.startsWith('Lampirkan dokumen')));
  const file=r.files.find(x=>x.filename===name);assert.equal(file.mime,mime);const download=await call(f,base+'/'+r.id+'/files/'+file.id);assert.equal(download.headers.get('Content-Type'),mime);assert.ok(download.headers.get('Content-Disposition').startsWith('attachment;'));assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);assert.equal((await call(f,base+'/'+r.id+'/files/'+file.id,'other')).status,403);
 }
 const v=r.version;const res=await worker.fetch(request(base+'/'+r.id+'/files','finance','POST','<html>not Word</html>',{'X-Filename':'Fake.docx','X-Purpose':'contract','X-Version':String(v)}),f.env);assert.equal(res.status,400);assert.equal(f.db.prepare('SELECT version FROM yg_invoices WHERE id=?').get(r.id).version,v);
});


test('full RAPP invoice including customer address, bank and signature fits one A4 page in both languages',async()=>{
 const logo=readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url));
 for(const language of ['id','en'])for(const signature of [undefined,logo]){
 const r={number:'10/YG-RAPP/26',status:'issued',issued_by:'mulyadi@yayasangambut.org',issued_at:'2026-10-20T08:25:19Z',amount:199200000,total:199200000,data:{...invoiceSeed,language,customer_address:'Jl. M.H. Thamrin (d/h Jl. Teluk Betung) No. 31, Kebon Melati, Tanah Abang, Jakarta Pusat 10230.',contract_ref:'0',description:'JASA PENDAMPINGAN DAN PENGEMBANGAN KEMITRAAN AGROFORESTRI ANTARA PERUSAHAAN DAN MASYARAKAT BERBASIS KEHUTANAN MASYARAKAT UNTUK RANTAI PASOKAN YANG BERKELANJUTAN',bank:'Bank Mandiri KCP Tangerang Bintaro',bank_address:'Jl. Jend. Sudirman A1-03, Tangerang Selatan',account_name:'Yayasan Gambut',swift:'BMRIIDJA',account:'1640003188440'}};
 assert.equal((await PDFDocument.load(await invoicePdf(r,logo,signature))).getPageCount(),1);
 }
});


async function driveFixture(){
 const f=await setup();f.db.exec(readFileSync(new URL('../migrations/0020_agenda_drive.sql',import.meta.url),'utf8').split('ALTER TABLE')[0]);const root='1LM8jrwmbfRdYz1rfWJae67DaReOLiTFz',folderMime='application/vnd.google-apps.folder';
 Object.assign(f.env,{ADMIN_EMAIL:'mulyadi@yayasangambut.org',AGENDA_DRIVE_ROOT_ID:root,INVOICE_DRIVE_ROOT_ID:root});
 f.env.MEDIA={async put(k,v,o={}){if(o.onlyIf&&f.objects.has(k))return null;const record={bytes:new Uint8Array(v),customMetadata:o.customMetadata};f.objects.set(k,record);return record;},async get(k){const o=f.objects.get(k);return o?{customMetadata:o.customMetadata,body:o.bytes,async arrayBuffer(){return o.bytes.buffer;}}:null;}};
 const image=new Uint8Array(readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)));f.objects.set('document-private/director-signature-v1.png',{bytes:image,customMetadata:{activated_at:'2020-01-01',activated_by:'mulyadi@yayasangambut.org',sha256:await pdfHash(image)}});
 f.db.prepare('INSERT INTO agenda_drive_connection VALUES(1,?,?,?,?,?,?,?)').run('director',f.env.ADMIN_EMAIL,await sealToken(f.env,'agenda-drive:director','private-refresh'),root,'agenda-folder','connected','2026');
 const remote=new Map([[root,{id:root,mimeType:folderMime,capabilities:{canAddChildren:true}}],['agenda-folder',{id:'agenda-folder',parents:[root],mimeType:folderMime,capabilities:{canAddChildren:true}}]]),calls=[];let serial=0,timeoutAfterUpload=false,badHash=false,revoked=false;
 const fetch=async(url,options={})=>{const u=new URL(url),method=options.method||'GET';calls.push({url:u.href,method});
  if(u.hostname==='oauth2.googleapis.com')return revoked?Response.json({error:'invalid_grant'},{status:400}):Response.json({access_token:'access'});
  if(u.pathname.endsWith('/generateIds'))return Response.json({ids:['invoice-remote-1']});
  if(u.pathname.startsWith('/upload/')){const bytes=Buffer.from(await options.body.arrayBuffer()),sep=Buffer.from('Content-Type: application/pdf\r\n\r\n'),start=bytes.indexOf(sep)+sep.length,end=bytes.lastIndexOf(Buffer.from('\r\n--')),pdf=bytes.subarray(start,end),text=bytes.toString('utf8'),meta=JSON.parse(text.slice(text.indexOf('{'),text.indexOf('}\r\n--')+1));const object={...meta,size:pdf.length,md5Checksum:createHash('md5').update(pdf).digest('hex'),webViewLink:'https://drive.google.com/file/d/'+meta.id+'/view'};if(badHash)object.md5Checksum='incorrect';remote.set(meta.id,object);if(timeoutAfterUpload){timeoutAfterUpload=false;throw Error('simulated response loss');}return Response.json({id:meta.id});}
  if(u.pathname.endsWith('/files')&&method==='POST'){const body=JSON.parse(options.body),id='folder-'+(++serial);remote.set(id,{...body,id,capabilities:{canAddChildren:true}});return Response.json({id});}
  if(u.pathname.endsWith('/files')){const query=u.searchParams.get('q'),parent=/^'([^']+)' in parents/.exec(query)?.[1],name=/name = '([^']+)'/.exec(query)?.[1];return Response.json({files:[...remote.values()].filter(f=>f.mimeType===folderMime&&f.parents?.includes(parent)&&f.name===name).map(f=>({id:f.id}))});}
  const id=u.pathname.split('/').at(-1),file=remote.get(id);return file?Response.json(file):Response.json({error:{}},{status:404});
 };
 return {...f,root,remote,calls,fetch,setTimeout(){timeoutAfterUpload=true;},setBadHash(){badHash=true;},setRevoked(){revoked=true;}};
}
async function readyInvoice(f){let r=await create(f);r=await(await call(f,base+'/'+r.id,'finance','PUT',{...r.data,number:r.number,version:r.version,customer_address:'Test customer address',organization_contact:'finance@example.org',bank:'Test bank',account:'123',account_name:'YG',number_reviewed:true,design_reviewed:true})).json();return attach(f,r,'contract');}
test('issuing automatically archives signed PDF in chosen Drive tree, retry reuses ID, links are private and old records stay intact',async()=>{
 const f=await driveFixture(),previous=globalThis.fetch;globalThis.fetch=f.fetch;
 try{let r=await readyInvoice(f);const oldFinance=JSON.stringify(f.db.prepare('SELECT * FROM finance_transactions').all()),oldAgendas=JSON.stringify(f.db.prepare('SELECT * FROM team_agendas').all());f.setTimeout();
  const response=await call(f,base+'/'+r.id+'/issue','director','POST',{version:r.version,reviewed_version:r.version});assert.equal(response.status,200);r=await response.json();assert.equal(r.status,'issued');assert.equal(r.drive.status,'error');const original=new Uint8Array(f.objects.get(f.db.prepare('SELECT pdf_key FROM yg_invoices WHERE id=?').get(r.id).pdf_key).bytes);
  f.db.exec('UPDATE yg_invoice_drive SET retry_at=0');await syncInvoiceDrive(f.env);let status=await(await call(f,base+'/'+r.id)).json();assert.equal(status.drive.status,'archived');assert.equal(status.drive.url,'https://drive.google.com/file/d/invoice-remote-1/view');assert.equal(f.calls.filter(c=>c.url.includes('/upload/')).length,1);
  const again=await call(f,base+'/'+r.id+'/drive','finance','POST',{});assert.equal(again.status,200,await again.clone().text());assert.equal(f.calls.filter(c=>c.url.includes('/upload/')).length,1);assert.deepEqual([...f.remote.values()].filter(x=>x.name&&x.mimeType.includes('folder')).map(x=>x.name),['YG Finance','Invoice','2026','RAPP']);assert.equal((await call(f,base+'/'+r.id+'/drive','other','POST',{})).status,403);
  const cross=request(base+'/'+r.id+'/drive','director','POST',{});cross.headers.set('Origin','https://evil.test');assert.equal((await worker.fetch(cross,f.env)).status,403);const final=f.db.prepare('SELECT * FROM yg_invoices WHERE id=?').get(r.id);assert.equal(final.version,r.version);assert.deepEqual(f.objects.get(final.pdf_key).bytes,original);assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM finance_transactions').all()),oldFinance);assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM team_agendas').all()),oldAgendas);assert(!f.calls.some(c=>c.url.includes('/permissions')));assert(!JSON.stringify(status).includes('private-refresh'));
 }finally{globalThis.fetch=previous;}
});
test('Drive archive rejects drafts and bad checksum; revoked connection never rolls back approval',async()=>{
 const f=await driveFixture(),previous=globalThis.fetch;globalThis.fetch=f.fetch;
 try{let r=await readyInvoice(f);assert.equal((await call(f,base+'/'+r.id+'/drive','director','POST',{})).status,409);f.setBadHash();r=await(await call(f,base+'/'+r.id+'/issue','director','POST',{version:r.version,reviewed_version:r.version})).json();assert.equal(r.status,'issued');assert.equal(r.drive.status,'error');assert.equal(r.drive.url,null);const before=JSON.stringify(f.db.prepare('SELECT * FROM yg_invoices').all());f.setRevoked();assert.equal((await call(f,base+'/'+r.id+'/drive','director','POST',{})).status,409);assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM yg_invoices').all()),before);assert.equal(f.db.prepare('SELECT status FROM agenda_drive_connection').get().status,'reconnect');
 }finally{globalThis.fetch=previous;}
});


test('USD and SGD invoices save and issue integer cents with currency locked in final snapshot, keeping historical rows intact',async()=>{
 for(const currency of ['USD','SGD']){
 const f=await setup();let r=await create(f,{currency,contract_amount:12500.25,percentage:40});const path=base+'/'+r.id;assert.equal(r.total,500010);assert.equal(r.data.currency,currency);assert.equal(f.db.prepare('SELECT typeof(total) t FROM yg_invoices').get().t,'integer');const list=await(await call(f)).json();assert.equal(list.invoices[0].currency,currency);
 r=await(await call(f,path,'finance','PUT',{...r.data,number:r.number,version:r.version,customer_address:'Test address',bank:'Test bank',account:'123456789',account_name:'YG',number_reviewed:true,design_reviewed:true})).json();r=await attach(f,r,'contract');const result=await call(f,path+'/issue','director','POST',{version:r.version,reviewed_version:r.version});assert.equal(result.status,200,await result.clone().text());r=await result.json();assert.equal(r.status,'issued');assert.equal(r.data.currency,currency);assert.equal(r.total,500010);assert.equal((await call(f,path,'finance','PUT',{...r.data,currency:'IDR',number:r.number,version:r.version})).status,409);assert.equal(f.db.prepare('SELECT amount FROM finance_transactions').get().amount,123456);
 }
});
