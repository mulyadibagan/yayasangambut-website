import {fail,token,sha} from './core.mjs';
const origin='https://webgisyg.id',callback=origin+'/staff-login.html';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const respond=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Vary':'Origin'}});
export async function challenge(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
export function identityScope(user,grant){
 if(grant?.disabled)fail(403,'Akses WebGIS dinonaktifkan.');
 if(grant?.scope==='kups-finance')return {scope:'kups-finance',role:'kups'};
 if(!String(user.email).endsWith('@yayasangambut.org'))fail(403,'Email belum memiliki akses.');
 return {scope:'webgis-staff',role:user.role==='admin'?'admin':user.role==='editor'?'gis':'staff'};
}
export function destination(scope){return scope==='kups-finance'?'kups-finance.html':'admin-dashboard.html';}
async function grant(env,u){return identityScope(u,await q(env,'SELECT * FROM webgis_access WHERE email=?',u.email).first());}
export async function issueCode(env,u,target){
 u=await q(env,'SELECT * FROM users WHERE id=? AND disabled=0',u.id).first();if(!u)fail(403,'Akses dinonaktifkan.');
 const access=await grant(env,u),code=token();
 await q(env,'INSERT INTO webgis_codes(id,user_id,challenge,state,scope,role,expires) VALUES(?,?,?,?,?,?,?)',await sha(code),u.id,target.challenge,target.state,access.scope,access.role,Date.now()+60000).run();
 return new Response(null,{status:302,headers:{Location:callback+'#'+new URLSearchParams({googleCode:code,state:target.state}),'Set-Cookie':'__Host-yg-webgis-target=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0','Cache-Control':'no-store'}});
}
export async function broker(req,env,url){
 if(req.method==='OPTIONS')return respond({},204);
 if(url.pathname==='/api/webgis/introspect'&&req.method==='GET'){
  const raw=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
  if(!raw.startsWith('yg-google-'))return respond({ok:false},401);
  const row=await q(env,'SELECT users.*,webgis_sessions.scope,webgis_sessions.role AS webgis_role,webgis_sessions.expires FROM webgis_sessions JOIN users ON users.id=webgis_sessions.user_id WHERE webgis_sessions.id=? AND webgis_sessions.expires>? AND users.disabled=0',await sha(raw),Date.now()).first();
  if(!row)return respond({ok:false},401);
  const access=await grant(env,row);if(access.scope!==row.scope||access.role!==row.webgis_role)return respond({ok:false},401);
  return respond({ok:true,email:row.email,username:row.email.split('@')[0],name:row.name,role:row.webgis_role,scope:row.scope,expiresAt:row.expires});
 }
 if(req.headers.get('Origin')!==origin)return respond({ok:false},403);
 if(url.pathname==='/api/webgis/exchange'&&req.method==='POST'){
  let b;try{b=await req.json();}catch{return respond({ok:false},400);}
  if(!/^[A-Za-z0-9_-]{43,128}$/.test(b.verifier||'')||!b.code||!b.state)return respond({ok:false},400);
  const c=await q(env,'DELETE FROM webgis_codes WHERE id=? AND challenge=? AND state=? AND expires>? RETURNING *',await sha(b.code),await challenge(b.verifier),b.state,Date.now()).first();
  if(!c)return respond({ok:false,error:'Permintaan login kedaluwarsa. Mulai lagi.'},401);
  const u=await q(env,'SELECT * FROM users WHERE id=? AND disabled=0',c.user_id).first();if(!u)return respond({ok:false},401);
  const access=await grant(env,u);if(access.scope!==c.scope||access.role!==c.role)return respond({ok:false},403);
  const raw='yg-google-'+token(),expires=Date.now()+8*3600000;
  await q(env,'INSERT INTO webgis_sessions VALUES(?,?,?,?,?)',await sha(raw),u.id,access.scope,access.role,expires).run();
  return respond({ok:true,sessionToken:raw,username:u.email.split('@')[0],name:u.name,email:u.email,role:access.role,scope:access.scope,expiresAt:expires,target:destination(access.scope)});
 }
 if(url.pathname==='/api/webgis/logout'&&req.method==='POST'){const raw=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';await q(env,'DELETE FROM webgis_sessions WHERE id=?',await sha(raw)).run();return respond({ok:true});}
 return respond({ok:false},404);
}
