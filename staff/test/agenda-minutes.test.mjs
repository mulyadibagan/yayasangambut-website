import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {agendaInput} from '../src/agendas.mjs';
const origin='https://staff.yayasangambut.org';
async function setup(){const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};const env={APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',ADMIN_EMAIL:'mulyadi@yayasangambut.org',DB};for(const [id,role,email,name] of [['director','admin',env.ADMIN_EMAIL,'Mulyadi'],['rasid','staff','rasid@yayasangambut.org','Rasid Jul Siregar'],['writer','staff','writer@yayasangambut.org','Writer'],['other','editor','other@yayasangambut.org','Other']]){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(id,email,name,role,'2026-10-14','2026-10-14');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(id),id,Date.now()+60000);}db.exec(readFileSync(new URL('../migrations/0011_team_agendas.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0015_agenda_custom_kind.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0016_agenda_trash.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0018_agenda_files.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0020_agenda_drive.sql',import.meta.url),'utf8'));const objects=new Map();env.MEDIA={async put(key,bytes){objects.set(key,bytes);},async get(key){return objects.has(key)?{body:objects.get(key)}:null;},async delete(key){objects.delete(key);}};db.exec(readFileSync(new URL('../migrations/0025_agenda_minutes.sql',import.meta.url),'utf8'));DB.batch=async statements=>{db.exec('BEGIN');try{const r=[];for(const st of statements)r.push(await st.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};return {env,db,objects};}
const request=(path,user='writer',method='GET',body)=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const sample={title:'Undangan pelatihan',kind:'event',start_at:'2026-10-20T08:00',end_at:'2026-10-20T16:00',participant_ids:['writer','rasid'],participants:'Writer, Rasid',status:'scheduled'};

test('MoM preserves structured long text, sanitizes HTML and keeps private revision history',async()=>{
 const {env}=await setup();const a=await(await worker.fetch(request('/api/agendas','writer','POST',sample),env)).json();const path='/api/agenda-minutes/'+a.id;
 assert.equal((await worker.fetch(request(path,'other'),env)).status,403);
 const content='<h2>Pembahasan</h2><p>'+('Notulen panjang. '.repeat(1500))+'</p><script>alert(1)</script><img src="https://evil.test/x"><a href="javascript:alert(1)">x</a>';
 let r=await worker.fetch(request(path,'rasid','PUT',{body:content,status:'draft',version:0}),env);assert.equal(r.status,200,await r.clone().text());const m=(await r.json()).minutes;
 assert.ok(m.body.includes('<h2>Pembahasan</h2>'));assert.ok(m.body.length>10000);assert.ok(!m.body.includes('<script'));assert.ok(!m.body.includes('<img'));assert.ok(!m.body.includes('javascript:'));
 assert.equal((await worker.fetch(request(path,'writer','PUT',{body:'<p>stale</p>',status:'draft',version:0}),env)).status,409);
 r=await worker.fetch(request(path,'rasid','PUT',{body:'<p>Final</p>',status:'final',version:1}),env);assert.equal(r.status,200);
 const read=await(await worker.fetch(request(path,'writer'),env)).json();assert.equal(read.history.length,2);assert.ok(read.history[1].body.includes('Notulen panjang'));
 assert.equal((await worker.fetch(request(path,'writer','PUT',{body:'<p>Revisi pembuat</p>',status:'draft',version:2}),env)).status,200);
 const list=await(await worker.fetch(request('/api/agenda-minutes','writer'),env)).json();assert.equal(list.minutes.length,1);
 assert.equal((await(await worker.fetch(request('/api/agenda-minutes','other'),env)).json()).minutes.length,0);
 const cross=request(path,'writer','PUT',{body:'x',status:'draft',version:3});cross.headers.set('Origin','https://evil.test');assert.equal((await worker.fetch(cross,env)).status,403);
 await worker.fetch(request('/api/agendas/'+a.id,'writer','DELETE',{version:a.version}),env);
 assert.equal((await worker.fetch(request(path,'writer','PUT',{body:'x',status:'draft',version:3}),env)).status,409);
 assert.equal((await worker.fetch(new Request(origin+path),env)).status,401);
});
