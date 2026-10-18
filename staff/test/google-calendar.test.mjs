import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {calendarEvent,sealToken,openToken,calendarConnect,calendarCallback,calendarApi,syncCalendar,syncCalendars,calendarScope} from '../src/google-calendar.mjs';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
const origin='https://staff.yayasangambut.org';
async function setup(){
 const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0010_team_tasks.sql','0011_team_agendas.sql','0015_agenda_custom_kind.sql','0016_agenda_trash.sql','0017_google_calendar.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};},async batch(stmts){db.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const env={DB,APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',ADMIN_EMAIL:'a@yayasangambut.org'};
 const users=[{id:'a',email:'a@yayasangambut.org',name:'A'},{id:'b',email:'b@yayasangambut.org',name:'B'}];
 for(const u of users){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(u.id,u.email,u.name,'staff','2026','2026');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(u.id),u.id,Date.now()+600000);}
 return {env,db,users};
}
async function connect(env,u,calendar='calendar-'+u.id){await env.DB.prepare('INSERT INTO calendar_connections(user_id,email,refresh_token,calendar_id,generation,created_at) VALUES(?,?,?,?,?,?)').bind(u.id,u.email,await sealToken(env,u.id,'refresh-'+u.id),calendar,'generation','2026').run();}
function seed(db){
 db.prepare("INSERT INTO team_agendas(id,creator,title,kind,start_at,end_at,participant_ids,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run('meeting-a','b','Rapat A','meeting','2026-10-20T08:00','2026-10-21T17:00','["a"]','2026','2026');
 db.prepare("INSERT INTO team_tasks(id,creator,assigned_by,title,assignees,due_date,mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run('task-b','a','a','Tugas B','["b"]','2026-10-31','m','2026','2026');
}
async function mocked(fn){const original=globalThis.fetch,calls=[],events=new Map();globalThis.fetch=async(url,opts={})=>{
 const method=opts.method||'GET',body=opts.body?JSON.parse(typeof opts.body==='string'?opts.body:'{}'):null;calls.push({url:String(url),method,body});
 if(String(url).includes('oauth2.googleapis.com/token'))return Response.json({access_token:'access'});
 if(String(url).endsWith('/calendars')&&method==='POST')return Response.json({id:'new-calendar'});
 const id=method==='POST'?body?.id:String(url).split('/').at(-1);
 if(method==='POST'){if(events.has(id))return Response.json({}, {status:409});events.set(id,body);return Response.json(body);}
 if(method==='PUT'){events.set(id,body);return Response.json(body);}
 if(method==='DELETE'){events.delete(id);return new Response(null,{status:204});}
 throw new Error('unexpected fetch');
 };try{await fn({calls,events});}finally{globalThis.fetch=original;}}
test('event payload uses WIB timed agendas and exclusive all-day task end dates',()=>{
 const a=calendarEvent('agenda',{id:'1',title:'Kegiatan',start_at:'2026-10-17T08:00',end_at:'2026-10-18T17:00'},origin);assert.equal(a.start.dateTime,'2026-10-17T08:00:00+07:00');assert.equal(a.end.timeZone,'Asia/Jakarta');assert.equal(a.visibility,'private');assert.equal('attendees' in a,false);
 const t=calendarEvent('task',{id:'2',title:'Proposal',due_date:'2026-12-31',status:'done'},origin);assert.equal(t.end.date,'2027-01-01');assert.match(t.description,/Selesai/);
});
test('refresh tokens are encrypted and bound to owner and application secret',async()=>{
 const {env}=await setup();const cipher=await sealToken(env,'a','sensitive-token');assert.equal(cipher.includes('sensitive-token'),false);assert.equal(await openToken(env,'a',cipher),'sensitive-token');await assert.rejects(openToken(env,'b',cipher));await assert.rejects(openToken({...env,GOOGLE_CLIENT_SECRET:'different'},'a',cipher));
});
test('connect uses existing callback, PKCE, offline access and only app-created calendar scope',async()=>{
 const {env,users}=await setup();const r=await calendarConnect(env,users[0]),data=await r.json(),url=new URL(data.url);assert.equal(url.searchParams.get('redirect_uri'),origin+'/auth/callback');assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('scope'),'openid email '+calendarScope);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
});
test('calendar routes require staff login and same-origin mutations; status never exposes tokens',async()=>{
 const {env,users}=await setup();await connect(env,users[0]);assert.equal((await worker.fetch(new Request(origin+'/api/calendar'),env)).status,401);
 const request=(method='GET',path='/api/calendar',user='a')=>new Request(origin+path,{method,headers:{Cookie:'__Host-yg-session='+user,Origin:origin}});
 const r=await worker.fetch(request(),env);assert.equal(r.status,200);assert.equal((await r.text()).includes('refresh_token'),false);
 const other=await (await worker.fetch(request('GET','/api/calendar','b'),env)).json();assert.equal(other.connected,false);
 const cross=request('POST','/api/calendar/connect');cross.headers.set('Origin','https://other.org');assert.equal((await worker.fetch(cross,env)).status,403);
});
test('OAuth rejects wrong account and consumes state so callback cannot replay',async()=>{
 const {env,db,users}=await setup();const started=await calendarConnect(env,users[0]),data=await started.json(),auth=new URL(data.url),state=auth.searchParams.get('state');const url=new URL(origin+'/auth/callback?state='+state+'&code=x'),req=new Request(url,{headers:{Cookie:'__Host-yg-calendar='+state}});
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({id_token:'jwt',refresh_token:'refresh',scope:calendarScope});try{
 await assert.rejects(calendarCallback(req,env,url,users[0],async()=>({sub:'b',email:users[1].email,email_verified:true,hd:env.GOOGLE_WORKSPACE_DOMAIN,nonce:auth.searchParams.get('nonce')})),/Pilih akun/);
 await assert.rejects(calendarCallback(req,env,url,users[0],async()=>({})),/kedaluwarsa/);assert.equal(db.prepare('SELECT COUNT(*) n FROM calendar_connections').get().n,0);
 }finally{globalThis.fetch=old;}
});
test('OAuth binds same account, stores encrypted grant and preserves dedicated calendar on reconnect',async()=>{
 const {env,db,users}=await setup();const started=await calendarConnect(env,users[0]),auth=new URL((await started.json()).url),state=auth.searchParams.get('state'),url=new URL(origin+'/auth/callback?state='+state+'&code=x');const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({id_token:'jwt',refresh_token:'new-refresh',scope:calendarScope});try{
 const response=await calendarCallback(new Request(url,{headers:{Cookie:'__Host-yg-calendar='+state}}),env,url,users[0],async()=>({sub:'a',email:users[0].email,email_verified:true,hd:env.GOOGLE_WORKSPACE_DOMAIN,nonce:auth.searchParams.get('nonce')}));assert.equal(response.status,302);assert.match(response.headers.get('location'),/calendar=connected/);const c=db.prepare('SELECT * FROM calendar_connections').get();assert.notEqual(c.refresh_token,'new-refresh');assert.equal(await openToken(env,'a',c.refresh_token),'new-refresh');
 }finally{globalThis.fetch=original;}
});
test('only participant agendas and assigned tasks sync, repeat sync does not duplicate',async()=>{
 const {env,db,users}=await setup();seed(db);for(const u of users)await connect(env,u);
 await mocked(async({calls,events})=>{await syncCalendar(env,'a');await syncCalendar(env,'b');const posts=calls.filter(c=>c.method==='POST'&&c.body?.id);assert.equal(posts.length,2);assert.equal(posts[0].body.summary,'Rapat A');assert.equal(posts[1].body.summary,'Tenggat: Tugas B');await syncCalendar(env,'a');assert.equal(calls.filter(c=>c.body?.id).length,2);assert.equal(events.size,2);});
});
test('rescheduling updates same event; delete/cancel/reassignment/archive remove copies; restoration recreates',async()=>{
 const {env,db,users}=await setup();seed(db);await connect(env,users[0]);await connect(env,users[1]);
 await mocked(async({calls})=>{await syncCalendar(env,'a');const first=calls.find(c=>c.body?.id).body.id;db.prepare("UPDATE team_agendas SET start_at='2026-10-20T10:00'").run();await syncCalendar(env,'a');assert.ok(calls.some(c=>c.method==='PUT'&&c.url.endsWith(first)));
 db.prepare('UPDATE team_agendas SET deleted=1').run();await syncCalendar(env,'a');assert.ok(calls.some(c=>c.method==='DELETE'&&c.url.endsWith(first)));db.prepare('UPDATE team_agendas SET deleted=0').run();await syncCalendar(env,'a');assert.equal(calls.filter(c=>c.body?.id).length,2);
 db.prepare("UPDATE team_agendas SET participant_ids='[\"b\"]'").run();await syncCalendar(env,'a');assert.equal(db.prepare("SELECT count(*) n FROM calendar_events WHERE user_id='a'").get().n,0);
 await syncCalendar(env,'b');db.prepare("UPDATE team_agendas SET status='cancelled'").run();db.prepare('UPDATE team_tasks SET archived=1').run();await syncCalendar(env,'b');assert.equal(db.prepare('SELECT count(*) n FROM calendar_events').get().n,0);
 });
});
test('retry after lost insertion response uses persisted event id, not duplicate event',async()=>{
 const {env,db,users}=await setup();seed(db);await connect(env,users[0]);await mocked(async({calls,events})=>{const fake=globalThis.fetch;let once=true;globalThis.fetch=async(...args)=>{const response=await fake(...args);if(once&&args[1]?.method==='POST'&&String(args[0]).includes('/events')){once=false;throw new Error('connection interrupted');}return response;};await syncCalendar(env,'a');await syncCalendar(env,'a');assert.equal(events.size,1);const ids=calls.filter(c=>c.body?.id).map(c=>c.body.id);assert.equal(new Set(ids).size,1);assert.ok(db.prepare('SELECT content_hash FROM calendar_events').get().content_hash);});
});
test('disabled and KUPS-only users never sync; expired grants request reconnect without leaking tokens',async()=>{
 const {env,db,users}=await setup();await connect(env,users[0]);db.prepare("UPDATE users SET disabled=1 WHERE id='a'").run();await mocked(async({calls})=>{await syncCalendar(env,'a');assert.equal(calls.length,0);});db.prepare("UPDATE users SET disabled=0 WHERE id='a'").run();db.prepare("INSERT INTO webgis_access VALUES(?,'kups-finance',0)").run(users[0].email);await mocked(async({calls})=>{await syncCalendar(env,'a');assert.equal(calls.length,0);});db.prepare('DELETE FROM webgis_access').run();
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'invalid_grant'},{status:400});try{await syncCalendar(env,'a');const c=db.prepare('SELECT * FROM calendar_connections').get();assert.equal(c.status,'reconnect');assert.equal(c.error.includes('refresh-a'),false);}finally{globalThis.fetch=old;}
});
test('lease prevents simultaneous sync and disconnect; disconnect removes grant but leaves Google calendar untouched',async()=>{
 const {env,db,users}=await setup();await connect(env,users[0]);db.prepare('UPDATE calendar_connections SET lease_until=?').run(Date.now()+100000);
 await mocked(async({calls})=>{assert.deepEqual(await syncCalendar(env,'a'),{busy:true});await assert.rejects(calendarApi(new Request(origin+'/api/calendar',{method:'DELETE'}),env,new URL(origin+'/api/calendar'),users[0]),/sedang berjalan/);assert.equal(calls.length,0);
 db.prepare('UPDATE calendar_connections SET lease_until=0').run();await calendarApi(new Request(origin+'/api/calendar',{method:'DELETE'}),env,new URL(origin+'/api/calendar'),users[0]);assert.equal(db.prepare('SELECT count(*) n FROM calendar_connections').get().n,0);assert.equal(calls.length,0);});
});
