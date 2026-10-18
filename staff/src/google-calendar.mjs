import {fail,now,token,sha} from './core.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
const json=d=>Response.json(d,{headers:{'Cache-Control':'private, no-store'}});
export const calendarScope='https://www.googleapis.com/auth/calendar.app.created';
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(env){if(!env.GOOGLE_CLIENT_SECRET)fail(503,'Koneksi Google belum dikonfigurasi.');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('yg-calendar-v1:'+env.GOOGLE_CLIENT_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
export async function sealToken(env,user,value){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(user)},await key(env),enc.encode(value)));}
export async function openToken(env,user,value){const [iv,data]=value.split('.');return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:enc.encode(user)},await key(env),un64(data)));}
const cookie=(v,age)=>`__Host-yg-calendar=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function calendarConnect(env,u){
 const existing=await q(env,'SELECT lease_until FROM calendar_connections WHERE user_id=?',u.id).first();if(existing?.lease_until>Date.now())fail(409,'Sinkronisasi sedang berjalan. Coba hubungkan kembali sebentar lagi.');
 const state=token(),nonce=token(),verifier=token();await q(env,'DELETE FROM calendar_oauth_states WHERE expires<?',Date.now()).run();await q(env,'INSERT INTO calendar_oauth_states VALUES(?,?,?,?,?)',await sha(state),u.id,nonce,verifier,Date.now()+600000).run();
 const hash=await crypto.subtle.digest('SHA-256',enc.encode(verifier));
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/auth/callback',response_type:'code',scope:'openid email '+calendarScope,state,nonce,login_hint:u.email,hd:env.GOOGLE_WORKSPACE_DOMAIN,access_type:'offline',prompt:'consent',code_challenge:b64(hash).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'),code_challenge_method:'S256'});
 return Response.json({url:url.href},{headers:{'Set-Cookie':cookie(state,600),'Cache-Control':'no-store'}});
}
export async function calendarCallback(req,env,url,u,verifyIdentity){
 const state=url.searchParams.get('state'),saved=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-yg-calendar='))?.slice('__Host-yg-calendar='.length);
 if(!state||state!==saved)fail(403,'Permintaan koneksi kalender tidak cocok.');
 const row=await q(env,'DELETE FROM calendar_oauth_states WHERE id=? AND user_id=? AND expires>? RETURNING *',await sha(state),u.id,Date.now()).first();if(!row)fail(403,'Permintaan koneksi kalender kedaluwarsa.');
 const redirect=code=>new Response(null,{status:302,headers:{Location:env.APP_ORIGIN+'/?view=agendas&calendar='+code,'Set-Cookie':cookie('',0)}});
 if(url.searchParams.has('error'))return redirect('cancelled');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.APP_ORIGIN+'/auth/callback',grant_type:'authorization_code',code:url.searchParams.get('code')||'',code_verifier:row.verifier})});
 if(!r.ok)fail(401,'Google belum menerima koneksi kalender. Coba hubungkan kembali.');const t=await r.json();const claims=await verifyIdentity(t.id_token);
 if(claims.nonce!==row.nonce||claims.sub!==u.id||String(claims.email).toLowerCase()!==u.email.toLowerCase()||claims.email_verified!==true||claims.hd!==env.GOOGLE_WORKSPACE_DOMAIN)fail(403,'Pilih akun Google yang sama dengan akun staf Anda.');
 if(!String(t.scope||'').split(' ').includes(calendarScope))fail(403,'Izin kalender belum diberikan. Hubungkan kembali dan izinkan kalender YG.');
 const old=await q(env,'SELECT * FROM calendar_connections WHERE user_id=?',u.id).first();if(old?.lease_until>Date.now())fail(409,'Sinkronisasi sedang berjalan. Coba kembali.');
 if(!t.refresh_token&&!old)fail(400,'Izin sinkronisasi otomatis belum tersedia. Hubungkan kembali.');
 const sealed=t.refresh_token?await sealToken(env,u.id,t.refresh_token):old.refresh_token;
 await q(env,"INSERT INTO calendar_connections(user_id,email,refresh_token,calendar_id,generation,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,refresh_token=excluded.refresh_token,generation=excluded.generation,status='connected',error='',lease_until=0",u.id,u.email,sealed,old?.calendar_id||'',crypto.randomUUID(),now()).run();return redirect('connected');
}
const nextDay=s=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
export function calendarEvent(kind,a,origin){
 const task=kind==='task',state=task?({todo:'Belum dimulai',doing:'Dikerjakan',review:'Perlu ditinjau',done:'Selesai'}[a.status]):'';
 const body={summary:(task?'Tenggat: ':'')+a.title,description:[a.program&&'Program: '+a.program,state&&'Status tugas: '+state,a.description,'Kelola di '+origin+'/?view='+(task?'tasks':'agendas')].filter(Boolean).join('\n\n'),location:a.location||'',visibility:'private',transparency:task?'transparent':'opaque',reminders:{useDefault:true},extendedProperties:{private:{ygSource:kind+':'+a.id}}};
 if(task){body.start={date:a.due_date};body.end={date:nextDay(a.due_date)};}else{body.start={dateTime:a.start_at+':00+07:00',timeZone:'Asia/Jakarta'};body.end={dateTime:a.end_at+':00+07:00',timeZone:'Asia/Jakarta'};}
 return body;
}
class GoogleError extends Error{constructor(status){super('Google Calendar '+status);this.status=status;}}
async function google(access,path,method='GET',body){const r=await fetch('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new GoogleError(r.status);return r.status===204?null:r.json();}
export async function syncCalendar(env,userId){
 const lease=Date.now()+180000;const c=await q(env,"UPDATE calendar_connections SET lease_until=?,last_attempt=? WHERE user_id=? AND status='connected' AND lease_until<? AND EXISTS(SELECT 1 FROM users WHERE id=user_id AND disabled=0 AND email LIKE ?) AND NOT EXISTS(SELECT 1 FROM webgis_access WHERE email=calendar_connections.email AND scope='kups-finance') RETURNING *",lease,now(),userId,Date.now(),'%@'+env.GOOGLE_WORKSPACE_DOMAIN).first();if(!c)return {busy:true};
 let changes=0;
 try{
  const refresh=await openToken(env,userId,c.refresh_token),r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:refresh})});
  if(!r.ok){const data=await r.json().catch(()=>({}));if(data.error==='invalid_grant')throw new GoogleError(401);throw new GoogleError(r.status);}
  const t=await r.json();if(!t.access_token)throw new GoogleError(401);
  let calendar=c.calendar_id;
  if(!calendar){const created=await google(t.access_token,'/calendars','POST',{summary:'Yayasan Gambut — Agenda & Tugas',timeZone:'Asia/Jakarta',description:'Agenda dan tenggat tugas dari dashboard staf Yayasan Gambut. Perbarui melalui dashboard.'});calendar=created.id;await q(env,'UPDATE calendar_connections SET calendar_id=? WHERE user_id=? AND generation=?',calendar,userId,c.generation).run();}
  const [agendas,tasks,mapped]=await Promise.all([
   q(env,"SELECT * FROM team_agendas WHERE deleted=0 AND status!='cancelled' AND EXISTS(SELECT 1 FROM json_each(participant_ids) WHERE value=?)",userId).all(),
   q(env,'SELECT * FROM team_tasks WHERE archived=0 AND EXISTS(SELECT 1 FROM json_each(assignees) WHERE value=?)',userId).all(),
   q(env,'SELECT * FROM calendar_events WHERE user_id=?',userId).all()
  ]);
  const desired=new Map([...agendas.results.map(a=>['agenda:'+a.id,calendarEvent('agenda',a,env.APP_ORIGIN)]),...tasks.results.map(a=>['task:'+a.id,calendarEvent('task',a,env.APP_ORIGIN)])]);
  const saved=new Map(mapped.results.map(m=>[m.source_key,m]));let pending=false;
  // First remove old assignments and deleted/cancelled events from this user's YG calendar.
  for(const [source,m] of saved){if(desired.has(source))continue;if(changes>=40){pending=true;break;}try{await google(t.access_token,'/calendars/'+encodeURIComponent(calendar)+'/events/'+m.event_id,'DELETE');}catch(e){if(![404,410].includes(e.status))throw e;}await q(env,'DELETE FROM calendar_events WHERE user_id=? AND source_key=?',userId,source).run();changes++;}
  for(const [source,body] of desired){const hash=await sha(JSON.stringify(body));let m=saved.get(source);if(m?.content_hash===hash)continue;if(changes>=40){pending=true;break;}
   if(!m){m={event_id:'c'+crypto.randomUUID().replace(/-/g,''),content_hash:''};await q(env,"INSERT OR IGNORE INTO calendar_events(user_id,source_key,event_id) VALUES(?,?,?)",userId,source,m.event_id).run();m=await q(env,'SELECT * FROM calendar_events WHERE user_id=? AND source_key=?',userId,source).first();}
   const path='/calendars/'+encodeURIComponent(calendar)+'/events';
   if(m.content_hash){try{await google(t.access_token,path+'/'+m.event_id,'PUT',body);}catch(e){if(![404,410].includes(e.status))throw e;const id='c'+crypto.randomUUID().replace(/-/g,'');await q(env,"UPDATE calendar_events SET event_id=?,content_hash='' WHERE user_id=? AND source_key=?",id,userId,source).run();m.event_id=id;await google(t.access_token,path,'POST',{...body,id});}}
   else {try{await google(t.access_token,path,'POST',{...body,id:m.event_id});}catch(e){if(e.status!==409)throw e;await google(t.access_token,path+'/'+m.event_id,'PUT',body);}}
   await q(env,'UPDATE calendar_events SET content_hash=? WHERE user_id=? AND source_key=?',hash,userId,source).run();changes++;
  }
  await q(env,"UPDATE calendar_connections SET last_synced=?,error='',lease_until=0 WHERE user_id=? AND generation=?",pending?c.last_synced:now(),userId,c.generation).run();return {changes,pending};
 }catch(e){const status=e.status===401?'reconnect':'connected',message=e.status===401?'Izin Google berakhir. Hubungkan kembali akun kalender.':e.status===403?'Google menolak akses. Periksa izin akun dan aktivasi Google Calendar API.':e.status===404?'Kalender YG tidak ditemukan. Putuskan koneksi lalu hubungkan kembali.':'Sinkronisasi belum berhasil. Sistem akan mencoba kembali.';
  await q(env,'UPDATE calendar_connections SET status=?,error=?,lease_until=0 WHERE user_id=? AND generation=?',status,message,userId,c.generation).run();return {error:message};
 }
}
export async function syncCalendars(env){const list=(await q(env,"SELECT user_id FROM calendar_connections WHERE status='connected' AND lease_until<? ORDER BY COALESCE(last_attempt,'') LIMIT 3",Date.now()).all()).results;for(const c of list)await syncCalendar(env,c.user_id);}
export async function calendarApi(req,env,url,u){
 if(url.pathname==='/api/calendar/connect'&&req.method==='POST')return calendarConnect(env,u);
 if(url.pathname==='/api/calendar'&&req.method==='GET'){const c=await q(env,'SELECT email,status,last_synced,last_attempt,error,calendar_id FROM calendar_connections WHERE user_id=?',u.id).first();return json(c?{connected:true,email:c.email,status:c.status,last_synced:c.last_synced,last_attempt:c.last_attempt,error:c.error,calendarReady:!!c.calendar_id}:{connected:false});}
 if(url.pathname==='/api/calendar/sync'&&req.method==='POST')return json(await syncCalendar(env,u.id));
 if(url.pathname==='/api/calendar'&&req.method==='DELETE'){
  const removed=await q(env,'DELETE FROM calendar_connections WHERE user_id=? AND lease_until<=? RETURNING user_id',u.id,Date.now()).first();
  if(!removed&&(await q(env,'SELECT user_id FROM calendar_connections WHERE user_id=?',u.id).first()))fail(409,'Sinkronisasi sedang berjalan. Coba putuskan sebentar lagi.');
  await env.DB.batch([q(env,'DELETE FROM calendar_events WHERE user_id=?',u.id),q(env,'DELETE FROM calendar_oauth_states WHERE user_id=?',u.id)]);return json({disconnected:true});
 }
 fail(405,'Metode kalender tidak didukung.');
}
