import test from 'node:test';
import assert from 'node:assert/strict';
import {donationInput,matchDonation,donationPdf,donationsRoute} from '../src/donations.mjs';
import {donationsPage} from '../src/donations-page.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const input=()=>({amount:100,date:'2026-11-21',donor:'Test donor',reference:'ABC-123',allocations:[{kind:'salary',staff:'Zamharir',amount:40},{kind:'salary',staff:'Riena Rachmatillah',amount:60}]});
test('split donations must balance and target known staff',()=>{
 assert.equal(donationInput(input()).allocations.length,2);
 for(const change of [v=>v.allocations[0].amount=41,v=>v.allocations[1].staff='Unknown',v=>v.allocations[1].staff='Zamharir',v=>v.amount=NaN,v=>v.date='2026-02-30']){const v=input();change(v);assert.throws(()=>donationInput(v));}
});
test('bank match requires unique date, reference and full amount, grouping split rows',()=>{
 const rows=[{id:'2026:5:0',date:'2026-11-21',reference:'ABC123',credit:4000,debit:0},{id:'2026:5:1',date:'2026-11-21',reference:'ABC123',credit:6000,debit:0}];
 assert.equal(matchDonation(input(),{rows}),'2026:5');assert.equal(matchDonation({...input(),reference:''},{rows}),null);
 assert.equal(matchDonation(input(),{rows:[...rows,{...rows[0],id:'2026:6',credit:10000}]}),null);
 assert.equal(matchDonation({...input(),amount:101},{rows}),null);
});
test('receipt is generated as a real PDF and page script parses',async()=>{
 const bytes=await donationPdf({seq:1,created_at:'2026-11-21',version:1,creator_email:'test@example.org',payload:input()},readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url)));assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
 const script=donationsPage().match(/<script>([\s\S]*)<\/script>/)[1];assert.doesNotThrow(()=>new Function(script));
});
test('donation route rejects unrelated staff and cross-origin writes before database access',async()=>{
 await assert.rejects(()=>donationsRoute(new Request('https://staff.yayasangambut.org/finance/donations'),{}, {email:'other@yayasangambut.org'},{}),e=>e.status===403);
 await assert.rejects(()=>donationsRoute(new Request('https://staff.yayasangambut.org/finance/donations/upload',{method:'POST',headers:{Origin:'https://evil.example'}}),{APP_ORIGIN:'https://staff.yayasangambut.org'},{role:'admin',email:'mulyadi@yayasangambut.org'},{}),e=>e.status===403);
});
test('upload, duplicate detection, edit history and PDF work against transactional database',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0050_donations.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0051_donation_archives.sql',import.meta.url),'utf8'));db.exec('CREATE TABLE finance_settings(setting_key TEXT,setting_value TEXT)');
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(statements){db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const objects=new Map(),env={DB,ASSETS:{async fetch(){return new Response(readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url)));}},APP_ORIGIN:'https://staff.yayasangambut.org',MEDIA:{async put(k,v){objects.set(k,v);},async delete(k){objects.delete(k);},async get(k){return {body:objects.get(k)};}},AI:{async run(){return {response:JSON.stringify({...input(),account:'0000000000000',recipient:'Test beneficiary',success:true})};}}},u={role:'admin',email:'mulyadi@yayasangambut.org'};
 const call=(path,method='GET',data)=>donationsRoute(new Request(env.APP_ORIGIN+'/finance/donations'+path,{method,headers:{Origin:env.APP_ORIGIN},...(data?{body:data}:{})}),env,u,{readLimited:async r=>new Uint8Array(await r.arrayBuffer()),payload:r=>r.json()});
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0]);
 const uploaded=await (await call('/upload','POST',png)).json();assert.equal(uploaded.row.seq,1);
 const duplicate=await (await call('/upload','POST',png)).json();assert.equal(duplicate.duplicate,true);assert.equal(objects.size,1);
 const saved=await (await call('/'+uploaded.row.id,'PUT',JSON.stringify({...input(),version:0}))).json();assert.equal(saved.row.version,1);assert.equal(saved.row.payload.bankId,null);
 await assert.rejects(()=>call('/'+saved.row.id,'PUT',JSON.stringify({...input(),version:0})),e=>e.status===409);
 const edited=await (await call('/'+saved.row.id,'PUT',JSON.stringify({...input(),version:1,allocations:[{kind:'general',amount:100}]}))).json();assert.equal(edited.row.seq,1);assert.equal(db.prepare('SELECT count(*) AS n FROM yg_donation_events').get().n,2);
 db.prepare("INSERT INTO yg_donation_files(id,request_id,version,purpose,filename,storage_key,mime,size) VALUES(?,?,1,'receipt','legacy.pdf','legacy-key','application/pdf',1)").run('legacy',saved.row.id);
 assert.equal((await call('/'+saved.row.id+'/receipt')).headers.get('Content-Type'),'application/pdf');assert.equal(db.prepare('SELECT count(*) AS n FROM yg_donation_files').get().n,4);assert.equal(db.prepare("SELECT storage_key FROM yg_donation_files WHERE id='legacy'").get().storage_key,'legacy-key');assert.equal(db.prepare('SELECT version FROM yg_donations WHERE id=?').get(saved.row.id).version,2);db.close();
});

test('public receipt omits allocation and operator data and embeds the YG letterhead',async()=>{
 const {PDFDocument,decodePDFRawStream}=await import('pdf-lib');
 const head=readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url));
 const base={seq:7,created_at:'2026-11-21',version:1,creator_email:'private@example.org',payload:input()};
 const content=async row=>{const d=await PDFDocument.load(await donationPdf(row,head));assert.equal(d.getPageCount(),1);const page=d.getPages()[0];const stream=d.context.lookup(page.node.Contents().get(0));const text=new TextDecoder().decode(decodePDFRawStream(stream).decode());assert.ok(text.includes(' Do'));return text;};
 const before=await content(base),after=await content({...base,creator_email:'another-private@example.org',version:9,payload:{...base.payload,allocations:[{kind:'general',amount:100}]}});
 assert.equal(before,after,'allocation edits and operator identity must never affect the receipt');
 assert.ok(before.includes(Buffer.from('KWITANSI PENERIMAAN').toString('hex').toUpperCase()));
});
