import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {finance} from '../src/kups-finance.mjs';
import {validateSourceReview} from '../src/kups-source-reviews.mjs';
import {sha} from '../src/core.mjs';
const group='dayun-rimba-sejahtera';
const sample=()=>({schema:1,title:'Sumber uji',reviewed_at:'2026-11-10',months:[{month:'2026-01',opening:100,income:20.125,expense:5,closing:115.125,source:'https://drive.google.com/file/d/source/view'}],rows:[['one','2026-01','2026-01-01','Penjualan','income',20.125,'','B01'],['two','2026-01','','Tanggal kosong','expense',5,'','B01']],notes:[['TGL','2026-01','Tanggal perlu diperiksa','B01','Cek bukti']]});
async function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,role TEXT,disabled INTEGER DEFAULT 0); INSERT INTO users VALUES('admin','admin@yayasangambut.org','Admin','admin',0); INSERT INTO users VALUES('member','member@gmail.com','Member','staff',0);");
 for(const name of ['0005_webgis_sso','0006_kups_finance','0007_kups_accounts_documents','0029_kups_closing_reconciliation','0043_kups_source_reviews'])db.exec(readFileSync(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO webgis_access VALUES('member@gmail.com','kups-finance',0); UPDATE kups_groups SET start_date='2026-08-01',opening_amount=5000; INSERT INTO kups_members VALUES('dayun-rimba-sejahtera','member@gmail.com','viewer',0);");
 const DB={prepare(sql){let args=[];const s={bind(...v){args=v;return s;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};return s;},async batch(ss){db.exec('BEGIN');try{const results=[];for(const s of ss)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
 for(const id of ['admin','member'])await DB.prepare('INSERT INTO webgis_sessions VALUES(?,?,?,?,?)').bind(await sha('yg-google-'+id),id,id==='admin'?'webgis-staff':'kups-finance',id==='admin'?'admin':'kups',Date.now()+100000).run();
 const call=async(user,method='GET',body)=>{const url=new URL('https://staff.yayasangambut.org/api/kups/source-review?group='+group),response=await finance(new Request(url,{method,headers:{Origin:'https://webgisyg.id',Authorization:'Bearer yg-google-'+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB},url);return {status:response.status,data:await response.json()};};
 return {db,call};
}
test('source review supports fractional source amounts and missing dates but rejects mismatched totals and duplicate IDs',()=>{
 assert.equal(validateSourceReview(sample()).status,'unverified');
 let s=sample();s.months[0].income=30;assert.throws(()=>validateSourceReview(s));
 s=sample();s.rows[1][0]='one';assert.throws(()=>validateSourceReview(s));
 s=sample();s.months[0].source='javascript:alert(1)';assert.throws(()=>validateSourceReview(s));
});
test('private archive is group-authorized, admin-only to save, retry-safe, and never changes live cash or documents',async()=>{
 const {db,call}=await fixture();
 const before=db.prepare('SELECT * FROM kups_groups').all();
 assert.equal((await call('member','POST',{version:0,review:sample()})).status,403);
 assert.equal((await call('admin','POST',{version:0,review:sample()})).status,200);
 assert.equal((await call('member')).data.review.rows.length,2);
 assert.equal((await call('admin','POST',{version:0,review:sample()})).status,409);
 assert.equal((await call('admin','POST',{version:1,review:sample()})).status,200);
 assert.equal((await call('admin')).data.version,2);
 assert.deepEqual(db.prepare('SELECT * FROM kups_groups').all(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM kups_transactions').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM kups_documents').get().n,0);
 assert.equal(db.prepare('SELECT count(*) n FROM kups_reconciliations').get().n,0);
 db.exec("UPDATE kups_members SET disabled=1 WHERE email='member@gmail.com'");
 assert.equal((await call('member')).status,403);
 assert.equal((await call('stranger')).status,401);
});
