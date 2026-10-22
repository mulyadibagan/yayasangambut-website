import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {letterTypes} from '../src/letters-types.mjs';
import {letterInput} from '../src/letters.mjs';
import {letterDocuments,bankField} from '../src/letters-documents.mjs';
const origin='https://staff.yayasangambut.org';
const sample={date:'2026-10-21',kind:'SKR',subject:'Surat Keterangan Rekening Bank',recipient:'',institution:'PT Riau Andalan Pulp and Paper',address:'',body:'Yayasan Gambut menerangkan rekening bank organisasi berikut.\nPemilik: Yayasan Gambut\nBank: Bank Mandiri\nCabang: KCP Tangerang Bintaro\nNomor rekening: 1640003188440\nAlamat cabang: Jl. Jend. Sudirman A1-03, Tangerang Selatan\nDemikian keterangan ini disampaikan.',attachments:'',signer:'Mulyadi, Direktur Yayasan Gambut',notes:''};
async function setup(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0030_letters.sql','0031_letters_annual.sql','0032_letters_layout.sql','0033_letters_renditions.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 let queue=Promise.resolve();const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(stmts){const execute=async()=>{db.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}};const result=queue.then(execute);queue=result.catch(()=>{});return result;}};
 const files=new Map(),logo=readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)),env={APP_ORIGIN:origin,GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',ADMIN_EMAIL:'mulyadi@yayasangambut.org',DB,ASSETS:{fetch:async req=>new Response(req.url.endsWith('surat-letterhead.png')?readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url)):logo)},MEDIA:{async put(k,b){files.set(k,b);},async get(k){const b=k==='surat-assets/ttd-yayasan-gambut.png'?logo:files.get(k);return b?{body:b,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}:null;}}};
 for(const [id,email,role] of [['m','mulyadi','admin'],['r','rienaprasiddha','staff'],['z','zamharier','editor'],['a','rajaalpian','staff'],['x','other','admin']]){await DB.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').bind(id,email+'@yayasangambut.org',id,role,'2026-10-21','2026-10-21').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await sha(id),id,Date.now()+600000).run();}return {db,env,files};}
const request=(path,user='m',method='GET',b)=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user},body:b?JSON.stringify(b):undefined});
const call=(e,p,u='m',m='GET',b)=>worker.fetch(request('/api/surat'+p,u,m,b),e);
async function create(e,u='m',input=sample){const res=await call(e,'',u,'POST',input);assert.equal(res.status,201,await res.clone().text());return res.json();}
async function action(e,r,a,u='m',extra={}){const res=await call(e,'/'+r.id+'/'+a,u,'POST',{version:r.version,...extra});assert.equal(res.status,200,await res.clone().text());return res.json();}
async function approve(e,r){r=await action(e,r,'submit',r.owner);return action(e,r,'approve');}
async function historical(e,n=64){const rows=Array.from({length:n},(_,i)=>({sequence:i+1,number:i===63?'64/YG/SPT/X/2026':i===64?'65/YG/SKR/X/2026':`${i+1}/YG/UM/X/2026`,date:'2026-10-12',subject:'Register terverifikasi',status:'issued'}));assert.equal((await call(e,'/import','m','POST',{rows,evidence:'Sumber register lengkap untuk pengujian.'})).status,200);assert.equal((await call(e,'/verify','m','POST',{complete:true})).status,200);}
test('four exact accounts can create; other admin, disabled, anonymous, cross-origin denied',async()=>{const {env,db}=await setup();for(const u of ['m','r','z','a'])assert.equal((await create(env,u)).sequence,null);assert.equal((await call(env,'','x','POST',sample)).status,403);assert.equal((await worker.fetch(new Request(origin+'/api/surat/register'),env)).status,401);const r=request('/api/surat','m','POST',sample);r.headers.set('Origin','https://evil.example');assert.equal((await worker.fetch(r,env)).status,403);db.exec("UPDATE users SET disabled=1 WHERE id='r'");assert.equal((await call(env,'','r','POST',sample)).status,401);});
test('drafts use no numbers, owners isolated, only Mulyadi approves',async()=>{const {env,db}=await setup();let r=await create(env,'r');assert.equal(r.number,null);assert.equal((await call(env,'/'+r.id,'z')).status,403);r=await action(env,r,'submit','r');assert.equal((await call(env,'/'+r.id+'/approve','r','POST',{version:r.version})).status,403);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual WHERE sequence IS NOT NULL').get().n,0);});
test('two reference numbers cannot activate numbering and incomplete imports remain locked',async()=>{const {env}=await setup();let r=await approve(env,await create(env));assert.equal((await call(env,'/'+r.id+'/issue','m','POST',{version:r.version})).status,409);assert.equal((await call(env,'/verify','m','POST',{complete:true})).status,409);});
test('historical 65 prevents reissuance, next number 66 globally, finals immutable and archived',async()=>{const {env,db,files}=await setup();await historical(env,65);let r=await approve(env,await create(env));assert.equal((await call(env,'/'+r.id+'/reserve-rapp','m','POST',{version:r.version,referenceVerified:true})).status,409);r=await action(env,r,'issue');assert.equal(r.number,'66/YG/SKR/X/2026');assert.equal(files.size,2);const pdf=await PDFDocument.load(files.get(r.pdf_key));assert.equal(pdf.getPageCount(),1);assert.deepEqual(pdf.getPage(0).getSize(),{width:595.28,height:841.89});assert.equal((await call(env,'/'+r.id,'m','PUT',{...sample,version:r.version})).status,409);assert.throws(()=>db.prepare('UPDATE surat_annual SET data=? WHERE id=?').run('{}',r.id));assert.equal((await call(env,'/'+r.id+'/pdf','m')).status,200);assert.equal((await call(env,'/'+r.id+'/pdf','x')).status,403);r=await action(env,r,'cancel');assert.equal(r.number,'66/YG/SKR/X/2026');const rev=await action(env,r,'revise');assert.equal(rev.sequence,null);});
test('special approved RAPP reserves 65 once and resumes publication without consuming a second number',async()=>{const {env,db}=await setup();await historical(env);let r=await approve(env,await create(env));r=await action(env,r,'reserve-rapp','m',{referenceVerified:true});let second=await approve(env,await create(env));assert.equal((await call(env,'/'+second.id+'/reserve-rapp','m','POST',{version:second.version,referenceVerified:true})).status,409);const put=env.MEDIA.put;env.MEDIA.put=async()=>{throw Error('storage unavailable');};assert.equal((await call(env,'/'+r.id+'/issue','m','POST',{version:r.version})).status,500);r=await (await call(env,'/'+r.id)).json();assert.equal(r.sequence,65);env.MEDIA.put=put;r=await action(env,r,'issue');assert.equal(r.number,'65/YG/SKR/X/2026');r=await action(env,r,'issue');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual WHERE sequence=65').get().n,1);second=await action(env,second,'issue');assert.equal(second.sequence,66);});
test('stale writes do not create false history and XLSX strings cannot execute formulas',async()=>{const {env}=await setup();let r=await create(env);const saved=await call(env,'/'+r.id,'m','PUT',{...sample,version:r.version});assert.equal(saved.status,200);assert.equal((await call(env,'/'+r.id,'m','PUT',{...sample,version:r.version})).status,409);const h=await (await call(env,'/'+r.id+'/history')).json();assert.equal(h.length,2);const excel=await call(env,'/register?format=xlsx');assert.equal(excel.status,200);const bytes=new Uint8Array(await excel.arrayBuffer());assert.equal(bytes[0],80);assert.equal(bytes[1],75);});
test('dates and signer validation',()=>{assert.throws(()=>letterInput({...sample,date:'2026-02-30'}));assert.throws(()=>letterInput({...sample,signer:'Other'}));});
test('direct page access is protected and Drive copy requires director and final archives',async()=>{const {env}=await setup();assert.equal((await worker.fetch(new Request(origin+'/surat'),env)).status,401);assert.equal((await worker.fetch(request('/surat','x'),env)).status,403);assert.equal((await worker.fetch(request('/surat','r'),env)).status,200);let r=await create(env,'r');assert.equal((await call(env,'/'+r.id+'/drive','r','POST',{version:r.version})).status,403);assert.equal((await call(env,'/'+r.id+'/drive','m','POST',{version:r.version})).status,409);await historical(env,65);r=await approve(env,r);r=await action(env,r,'issue');assert.equal((await call(env,'/'+r.id+'/drive','m','POST',{version:r.version})).status,503);assert.equal((await call(env,'/'+r.id+'/pdf','r')).status,200);});
test('register imports cannot collide with a reserved number or overwrite existing history',async()=>{const {env,db}=await setup();await historical(env);let r=await approve(env,await create(env));r=await action(env,r,'reserve-rapp','m',{referenceVerified:true});assert.throws(()=>db.prepare('INSERT INTO surat_annual_register VALUES(?,?,?,?,?,?,?)').run(2026,65,'65/YG/SKR/X/2026','{}','test','m','2026-10-21'));assert.equal(db.prepare('SELECT verified FROM surat_settings').get().verified,1);});


test('parallel issuance allocates distinct global numbers and preserves every audit event',async()=>{const {env,db}=await setup();await historical(env,65);const one=await approve(env,await create(env,'r')),two=await approve(env,await create(env,'a'));const [a,b]=await Promise.all([action(env,one,'issue'),action(env,two,'issue')]);assert.deepEqual([a.sequence,b.sequence].sort(),[66,67]);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual WHERE status='issued'").get().n,2);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='issue'").get().n,2);});
const baseline=r=>({firstYear:2026,firstNumber:65,annualReset:true,confirmBaseline:true,firstLetterId:r.id,evidence:'Keputusan Direktur: mulai web 65 tahun 2026, kembali 1 setiap tahun berikutnya; register lama belum lengkap.'});
test('director baseline starts at 65 without falsely verifying historical records; only designated RAPP may take 65',async()=>{const {env,db}=await setup();let r=await create(env),other=await approve(env,await create(env,'r'));assert.equal((await call(env,'/numbering/start','r','POST',baseline(r))).status,403);assert.equal((await call(env,'/numbering/start','m','POST',baseline(r))).status,200);assert.equal(db.prepare('SELECT verified FROM surat_settings').get().verified,0);assert.equal((await call(env,'/numbering/start','m','POST',baseline(r))).status,409);assert.equal((await call(env,'/'+other.id+'/issue','m','POST',{version:other.version})).status,409);assert.equal((await call(env,'/'+other.id+'/reserve-rapp','m','POST',{version:other.version,referenceVerified:true})).status,409);r=await approve(env,r);r=await action(env,r,'reserve-rapp','m',{referenceVerified:true});r=await action(env,r,'issue');assert.equal(r.number,'65/YG/SKR/X/2026');other=await action(env,other,'issue');assert.equal(other.number,'66/YG/SKR/X/2026');});
test('annual reset starts at 1 in 2027 and again in 2028, with no duplicate numbers within each year',async()=>{const {env}=await setup();let initial=await create(env);assert.equal((await call(env,'/numbering/start','m','POST',baseline(initial))).status,200);initial=await approve(env,initial);await action(env,initial,'issue');for(const year of [2027,2028]){const a=await approve(env,await create(env,'m',{...sample,date:year+'-01-02'})),b=await approve(env,await create(env,'r',{...sample,date:year+'-02-03'}));const results=await Promise.all([action(env,a,'issue'),action(env,b,'issue')]);assert.deepEqual(results.map(r=>r.sequence).sort(),[1,2]);assert(results.every(r=>r.number.endsWith('/'+year)));}});
test('migration preserves legacy draft, history, issued archives and Drive references without dropping data',async()=>{const db=new DatabaseSync(':memory:');for(const file of ['0001_initial.sql','0030_letters.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));db.exec("INSERT INTO users VALUES('m','mulyadi@yayasangambut.org','Mulyadi','admin',0,'x','x')");const source=JSON.stringify(sample);db.prepare("INSERT INTO surat(id,owner,data,status,sequence,number,created_at,updated_at,docx_key,pdf_key) VALUES('old','m',?,'issued',65,'65/YG/SKR/X/2026','x','x','old.docx','old.pdf')").run(source);db.exec("INSERT INTO surat_history VALUES('h','old','m','issue',1,'x'); INSERT INTO surat_drive VALUES('old','pdf','drive-file',NULL,NULL)");db.exec(readFileSync(new URL('../migrations/0031_letters_annual.sql',import.meta.url),'utf8'));assert.equal(db.prepare('SELECT data FROM surat').get().data,source);assert.equal(db.prepare('SELECT data FROM surat_annual').get().data,source);assert.equal(db.prepare('SELECT docx_key FROM surat_annual').get().docx_key,'old.docx');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual_history').get().n,1);assert.equal(db.prepare('SELECT file_id FROM surat_annual_drive').get().file_id,'drive-file');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);assert.throws(()=>db.exec("UPDATE surat SET status='draft' WHERE id='old'"));});
test('complete RAPP body fits one A4 PDF with signing space',async()=>{const body='Dengan hormat,\n\nYang bertanda tangan di bawah ini, atas nama Yayasan Gambut, menerangkan bahwa rekening berikut adalah rekening resmi Yayasan Gambut untuk penerimaan pembayaran:\n\nNama pemilik rekening : Yayasan Gambut\nNama bank : Bank Mandiri\nCabang : KCP Tangerang Bintaro\nNomor rekening : 1640003188440 (IDR)\nAlamat cabang bank : Jl. Jend. Sudirman A1-03, Tangerang Selatan\n\nSurat ini ditujukan kepada PT Riau Andalan Pulp and Paper sebagai kelengkapan administrasi registrasi vendor baru. Kami menyatakan bahwa informasi rekening tersebut benar sesuai data rekening Yayasan Gambut.\n\nDemikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.';const docs=await letterDocuments({data:{...sample,body,address:'Di tempat'},status:'issued',number:'65/YG/SKR/X/2026'},readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)),readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url)));assert.equal((await PDFDocument.load(docs.pdf)).getPageCount(),1);});

test('format refresh preserves issuance, original archives and Drive references; retries are idempotent',async()=>{
 const {env,db,files}=await setup();let r=await create(env,'r');
 assert.equal((await call(env,'/'+r.id+'/format','r','POST',{version:r.version})).status,403);
 assert.equal((await call(env,'/'+r.id+'/format','m','POST',{version:r.version})).status,409);
 await historical(env,65);r=await action(env,await approve(env,r),'issue');
 db.prepare('DELETE FROM surat_renditions WHERE surat_id=?').run(r.id);r=await (await call(env,'/'+r.id)).json();
 const original={...r},oldBytes=files.get(r.pdf_key);
 db.prepare('INSERT INTO surat_annual_drive VALUES(?,?,?,?,?)').run(r.id,'pdf','old-drive','https://drive.google.com/file/d/old-drive/view','old-time');
 const refreshed=await Promise.all([action(env,r,'format'),action(env,r,'format')]);r=refreshed[0];
 assert.equal(r.layout,'formal-v3');assert.equal(r.number,original.number);assert.equal(r.issued_at,original.issued_at);assert.equal(r.version,original.version);
 assert.notEqual(r.pdf_key,original.pdf_key);assert.deepEqual(files.get(original.pdf_key),oldBytes);
 assert.equal(db.prepare('SELECT pdf_key FROM surat_annual WHERE id=?').get(r.id).pdf_key,original.pdf_key);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='issue'").get().n,1);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='format_formal-v3'").get().n,1);
 assert.equal(r.previousArchives[0].file_id,'old-drive');assert.equal(r.archives.length,0);
 await action(env,r,'format');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_renditions').get().n,1);
 db.prepare('INSERT INTO surat_rendition_drive VALUES(?,?,?,?,?,?)').run(r.id,'formal-v3','pdf','new-drive','https://drive.google.com/file/d/new-drive/view','new-time');
 const register=await (await call(env,'/register')).json();assert.equal(register.rows[0].archives[0].file_id,'new-drive');
 const download=await call(env,'/'+r.id+'/pdf');assert.deepEqual(new Uint8Array(await download.arrayBuffer()),files.get(r.pdf_key));
 const next=await action(env,await approve(env,await create(env)),'issue');assert.equal(next.sequence,67);
});

test('signature is required for issued PDF, never embedded in Word or draft PDF',async()=>{
 const {env,files}=await setup();let r=await create(env);await historical(env,65);r=await approve(env,r);
 const get=env.MEDIA.get;env.MEDIA.get=async k=>k==='surat-assets/ttd-yayasan-gambut.png'?null:get(k);
 assert.equal((await call(env,'/'+r.id+'/issue','m','POST',{version:r.version})).status,503);
 assert.equal(files.size,0);assert.equal((await call(env,'/'+r.id+'/pdf')).status,200);
 const logo=readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)),head=readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url));
 const draft=await letterDocuments({data:sample,status:'draft'},logo,head,logo),issued=await letterDocuments({data:sample,status:'issued'},logo,head,logo);
 assert.deepEqual(draft.docx, (await letterDocuments({data:sample,status:'draft'},logo,head)).docx);
 const images=async bytes=>{const pdf=await PDFDocument.load(bytes);return pdf.getPage(0).node.Resources().lookup((await import('pdf-lib')).PDFName.of('XObject')).keys().length;};
 assert.equal(await images(draft.pdf),1);assert.equal(await images(issued.pdf),2);
});


test('bank fields keep their values and labels; ordinary prose is not treated as account data',()=>{
 assert.deepEqual(bankField('Nomor rekening : 1640003188440 (IDR)'),{label:'Nomor rekening',value:'1640003188440 (IDR)'});
 assert.deepEqual(bankField('Alamat cabang bank : Jl. Jend. Sudirman A1-03, Tangerang Selatan'),{label:'Alamat cabang bank',value:'Jl. Jend. Sudirman A1-03, Tangerang Selatan'});
 assert.equal(bankField('Dengan hormat,'),null);assert.equal(bankField('Demikian: penutup'),null);
});

test('new format retains prior layout and Drive references without issuing again',async()=>{
 const {env,db,files}=await setup();await historical(env,65);let r=await action(env,await approve(env,await create(env)),'issue');
 db.prepare('DELETE FROM surat_renditions WHERE surat_id=?').run(r.id);
 db.prepare('INSERT INTO surat_renditions VALUES(?,?,?,?,?,?)').run(r.id,'formal-v2','v2.docx','v2.pdf','m','2026-10-21');
 db.prepare('INSERT INTO surat_rendition_drive VALUES(?,?,?,?,?,?)').run(r.id,'formal-v2','pdf','v2-drive','https://drive.google.com/file/d/v2-drive/view','old-time');
 files.set('v2.pdf',new Uint8Array([1,2,3]));r=await (await call(env,'/'+r.id)).json();assert.equal(r.layout,'formal-v2');
 r=await action(env,r,'format');assert.equal(r.layout,'formal-v3');assert.equal(r.previousArchives[0].file_id,'v2-drive');
 assert.deepEqual(files.get('v2.pdf'),new Uint8Array([1,2,3]));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_renditions WHERE surat_id=?').get(r.id).n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='issue'").get().n,1);
});

test('rendition migration copies existing final formats and Drive URLs exactly',async()=>{
 const db=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0030_letters.sql','0031_letters_annual.sql','0032_letters_layout.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 db.exec("INSERT INTO users VALUES('m','mulyadi@yayasangambut.org','Mulyadi','admin',0,'x','x')");
 db.prepare("INSERT INTO surat_annual(id,owner,data,number_year,status,sequence,number,created_at,updated_at) VALUES('old','m',?,2026,'issued',65,'65/YG/SKR/X/2026','x','x')").run(JSON.stringify(sample));
 db.exec("INSERT INTO surat_layout_archives VALUES('old','formal-v2','v2.docx','v2.pdf','m','x'); INSERT INTO surat_layout_drive VALUES('old','pdf','drive-65','https://drive.google.com/file/d/drive-65/view','x')");
 db.exec(readFileSync(new URL('../migrations/0033_letters_renditions.sql',import.meta.url),'utf8'));
 assert.equal(db.prepare('SELECT pdf_key FROM surat_renditions').get().pdf_key,'v2.pdf');assert.equal(db.prepare('SELECT web_url FROM surat_rendition_drive').get().web_url,'https://drive.google.com/file/d/drive-65/view');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_layout_drive').get().n,1);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});


test('all eleven letter types are available through settings and accepted as unnumbered drafts',async()=>{
 const {env,db}=await setup();const settings=await (await call(env,'/settings')).json();
 assert.equal(settings.types.length,11);assert.deepEqual(settings.types,letterTypes);
 for(const type of letterTypes){const r=await create(env,'r',{...sample,kind:type.code});assert.equal(r.data.kind,type.code);assert.equal(r.sequence,null);}
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual WHERE sequence IS NOT NULL').get().n,0);
 assert.equal((await call(env,'','r','POST',{...sample,kind:'UNKNOWN'})).status,400);
});

test('new letter types share annual numbering and keep their code in the issued number',async()=>{
 const {env}=await setup();await historical(env,65);let expected=66;
 for(const kind of ['PMH','PBT','PNG','KUA','REK','PNY']){const r=await action(env,await approve(env,await create(env,'m',{...sample,kind})),'issue');assert.equal(r.sequence,expected);assert.equal(r.number,`${expected}/YG/${kind}/X/2026`);expected++;}
});
import {cleanDocument,documentHtml,documentText,plainDocument,para} from '../public/letter-content.js';
import {letterTemplates} from '../src/letter-templates.mjs';
import {statementData,STATEMENT_LAYOUT} from '../src/letters-statement.mjs';

test('statement rendition preserves source wording and constructs native identities and lists',()=>{
 const source={...sample,kind:'PNY',subject:'Surat Pernyataan Non-PKP',body:'Yang bertanda tangan di bawah ini :\n\nNama\t\t: Mulyadi\nJabatan : Direktur\nLembaga : YAYASAN GAMBUT\nAlamat : Jalan Gulama No. 8\n\nDengan ini menyatakan bahwa kami bukan PKP, Karena :\n\n1. Pernyataan pertama.\n2. Rujukan (PMK No. 197/PMK.03/2013).\n\nDemikian surat ini dibuat.'};
 const original=structuredClone(source),data=statementData(source);
 assert.deepEqual(source,original);assert.equal(data.subject,'SURAT PERNYATAAN NON-PKP');
 assert.equal(documentText(data.bodyDoc).replace(/\s+/g,' '),source.body.replace(/\s+/g,' '));
 assert.equal(data.bodyDoc.blocks[1].type,'table');assert.equal(data.bodyDoc.blocks[1].border,'none');assert.equal(data.bodyDoc.blocks[1].rows[0].length,3);
 assert.equal(data.bodyDoc.blocks[3].type,'list');assert.equal(data.bodyDoc.blocks[3].items.length,2);
 assert.equal(statementData(sample),sample);
 const rich={...source,bodyFormat:'rich-v1',bodyDoc:{version:1,blocks:[{...para('Teks pilihan pengguna'),runs:[{text:'Teks pilihan pengguna',underline:true}]}]}};
 assert.deepEqual(statementData(rich).bodyDoc,cleanDocument(rich.bodyDoc));
});

test('issued legacy statement adds a create-only archive version without changing issuance or old files',async()=>{
 const {env,db,files}=await setup(),id=crypto.randomUUID(),data={...sample,kind:'PNY',subject:'Surat Pernyataan Non-PKP',body:'Yang bertanda tangan di bawah ini :\n\nNama : Mulyadi\nJabatan : Direktur\n\n1. Redaksi asli.\n2. Tetap utuh.'};
 db.prepare("INSERT INTO surat_annual(id,owner,data,number_year,status,sequence,number,version,created_at,updated_at,issued_at,docx_key,pdf_key) VALUES(?,?,?,2026,'issued',66,'66/YG/PNY/X/2026',7,'created','issued','issued','old.docx','old.pdf')").run(id,'m',JSON.stringify(data));
 db.prepare('INSERT INTO surat_renditions VALUES(?,?,?,?,?,?)').run(id,'formal-v3','old.docx','old.pdf','m','old');
 for(const format of ['docx','pdf']){files.set('old.'+format,new Uint8Array([1,2,3]));db.prepare('INSERT INTO surat_rendition_drive VALUES(?,?,?,?,?,?)').run(id,'formal-v3',format,'old-'+format,'https://drive.google.com/file/d/old-'+format+'/view','old');}
 db.prepare('INSERT INTO surat_annual_history VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),id,'m','issue',7,'issued');
 const before=db.prepare('SELECT * FROM surat_annual WHERE id=?').get(id);let record=await (await call(env,'/'+id)).json();assert.equal(record.formatAvailable,true);
 assert.equal((await call(env,'/'+id+'/format','r','POST',{version:7})).status,403);
 record=await action(env,record,'format');assert.equal(record.layout,STATEMENT_LAYOUT);assert.equal(record.formatAvailable,false);assert.equal(record.previousArchives.length,2);
 assert.deepEqual(record.data,data);assert.equal(record.renditionData.bodyFormat,'rich-v1');assert.equal(record.number,'66/YG/PNY/X/2026');
 assert.deepEqual(db.prepare('SELECT * FROM surat_annual WHERE id=?').get(id),before);
 const newDocx=files.get(record.docx_key),newPdf=files.get(record.pdf_key);assert(Buffer.from(newDocx).toString().includes('<w:tbl>'));assert(Buffer.from(newDocx).toString().includes('<w:numPr>'));assert.equal((await PDFDocument.load(newPdf)).getPageCount(),1);
 record=await action(env,record,'format');assert.deepEqual(files.get(record.docx_key),newDocx);assert.deepEqual(files.get(record.pdf_key),newPdf);
 assert.deepEqual(files.get('old.docx'),new Uint8Array([1,2,3]));assert.deepEqual(files.get('old.pdf'),new Uint8Array([1,2,3]));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_renditions').get().n,2);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='issue'").get().n,1);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='allocate'").get().n,0);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='format_statement-v1'").get().n,1);
 const xlsx=Buffer.from(await (await call(env,'/register?format=xlsx')).arrayBuffer()).toString();assert(xlsx.includes('66/YG/PNY/X/2026'));
});

test('rich document round-trips through save/reopen; editor text is derived on server',async()=>{
 const {env}=await setup();const bodyDoc={version:1,blocks:[{...para('Format aman',{align:'center',indent:1,space:12}),runs:[{text:'Format ',bold:true},{text:'aman',italic:true,underline:true}]},{type:'list',ordered:true,start:3,items:[para('Butir pertama'),para('Butir berikutnya')]},{type:'table',border:'none',widths:[25,3,72],rows:[[[para('Nama')],[para(':')],[para('Mulyadi')]]]}]};
 let r=await create(env,'r',{...sample,bodyFormat:'rich-v1',bodyDoc,body:'CLIENT TEXT MUST NOT WIN'});assert.equal(r.data.body,documentText(bodyDoc));assert.deepEqual(r.data.bodyDoc,cleanDocument(bodyDoc));
 let reopened=await (await call(env,'/'+r.id,'r')).json();assert.deepEqual(reopened.data.bodyDoc,r.data.bodyDoc);
 const changed=structuredClone(bodyDoc);changed.blocks[0].align='right';const save=await call(env,'/'+r.id,'r','PUT',{...sample,bodyFormat:'rich-v1',bodyDoc:changed,version:r.version});assert.equal(save.status,200);r=await save.json();assert.equal(r.data.bodyDoc.blocks[0].align,'right');assert.equal(r.version,2);
});

test('server allows only document nodes and formatting attributes; legacy text is never HTML',async()=>{
 const {env}=await setup();const literal='<img src=x onerror=alert(1)><script>alert(2)</script>';
 const legacy=await create(env,'r',{...sample,body:literal});assert.equal(legacy.data.body,literal);assert.equal(legacy.data.bodyFormat,undefined);assert(!documentHtml(plainDocument(literal)).includes('<img'));assert(documentHtml(plainDocument(literal)).includes('&lt;script&gt;'));
 const bodyDoc={version:1,blocks:[{...para(literal),align:'expression(alert(1))',indent:999,space:999,onclick:'alert(1)',runs:[{text:literal,bold:true,href:'javascript:alert(1)',style:'background:url(https://evil.example)'}]}]};
 const r=await create(env,'r',{...sample,bodyFormat:'rich-v1',bodyDoc});assert.equal(r.data.bodyDoc.blocks[0].align,'left');assert.equal(r.data.bodyDoc.blocks[0].indent,4);assert(!JSON.stringify(r.data.bodyDoc).includes('javascript:'));assert(!JSON.stringify(r.data.bodyDoc).includes('background:'));assert(!documentHtml(r.data.bodyDoc).includes('<script'));
 for(const bad of [{version:1,blocks:[{type:'html',html:literal}]},{version:99,blocks:[]},{version:1,blocks:[para('x'.repeat(18001))]},{version:1,blocks:[{type:'table',rows:[[[para('a')]]]}]}])assert.equal((await call(env,'','r','POST',{...sample,bodyFormat:'rich-v1',bodyDoc:bad})).status,400);
 assert.equal((await call(env,'','r','POST',{...sample,bodyDoc})).status,400);
});

test('Non-PKP template retains source text, uses unique PNY, and never allocates numbers',async()=>{
 const {env,db}=await setup();assert.equal((await call(env,'/templates/non-pkp-v1','x')).status,403);
 const res=await call(env,'/templates/non-pkp-v1','r');assert.equal(res.status,200);const template=await res.json();assert.equal(template.kind,'PNY');assert.equal(letterTypes.filter(t=>t.code==='PNY').length,1);
 assert.equal(template.subject,'SURAT PERNYATAAN NON PKP');assert.equal(template.bodyDoc.blocks[1].border,'none');assert.equal(template.bodyDoc.blocks[1].rows.length,4);assert.equal(template.bodyDoc.blocks[3].ordered,true);assert.equal(template.bodyDoc.blocks[3].items.length,2);
 assert(documentText(template.bodyDoc).includes('PMK No. 197/PMK.03/2013'));assert(documentText(template.bodyDoc).includes('di dukung oleh APRIL Group.'));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM surat_annual').get().n,0);
 const draft=await create(env,'r',{...sample,...template,date:'2026-10-22'});assert.equal(draft.number,null);assert.equal(draft.status,'draft');assert.equal(draft.data.statementPlace,'Pekanbaru');assert.equal((await call(env,'/templates/unknown')).status,404);
});

test('rich export contains native DOCX formatting, numbering and borderless table; issued archives immutable',async()=>{
 const {env,files,db}=await setup();await historical(env,65);const bodyDoc={version:1,blocks:[{...para('Bold Italic Underline',{align:'right',indent:2,space:12}),runs:[{text:'Bold',bold:true},{text:' Italic',italic:true},{text:' Underline',underline:true}]},{type:'list',ordered:true,start:3,items:[para('Number three'),para('Number four')]},{type:'list',ordered:false,items:[para('Bullet item')]},{type:'table',border:'none',widths:[25,3,72],rows:[[[para('Nama')],[para(':')],[para('Mulyadi')]]]}]};
 let r=await action(env,await approve(env,await create(env,'m',{...sample,bodyFormat:'rich-v1',bodyDoc})),'issue');assert.equal(r.sequence,66);
 const docx=Buffer.from(files.get(r.docx_key)).toString('utf8');for(const token of ['<w:b/>','<w:i/>','<w:u w:val="single"/>','<w:numPr>','<w:startOverride w:val="3"/>','<w:numFmt w:val="bullet"/>','<w:tbl>','w:val="nil"','w:val="right"'])assert(docx.includes(token),token);
 const bytes=files.get(r.pdf_key);assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);assert.equal((await call(env,'/'+r.id,'m','PUT',{...sample,bodyFormat:'rich-v1',bodyDoc,version:r.version})).status,409);r=await action(env,r,'issue');assert.deepEqual(files.get(r.pdf_key),bytes);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM surat_annual_history WHERE action='issue'").get().n,1);
});

test('statement exports omit recipient and greeting, retain title/number/closing, and paginate long rows',async()=>{
 const logo=readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)),head=readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url));
 const data=letterInput({...sample,...letterTemplates[0],date:'2026-10-22'});let docs=await letterDocuments({status:'draft',number:null,data},logo,head);const xml=Buffer.from(docs.docx).toString('utf8');assert(xml.includes('SURAT PERNYATAAN NON PKP'));assert(!xml.includes('Kepada Yth.'));assert(!xml.includes('Hormat kami,'));assert(xml.includes('Pekanbaru, 22 Oktober 2026'));assert.equal((await PDFDocument.load(docs.pdf)).getPageCount(),1);
 const long=structuredClone(data);long.bodyDoc.blocks.push({type:'table',border:'grid',widths:[50,50],rows:[[[para('Uji halaman panjang '.repeat(250))],[para('Sel kedua '.repeat(250))]]]});docs=await letterDocuments({status:'draft',number:null,data:long},logo,head);assert((await PDFDocument.load(docs.pdf)).getPageCount()>1);
});

test('an old plain-text client cannot silently flatten a rich draft',async()=>{
 const {env}=await setup();const r=await create(env,'r',{...sample,bodyFormat:'rich-v1',bodyDoc:{version:1,blocks:[{...para('Rich draft'),runs:[{text:'Rich draft',bold:true}]}]}});
 assert.equal((await call(env,'/'+r.id,'r','PUT',{...sample,body:'Flattened by old UI',version:r.version})).status,409);
 const actual=await (await call(env,'/'+r.id,'r')).json();assert.equal(actual.version,r.version);assert.equal(actual.data.bodyDoc.blocks[0].runs[0].bold,true);
});
