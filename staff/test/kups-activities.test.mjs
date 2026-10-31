import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {activitiesRoute,validateActivity,publicActivities} from '../src/kups-activities.mjs';
function fixture(access='admin',email='admin@yayasangambut.org'){
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE kups_groups(id TEXT PRIMARY KEY);INSERT INTO kups_groups VALUES('dayun-rimba-sejahtera');");db.exec(readFileSync(new URL('../migrations/0036_kups_activities.sql',import.meta.url),'utf8'));
 function q(env,sql,...args){return {first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})};}
 const env={DB:{batch:async statements=>{db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 const u={email,name:'Pengguna',scope:access==='admin'?'webgis-staff':'kups-finance'};
 return {db,publicCall:(method='GET',group='dayun-rimba-sejahtera',path='/api/kups/activities')=>publicActivities({method},env,new URL('https://staff.yayasangambut.org'+path+'?'+new URLSearchParams({group})),{q,json:(data,status=200)=>({data,status})}),call:(path='/activities',method='GET',body={})=>activitiesRoute({},env,new URL('https://staff.yayasangambut.org'),{path,method,q,g:'dayun-rimba-sejahtera',u,access,json:(data,status=200)=>({data,status}),body:async()=>body})};
}
test('seed separates planned Saturday participants from unconfirmed harvest attendance',async()=>{const f=fixture(),data=(await f.call()).data;assert.equal(data.events.length,2);const harvest=data.events.find(e=>e.id==='dayun-panen-20261027'),future=data.events.find(e=>e.id==='dayun-sensus-20261031');assert.equal(harvest.participants.length,0);assert.equal(future.participants.length,0);assert.match(future.notes,/11 peserta/);assert.equal(future.time,'07:00');});
test('validate rejects invalid dates, duplicate participants, and attendance before activity',()=>{const base={title:'Uji',date:'2026-10-27',kind:'Panen',participants:[{id:'p1',name:'Siti',email:'',status:'planned'}]};assert.equal(validateActivity(base).participants.length,1);assert.throws(()=>validateActivity({...base,date:'2026-02-30'}));assert.throws(()=>validateActivity({...base,date:'not-a-date'}));assert.throws(()=>validateActivity({...base,participants:[...base.participants,{...base.participants[0],id:'p2'}]}));assert.throws(()=>validateActivity({...base,date:'2099-01-01',participants:[{...base.participants[0],status:'present'}]}));});
test('save persists attendance and audit; stale changes cannot overwrite or append audit',async()=>{const f=fixture(),event=(await f.call()).data.events.find(e=>e.kind==='Panen');event.participants=[{id:'p1',name:'Siti',email:'siti@example.org',status:'present',note:''}];await f.call('/activities/'+event.id,'PUT',event);const saved=(await f.call()).data.events.find(e=>e.id===event.id);assert.equal(saved.participants[0].status,'present');assert.equal(saved.version,2);await assert.rejects(f.call('/activities/'+event.id,'PUT',event),/berubah/);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM kups_activity_audit').get().n,1);});
test('viewer cannot edit whole roster or create agendas, can update only own linked attendance',async()=>{const f=fixture('viewer','siti@example.org');let record=f.db.prepare("SELECT * FROM kups_activities WHERE id='dayun-panen-20261027'").get(),p=JSON.parse(record.payload);p.participants=[{id:'p1',name:'Siti',email:'siti@example.org',status:'planned',note:''},{id:'p2',name:'Devi',email:'devi@example.org',status:'present',note:''}];f.db.prepare('UPDATE kups_activities SET payload=? WHERE id=?').run(JSON.stringify(p),record.id);await assert.rejects(f.call('/activities/'+record.id,'PUT',{...p,version:1}));await assert.rejects(f.call('/activities','POST',{}));await f.call('/activities/'+record.id+'/self','PUT',{version:1,status:'present',note:'Ikut panen'});const row=(await f.call()).data.events.find(e=>e.id===record.id);assert.equal(row.participants[0].status,'present');assert.equal(row.participants[1].email,'');assert.equal(row.participants[1].status,'present');await assert.rejects(f.call('/activities/dayun-sensus-20261031/self','PUT',{version:1,status:'present'}));});
test('create retry reuses same activity and different replay is rejected',async()=>{const f=fixture();const p={id:'11111111-1111-4111-8111-111111111111',title:'Gotong royong',date:'2026-10-27',kind:'Gotong royong',participants:[]};assert.equal((await f.call('/activities','POST',p)).status,201);assert.equal((await f.call('/activities','POST',p)).status,200);await assert.rejects(f.call('/activities','POST',{...p,title:'Berbeda'}));assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM kups_activities').get().n,3);});

test('public Dayun agenda is read-only and strips participant emails and private notes',async()=>{
 const f=fixture(),row=f.db.prepare("SELECT * FROM kups_activities WHERE id='dayun-panen-20261027'").get(),payload=JSON.parse(row.payload);
 payload.participants=[{id:'p1',name:'Siti',email:'siti@example.org',status:'present',note:'Catatan pribadi'}];
 f.db.prepare('UPDATE kups_activities SET payload=? WHERE id=?').run(JSON.stringify(payload),row.id);
 const response=await f.publicCall();assert.equal(response.status,200);assert.equal(response.data.public,true);assert.equal(response.data.user,null);assert.equal(response.data.canManage,false);
 const event=response.data.events.find(e=>e.id===row.id);
 assert.deepEqual(event.participants,[{name:'Siti',status:'present'}]);
 assert.equal(event.title,payload.title);assert.equal(event.result,payload.result);
 assert(!JSON.stringify(response.data).includes('siti@example.org'));assert(!JSON.stringify(response.data).includes('Catatan pribadi'));
});
test('public route cannot expose other groups, financial routes, or accept writes',async()=>{
 const f=fixture(),before=f.db.prepare('SELECT COUNT(*) AS n FROM kups_activity_audit').get().n;
 for(const method of ['POST','PUT','DELETE'])assert.equal(await f.publicCall(method),null);
 assert.equal(await f.publicCall('GET','another-group'),null);
 assert.equal(await f.publicCall('GET','dayun-rimba-sejahtera','/api/kups/ledger'),null);
 assert.equal(await f.publicCall('GET','dayun-rimba-sejahtera','/api/kups/activities/dayun-panen-20261027/self'),null);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM kups_activity_audit').get().n,before);
});
