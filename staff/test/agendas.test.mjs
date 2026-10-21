import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {agendaInput} from '../src/agendas.mjs';
const origin='https://staff.yayasangambut.org';
async function setup(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};const env={APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',ADMIN_EMAIL:'mulyadi@yayasangambut.org',DB};for(const [id,role,email,name] of [['director','admin',env.ADMIN_EMAIL,'Mulyadi'],['rasid','staff','rasid@yayasangambut.org','Rasid Jul Siregar'],['writer','staff','writer@yayasangambut.org','Writer'],['other','editor','other@yayasangambut.org','Other']]){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,email,name,role,'2026-10-14','2026-10-14');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(id),id,Date.now()+60000);}db.exec(readFileSync(new URL('../migrations/0011_team_agendas.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0015_agenda_custom_kind.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0016_agenda_trash.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0018_agenda_files.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0020_agenda_drive.sql',import.meta.url),'utf8'));const objects=new Map();env.MEDIA={async put(key,bytes){objects.set(key,bytes);},async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){objects.delete(key);}};return {env,db,objects};}
const request=(path,user='writer',method='GET',body)=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const sample={title:'Undangan pelatihan',kind:'event',start_at:'2026-10-20T08:00',end_at:'2026-10-20T16:00',participant_ids:['writer','rasid'],participants:'Writer, Rasid',status:'scheduled'};
test('Dayun agenda records three days, correct location, and registered Rasid participation',async()=>{const {env}=await setup();const r=await worker.fetch(request('/api/agendas/dayun-20261012-14','rasid'),env);assert.equal(r.status,200);const a=await r.json();assert.equal(a.program,'Agroforestri Dayun · APRIL');assert(a.description.includes('12 Oktober — Dayun:'));assert(a.description.includes('14 Oktober'));assert(a.participants.includes('Zamharir'));assert(a.participants.includes('Rafi Merbamas'));assert(!a.participants.includes('Ariel'));assert.equal((await worker.fetch(request('/api/agendas/dayun-20261012-14','other'),env)).status,403);});
test('staff create a shared agenda immediately without director approval',async()=>{const {env}=await setup();const r=await worker.fetch(request('/api/agendas','writer','POST',sample),env);assert.equal(r.status,201,await r.clone().text());const a=await r.json();assert.equal(a.status,'scheduled');assert.equal((await (await worker.fetch(request('/api/agendas','rasid'),env)).json()).agendas.length,2);assert.equal((await (await worker.fetch(request('/api/agendas?scope=all','director'),env)).json()).agendas.length,2);assert.equal((await (await worker.fetch(request('/api/agendas?scope=all','other'),env)).json()).agendas.length,0);});
test('participants update results and status but cannot overwrite schedule; stale changes are rejected',async()=>{const {env}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json();assert.equal((await worker.fetch(request('/api/agendas/'+a.id,'rasid','PUT',{version:1,location:'Elsewhere'}),env)).status,403);assert.equal((await worker.fetch(request('/api/agendas/'+a.id,'rasid','PUT',{version:1,status:'done',results:'Pelatihan selesai.'}),env)).status,200);assert.equal((await worker.fetch(request('/api/agendas/'+a.id,'writer','PUT',{version:1,status:'cancelled'}),env)).status,409);});
test('agenda API requires login and rejects cross-origin requests and invalid dates',async()=>{const {env}=await setup();assert.equal((await worker.fetch(new Request(origin+'/api/agendas'),env)).status,401);const r=request('/api/agendas','writer','POST',sample);r.headers.set('Origin','https://evil.org');assert.equal((await worker.fetch(r,env)).status,403);for(const input of [{start_at:'2026-02-30T08:00'},{end_at:'2026-10-19T16:00'},{status:'approved'}])assert.throws(()=>agendaInput({...sample,...input}));});
test('director can create and update team agendas without being a participant',async()=>{
 const {env}=await setup();
 const created=await worker.fetch(request('/api/agendas','director','POST',{...sample,participant_ids:['rasid'],participants:'',coordinator:'Rasid'}),env);
 assert.equal(created.status,201);const a=await created.json();assert.equal(a.creator,'director');assert.deepEqual(JSON.parse(a.participant_ids),['rasid']);
 const withDirector=await worker.fetch(request('/api/agendas/'+a.id,'director','PUT',{version:a.version,participant_ids:['director','rasid']}),env);
 assert.equal(withDirector.status,200);const b=await withDirector.json();
 const removed=await worker.fetch(request('/api/agendas/'+a.id,'director','PUT',{version:b.version,participant_ids:['rasid']}),env);
 assert.equal(removed.status,200);assert.deepEqual(JSON.parse((await removed.json()).participant_ids),['rasid']);
 assert.equal((await worker.fetch(request('/api/agendas/'+a.id,'rasid'),env)).status,200);
 assert.equal((await worker.fetch(request('/api/agendas/'+a.id,'other'),env)).status,403);
});
test('staff creator remains a participant when creating and editing their own agenda',async()=>{
 const {env}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',{...sample,participant_ids:['rasid']}),env)).json();
 assert.deepEqual(JSON.parse(a.participant_ids),['writer','rasid']);
 const r=await worker.fetch(request('/api/agendas/'+a.id,'writer','PUT',{version:a.version,participant_ids:['rasid']}),env);
 assert.equal(r.status,200);assert.deepEqual(JSON.parse((await r.json()).participant_ids),['writer','rasid']);
});

test('custom activity type persists on creation, editing and participant status updates',async()=>{
 const {env}=await setup();const r=await worker.fetch(request('/api/agendas','writer','POST',{...sample,kind:'other',kind_custom:'Pelatihan pascapanen kopi Liberika'}),env);assert.equal(r.status,201,await r.clone().text());const a=await r.json();assert.equal(a.kind_custom,'Pelatihan pascapanen kopi Liberika');
 const updated=await worker.fetch(request('/api/agendas/'+a.id,'rasid','PUT',{version:a.version,status:'done'}),env);assert.equal(updated.status,200);assert.equal((await updated.json()).kind_custom,a.kind_custom);
 assert.throws(()=>agendaInput({...sample,kind_custom:'x'.repeat(121)}));
});

test('only creator or director can soft-delete and restore; trash is separate and versions protect updates',async()=>{
 const {env}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json(),path='/api/agendas/'+a.id;
 assert.equal((await worker.fetch(request(path,'rasid','DELETE',{version:a.version}),env)).status,403);
 const removed=await worker.fetch(request(path,'writer','DELETE',{version:a.version}),env);assert.equal(removed.status,200);const deleted=await removed.json();assert.equal(deleted.deleted,1);
 assert.equal((await (await worker.fetch(request('/api/agendas','writer'),env)).json()).agendas.some(x=>x.id===a.id),false);
 assert.equal((await (await worker.fetch(request('/api/agendas?trash=1','writer'),env)).json()).agendas.some(x=>x.id===a.id),true);
 assert.equal((await worker.fetch(request(path,'writer','PUT',{version:deleted.version,status:'done'}),env)).status,409);
 assert.equal((await worker.fetch(request(path+'/restore','rasid','POST',{version:deleted.version}),env)).status,403);
 assert.equal((await worker.fetch(request(path+'/restore','director','POST',{version:a.version}),env)).status,409);
 const restored=await worker.fetch(request(path+'/restore','director','POST',{version:deleted.version}),env);assert.equal(restored.status,200);assert.equal((await restored.json()).deleted,0);
});

const uploadRequest=(path,user='writer',body='%PDF-1.7\nInvitation',filename='Undangan.pdf')=>new Request(origin+path,{method:'POST',headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/pdf','X-Filename':encodeURIComponent(filename)},body});
test('agenda files are private, scoped to their event, and managed only by creator or director',async()=>{
 const {env,objects}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json(),path='/api/agendas/'+a.id+'/files';
 assert.equal((await worker.fetch(uploadRequest(path,'rasid'),env)).status,403);
 assert.equal((await worker.fetch(uploadRequest(path,'other'),env)).status,403);
 const uploaded=await worker.fetch(uploadRequest(path),env);assert.equal(uploaded.status,201,await uploaded.clone().text());const f=await uploaded.json();
 assert.equal(objects.size,1);assert.equal((await (await worker.fetch(request(path,'rasid'),env)).json()).files[0].filename,'Undangan.pdf');
 const file=await worker.fetch(request(path+'/'+f.id,'rasid'),env);assert.equal(file.status,200);assert.match(file.headers.get('Cache-Control'),/no-store/);assert.equal(file.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(await file.text(),'%PDF-1.7\nInvitation');
 assert.equal((await worker.fetch(new Request(origin+path+'/'+f.id),env)).status,401);
 assert.equal((await worker.fetch(request(path+'/'+f.id,'other'),env)).status,403);
 const b=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json();assert.equal((await worker.fetch(request('/api/agendas/'+b.id+'/files/'+f.id),env)).status,404);
 assert.equal((await worker.fetch(request(path+'/'+f.id,'rasid','DELETE',{}),env)).status,403);
 assert.equal((await worker.fetch(request(path+'/'+f.id,'director','DELETE',{}),env)).status,200);assert.equal(objects.size,0);assert.equal((await worker.fetch(request(path+'/'+f.id),env)).status,404);
});
test('agenda uploads reject invalid, oversized, and cross-origin files; trash retains attachments',async()=>{
 const {env,objects}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json(),base='/api/agendas/'+a.id,path=base+'/files';
 for(const content of [''])assert.equal((await worker.fetch(uploadRequest(path,'writer',content),env)).status,400);
 assert.equal((await worker.fetch(uploadRequest(path,'writer','%PDF-'+ 'x'.repeat(5*1024*1024)),env)).status,413);
 const cross=uploadRequest(path);cross.headers.set('Origin','https://evil.org');assert.equal((await worker.fetch(cross,env)).status,403);assert.equal(objects.size,0);
 const f=await (await worker.fetch(uploadRequest(path,'director'),env)).json();await worker.fetch(request(base,'writer','DELETE',{version:a.version}),env);
 assert.equal((await worker.fetch(uploadRequest(path),env)).status,409);assert.equal((await worker.fetch(request(path+'/'+f.id,'writer','DELETE',{}),env)).status,409);
 assert.equal((await worker.fetch(request(path+'/'+f.id,'rasid'),env)).status,200);await worker.fetch(request(base+'/restore','writer','POST',{version:a.version+1}),env);assert.equal((await (await worker.fetch(request(path),env)).json()).files.length,1);
});
test('failed agenda attachment metadata insert removes the uploaded object',async()=>{
 const {env,objects}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json();const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{const stmt=prepare(sql);if(sql.startsWith('INSERT INTO agenda_files'))stmt.run=async()=>{throw Error('simulated database failure');};return stmt;};
 assert.equal((await worker.fetch(uploadRequest('/api/agendas/'+a.id+'/files'),env)).status,500);assert.equal(objects.size,0);
});

test('agenda accepts document and other formats as private downloads',async()=>{
 const {env}=await setup();const a=await (await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json();const path='/api/agendas/'+a.id+'/files';
 for(const [name,type] of [['TOR.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],['Budget.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],['Slides.pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation'],['Data.csv','text/csv'],['Arsip.zip','application/zip'],['Other.custom','application/octet-stream'],['Page.html','application/octet-stream']]){
 const content=name.endsWith('.html')?'<script>alert(1)</script>':'sample bytes';
 const upload=await worker.fetch(uploadRequest(path,'writer',content,name),env);assert.equal(upload.status,201);const {id}=await upload.json();
 const download=await worker.fetch(request(path+'/'+id,'rasid'),env);assert.equal(download.headers.get('Content-Type'),type);assert.match(download.headers.get('Content-Disposition'),/^attachment;/);assert.equal(download.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(await download.text(),content);
 assert.equal((await worker.fetch(request(path+'/'+id,'other'),env)).status,403);
 }
});
