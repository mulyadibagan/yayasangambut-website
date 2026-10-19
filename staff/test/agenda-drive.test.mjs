import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import worker from '../src/worker.mjs';
import {sha} from '../src/core.mjs';
import {sealToken,openToken} from '../src/google-calendar.mjs';
import {driveConnect,driveCallback,drivePreviewUrl,driveScope,driveStatus} from '../src/agenda-drive.mjs';
const origin='https://staff.yayasangambut.org',root='0AGypgEKNvNjdUk9PVA',folder='archive-folder',pdf=new TextEncoder().encode('%PDF-1.7 invitation');
async function setup(){
 const db=new DatabaseSync(':memory:');for(const f of ['0001_initial.sql','0005_webgis_sso.sql','0011_team_agendas.sql','0015_agenda_custom_kind.sql','0016_agenda_trash.sql','0018_agenda_files.sql','0020_agenda_drive.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};}};}};
 const env={DB,APP_ORIGIN:origin,GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',ADMIN_EMAIL:'director@yayasangambut.org',AGENDA_DRIVE_ROOT_ID:root},objects=new Map();
 env.MEDIA={async put(k,b){objects.set(k,b);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(k){objects.delete(k);}};
 const users=[{id:'director',email:env.ADMIN_EMAIL,role:'admin'},{id:'writer',email:'writer@yayasangambut.org',role:'staff'},{id:'participant',email:'participant@yayasangambut.org',role:'staff'},{id:'other',email:'other@yayasangambut.org',role:'staff'}];
 for(const u of users){db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?,?)').run(u.id,u.email,u.id,u.role,'2026','2026');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(await sha(u.id),u.id,Date.now()+600000);}
 db.prepare('INSERT INTO team_agendas(id,creator,title,kind,start_at,end_at,participant_ids,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('event-1','writer','Existing event','event','2026-10-23T08:00','2026-10-25T17:00','["writer","participant"]','2026','2026');
 return {env,db,objects,users};
}
const request=(path,user='writer',method='GET',body)=>new Request(origin+path,{method,headers:{Origin:origin,Cookie:'__Host-yg-session='+user,'Content-Type':'application/pdf','X-Filename':'Undangan.pdf'},...(body?{body}:{})});
async function connected(env){await env.DB.prepare('INSERT INTO agenda_drive_connection VALUES(1,?,?,?,?,?,?,?)').bind('director',env.ADMIN_EMAIL,await sealToken(env,'agenda-drive:director','refresh'),root,folder,'connected','2026').run();}
async function googleMock(fn,{badHash=false,denyUpload=false,scope=driveScope,invalidGrant=false}={}){
 const previous=globalThis.fetch,calls=[];let serial=0;
 globalThis.fetch=async(url,opts={})=>{const u=new URL(url);calls.push({url:u.href,method:opts.method||'GET',body:opts.body});
  if(u.hostname==='oauth2.googleapis.com')return invalidGrant?Response.json({error:'invalid_grant'},{status:400}):Response.json({access_token:'access',refresh_token:'refresh',scope,id_token:'signed'});
  if(u.pathname.startsWith('/upload/')){if(denyUpload)return Response.json({error:{}},{status:403});const body=await opts.body.text();assert(body.includes('"parents":["'+folder+'"]'));assert(body.includes('"ygAgendaId":"event-1"'));return Response.json({id:'drive-'+(++serial),webViewLink:'https://drive.google.com/file/d/drive-'+serial+'/view',size:pdf.length,md5Checksum:badHash?'wrong':createHash('md5').update(pdf).digest('hex')});}
  if(opts.method==='PATCH')return Response.json({trashed:true});
  if(u.pathname.endsWith('/files')&&opts.method==='POST'){const body=JSON.parse(opts.body);assert.deepEqual(body.parents,[root]);assert.equal(body.name,'Lampiran Agenda YG');return Response.json({id:folder});}
  if(u.pathname.endsWith('/files'))return Response.json({files:[]});
  if(u.pathname.endsWith('/files/'+root))return Response.json({id:root,mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(u.pathname.endsWith('/files/'+folder))return Response.json({id:folder,parents:[root],mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  throw Error('Unexpected Google request '+u.href);
 };try{await fn(calls);}finally{globalThis.fetch=previous;}
}
test('Drive connection is director-only, PKCE protected, and does not use calendar authorization',async()=>{
 const {env,users,db}=await setup();await assert.rejects(driveConnect(env,users[1]),e=>e.status===403);
 const response=await driveConnect(env,users[0]),url=new URL((await response.json()).url);assert.equal(url.searchParams.get('scope'),'openid email '+driveScope);assert.equal(url.searchParams.get('redirect_uri'),origin+'/auth/callback');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.match(response.headers.get('Set-Cookie'),/__Host-yg-drive=.*HttpOnly; Secure; SameSite=Lax/);assert.equal(db.prepare('SELECT COUNT(*) n FROM agenda_drive_oauth_states').get().n,1);
 assert.equal((await worker.fetch(request('/api/agendas/drive/connect','writer','POST','{}'),env)).status,403);const cross=request('/api/agendas/drive/connect','director','POST','{}');cross.headers.set('Origin','https://other.test');assert.equal((await worker.fetch(cross,env)).status,403);
});
async function callbackSetup(env,u){const r=await driveConnect(env,u),auth=new URL((await r.json()).url),url=new URL(origin+'/auth/callback?state='+auth.searchParams.get('state')+'&code=code');return {auth,url,req:new Request(url,{headers:{Cookie:'__Host-yg-drive='+auth.searchParams.get('state')}}),identity:async()=>({sub:u.id,email:u.email,email_verified:true,hd:'yayasangambut.org',nonce:auth.searchParams.get('nonce')})};}
test('Drive callback verifies identity and creates only application archive under configured root',async()=>{
 const {env,users,db}=await setup(),c=await callbackSetup(env,users[0]);await googleMock(async calls=>{const r=await driveCallback(c.req,env,c.url,users[0],c.identity);assert.equal(r.status,302);assert.match(r.headers.get('Location'),/drive=connected/);const saved=db.prepare('SELECT * FROM agenda_drive_connection').get();assert.equal(saved.root_id,root);assert.equal(saved.folder_id,folder);assert.notEqual(saved.refresh_token,'refresh');assert.equal(await openToken(env,'agenda-drive:director',saved.refresh_token),'refresh');assert(calls.every(x=>!x.url.includes('/permissions')));await assert.rejects(driveCallback(c.req,env,c.url,users[0],c.identity),e=>e.status===403);});
});
test('wrong callback identity, missing consent, and expired state cannot establish a connection',async()=>{
 for(const variant of ['identity','scope','expired']){const {env,users,db}=await setup(),c=await callbackSetup(env,users[0]);if(variant==='expired')db.exec('UPDATE agenda_drive_oauth_states SET expires=0');await googleMock(async()=>{await assert.rejects(driveCallback(c.req,env,c.url,users[0],variant==='identity'?async()=>({...(await c.identity()),sub:'other'}):c.identity),e=>e.status===403);assert.equal(db.prepare('SELECT COUNT(*) n FROM agenda_drive_connection').get().n,0);},{scope:variant==='scope'?'openid email':driveScope});}
});
test('new attachments use Drive, preview redirects after agenda authorization, unlink preserves archive',async()=>{
 const {env,db,objects}=await setup();await connected(env);const before=JSON.stringify(db.prepare('SELECT * FROM team_agendas').all());
 await googleMock(async calls=>{const r=await worker.fetch(request('/api/agendas/event-1/files','writer','POST',pdf),env);assert.equal(r.status,201,await r.clone().text());const {id}=await r.json();assert.equal(objects.size,0);const list=await (await worker.fetch(request('/api/agendas/event-1/files','participant'),env)).json();assert.equal(list.drive.connected,true);assert.equal(list.files[0].drive_file_id,'drive-1');assert.equal(JSON.stringify(list).includes('refresh_token'),false);
  const view=await worker.fetch(request('/api/agendas/event-1/files/'+id,'participant'),env);assert.equal(view.status,302);assert.equal(view.headers.get('Location'),'https://drive.google.com/file/d/drive-1/view');assert.equal((await worker.fetch(request('/api/agendas/event-1/files/'+id,'other'),env)).status,403);
  assert.equal((await worker.fetch(request('/api/agendas/event-1/files/'+id,'writer','DELETE','{}'),env)).status,200);assert(!calls.some(x=>x.method==='PATCH'||x.method==='DELETE'));assert.equal(JSON.stringify(db.prepare('SELECT * FROM team_agendas').all()),before);
 });
});
function legacy(db,objects){db.prepare('INSERT INTO agenda_files(id,agenda_id,actor,filename,type,size,created_at) VALUES(?,?,?,?,?,?,?)').run('abc-123','event-1','writer','Undangan.pdf','application/pdf',pdf.length,'2026');objects.set('agendas/abc-123',pdf);}
test('legacy migration is retry-safe, checks bytes, retains original, and cannot be invoked by participant',async()=>{
 const {env,db,objects}=await setup();await connected(env);legacy(db,objects);const path='/api/agendas/event-1/files/abc-123/drive';
 await googleMock(async calls=>{assert.equal((await worker.fetch(request(path,'participant','POST','{}'),env)).status,403);assert.equal((await worker.fetch(request(path,'writer','POST','{}'),env)).status,200);assert.equal((await worker.fetch(request(path,'director','POST','{}'),env)).status,200);assert.equal(calls.filter(x=>x.url.includes('/upload/')).length,1);assert(objects.has('agendas/abc-123'));assert.equal(db.prepare('SELECT drive_lease_until FROM agenda_files').get().drive_lease_until,0);});
});
test('failed Drive checksum preserves legacy file and metadata, and cleans up invalid copy',async()=>{
 const {env,db,objects}=await setup();await connected(env);legacy(db,objects);await googleMock(async calls=>{const r=await worker.fetch(request('/api/agendas/event-1/files/abc-123/drive','writer','POST','{}'),env);assert.equal(r.status,502);assert.equal(db.prepare('SELECT drive_file_id FROM agenda_files').get().drive_file_id,null);assert(objects.has('agendas/abc-123'));assert(calls.some(x=>x.method==='PATCH'));assert.equal((await worker.fetch(request('/api/agendas/event-1/files/abc-123','participant'),env)).status,200);},{badHash:true});
});
test('connection absent or revoked fails closed without silently storing new files elsewhere',async()=>{
 const {env,objects}=await setup();assert.equal((await worker.fetch(request('/api/agendas/event-1/files','writer','POST',pdf),env)).status,409);assert.equal(objects.size,0);await connected(env);await googleMock(async()=>{assert.equal((await worker.fetch(request('/api/agendas/event-1/files','writer','POST',pdf),env)).status,409);assert.equal((await driveStatus(env)).connected,false);},{invalidGrant:true});
});
test('disabled connection owner and untrusted preview hosts are rejected',async()=>{
 const {env,db}=await setup();await connected(env);db.exec("UPDATE users SET disabled=1 WHERE id='director'");assert.equal((await driveStatus(env)).connected,false);assert.equal((await worker.fetch(request('/api/agendas/event-1/files','writer','POST',pdf),env)).status,409);
 for(const url of ['javascript:alert(1)','https://evil.test/a','https://drive.google.com.evil.test/a','https://u:p@drive.google.com/a'])assert.throws(()=>drivePreviewUrl(url));assert.equal(drivePreviewUrl('https://drive.google.com/file/d/id/view?resourcekey=key'),'https://drive.google.com/file/d/id/view?resourcekey=key');
});
