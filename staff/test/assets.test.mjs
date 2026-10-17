import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {assetInput,assetManager} from '../src/assets.mjs';
const origin='https://staff.yayasangambut.org';
async function setup(){
 const db=new DatabaseSync(':memory:');for(const file of ['0001_initial.sql','0005_webgis_sso.sql','0012_asset_inventory.sql','0013_inventory_ownership.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}};},async batch(stmts){db.exec('BEGIN');try{const result=[];for(const statement of stmts)result.push(await statement.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const files=new Map(),env={APP_ORIGIN:origin,GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',ADMIN_EMAIL:'mulyadi@yayasangambut.org',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',DB,ASSETS:{fetch:()=>new Response('asset')},MEDIA:{async put(key,bytes){files.set(key,bytes);},async get(key){const bytes=files.get(key);return bytes?{body:bytes}:null;},async delete(key){files.delete(key);}}};
 for(const [id,role,email] of [['director','admin',env.ADMIN_EMAIL],['writer','staff','writer@yayasangambut.org'],['raja','staff','rajaalpian@yayasangambut.org'],['other','staff','other@yayasangambut.org'],['editor','editor','editor@yayasangambut.org'],['admin2','admin','admin2@yayasangambut.org'],['external','staff','external@gmail.com']]){await DB.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').bind(id,email,id,role,'2026-10-14','2026-10-14').run();await DB.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(await sha(id),id,Date.now()+60000).run();}
 return {env,db};
}
const req=(path,user='writer',method='GET',body)=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const sample={name:'Laptop uji',category:'Komputer dan tablet',purchase_price:10000000,condition:'Perlu verifikasi'};
async function create(env,user='director',body=sample){const r=await worker.fetch(req('/api/assets',user,'POST',body),env);assert.equal(r.status,201,await r.clone().text());return r.json();}
test('only Mulyadi and Raja manage assets; anonymous, external and cross-origin denied',async()=>{
 const {env}=await setup();for(const user of ['director','raja'])await create(env,user);
 for(const user of ['writer','other','admin2','editor'])assert.equal((await worker.fetch(req('/api/assets',user,'POST',sample),env)).status,403);
 assert.equal((await worker.fetch(new Request(origin+'/api/assets'),env)).status,401);
 assert.equal((await worker.fetch(req('/api/assets','external'),env)).status,403);
 const cross=req('/api/assets','director','POST',sample);cross.headers.set('Origin','https://evil.org');assert.equal((await worker.fetch(cross,env)).status,403);
 assert.equal(assetManager({email:'rajaalpian@yayasangambut.org',disabled:1}),false);
});
test('prices hidden from staff; version conflicts protect simultaneous editing',async()=>{
 const {env}=await setup(),a=await create(env);assert.equal(a.code,'YG-AST-0001');
 const list=await (await worker.fetch(req('/api/assets','writer'),env)).json();assert.equal('purchase_price' in list.assets[0],false);
 const detail=await (await worker.fetch(req('/api/assets/'+a.id,'writer'),env)).json();assert.equal('purchase_price' in detail,false);
 const updated=await worker.fetch(req('/api/assets/'+a.id,'raja','PUT',{...a,archived:false,condition:'Baik',location:'Pekanbaru'}),env);assert.equal(updated.status,200);assert.equal((await updated.json()).version,2);
 assert.equal((await worker.fetch(req('/api/assets/'+a.id,'director','PUT',a),env)).status,409);
 assert.equal((await worker.fetch(req('/api/assets/'+a.id,'writer','PUT',a),env)).status,403);
});
test('initial import safely repeats without duplicate assets',async()=>{
 const {env}=await setup(),body={assets:[{...sample,source_key:'yg-2024-1-1'},{...sample,name:'Unit 2',source_key:'yg-2024-1-2'}]};
 let r=await worker.fetch(req('/api/assets/import','raja','POST',body),env);assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).imported,2);
 r=await worker.fetch(req('/api/assets/import','director','POST',body),env);assert.equal((await r.json()).imported,0);
 assert.equal((await worker.fetch(req('/api/assets/import','writer','POST',body),env)).status,403);
 assert.equal((await worker.fetch(req('/api/assets/import','director','POST',{assets:[{...sample,source_key:'yg-2024-2-1'},{...sample,source_key:'bad/key'}]}),env)).status,400);
 const list=await (await worker.fetch(req('/api/assets','director'),env)).json();assert.equal(list.assets.length,2);
});
test('photo access requires staff login; archived assets retain photos and can be restored',async()=>{
 const {env}=await setup(),a=await create(env),path='/api/assets/'+a.id;
 const bytes=new Uint8Array([0xff,0xd8,0xff,0xe0,0,1,2,3]);
 const upload=user=>new Request(origin+path+'/photos',{method:'POST',headers:{Origin:origin,Cookie:'__Host-yg-session='+user},body:bytes});
 assert.equal((await worker.fetch(upload('writer'),env)).status,403);
 const r=await worker.fetch(upload('raja'),env);assert.equal(r.status,201,await r.clone().text());const photo=(await r.json()).photos[0];
 assert.equal((await worker.fetch(new Request(origin+photo.url),env)).status,401);
 const read=await worker.fetch(req(photo.url,'writer'),env);assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);
 assert.equal((await worker.fetch(req(path,'director','PUT',{...a,archived:true}),env)).status,200);
 assert.equal((await worker.fetch(upload('raja'),env)).status,409);
 const hidden=await (await worker.fetch(req('/api/assets','director'),env)).json();assert.equal(hidden.assets.length,0);
 const archived=await (await worker.fetch(req('/api/assets?archive=1','director'),env)).json();assert.equal(archived.assets.length,1);
 const current=await (await worker.fetch(req(path,'director'),env)).json();assert.equal((await worker.fetch(req(path,'raja','PUT',{...current,archived:false}),env)).status,200);
});
test('invalid inputs rejected; blank price remains missing rather than zero',()=>{
 for(const data of [{name:''},{acquired_date:'2024-02-30'},{purchase_price:-1},{purchase_price:'NaN'},{condition:'Unknown'}])assert.throws(()=>assetInput({...sample,...data}));
 assert.equal(assetInput({...sample,purchase_price:''}).purchase_price,null);
});
test('personal ownership and year-only acquisition survive save and remain separate from YG assets',async()=>{
 const {env}=await setup();const a=await create(env,'director',{...sample,ownership:'personal',owner_name:'Mulyadi',funding_source:'Dana pribadi Mulyadi',acquired_year:2025,acquired_date:''});
 assert.equal(a.ownership,'personal');assert.equal(a.owner_name,'Mulyadi');assert.equal(a.acquired_year,2025);assert.equal(a.acquired_date,'');
 const viewer=await (await worker.fetch(req('/api/assets/'+a.id,'writer'),env)).json();assert.equal(viewer.ownership,'personal');assert.equal('purchase_price' in viewer,false);
 for(const extra of [{ownership:'other'},{ownership:'personal',owner_name:''},{acquired_year:2025,acquired_date:'2026-10-02'},{acquired_year:2025.5}])assert.throws(()=>assetInput({...sample,...extra}));
});
test('purchase evidence is private to managers and never used as staff thumbnails',async()=>{
 const {env}=await setup(),a=await create(env),path='/api/assets/'+a.id;
 const r=await worker.fetch(new Request(origin+path+'/photos?kind=receipt',{method:'POST',headers:{Origin:origin,Cookie:'__Host-yg-session=director'},body:new Uint8Array([0xff,0xd8,0xff,0xe0,0,1,2])}),env);
 assert.equal(r.status,201,await r.clone().text());const photo=(await r.json()).photos[0];assert.equal(photo.kind,'receipt');
 assert.equal((await worker.fetch(req(photo.url,'writer'),env)).status,403);assert.equal((await worker.fetch(req(photo.url,'raja'),env)).status,200);
 const staff=await (await worker.fetch(req(path,'writer'),env)).json();assert.equal(staff.photos.length,0);
 const list=await (await worker.fetch(req('/api/assets','writer'),env)).json();assert.equal(list.assets[0].photo_id,null);
});
test('photo deletion is manager-only, asset-scoped, audited and removes private media',async()=>{
 const {env}=await setup(),a=await create(env),b=await create(env),path='/api/assets/'+a.id;
 for(const [kind,user] of [['photo','raja'],['receipt','director']]){
  const uploaded=await worker.fetch(new Request(origin+path+'/photos?kind='+kind,{method:'POST',headers:{Origin:origin,Cookie:'__Host-yg-session=director'},body:new Uint8Array([0xff,0xd8,0xff,0xe0,0,1,2,3])}),env);
  assert.equal(uploaded.status,201);const photo=(await uploaded.json()).photos[0];
  assert.equal((await worker.fetch(req(photo.url,'writer','DELETE'),env)).status,403);
  const cross=req(photo.url,'director','DELETE');cross.headers.set('Origin','https://evil.org');assert.equal((await worker.fetch(cross,env)).status,403);
  assert.equal((await worker.fetch(req('/api/assets/'+b.id+'/photos/'+photo.id,'director','DELETE'),env)).status,404);
  const removed=await worker.fetch(req(photo.url,user,'DELETE'),env);assert.equal(removed.status,200);
  const detail=await removed.json();assert.equal(detail.photos.length,0);assert.ok(detail.history.some(h=>h.action===(kind==='photo'?'Foto aset dihapus':'Bukti pembelian dihapus')));
  assert.equal(await env.MEDIA.get('inventory/'+a.id+'/'+photo.id),null);
  assert.equal((await worker.fetch(req(photo.url,'director'),env)).status,404);
  assert.equal((await worker.fetch(req(photo.url,'director','DELETE'),env)).status,404);
  assert.equal((await worker.fetch(req(path,'writer'),env)).status,200);
 }
});
