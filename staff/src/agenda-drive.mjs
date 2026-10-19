import {createHash} from 'node:crypto';
import {fail,now,token,sha} from './core.mjs';
import {taskDirector} from './tasks.mjs';
import {sealToken,openToken} from './google-calendar.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
// Existing organizational Shared Drive, not a user-supplied request parameter.
export const driveScope='https://www.googleapis.com/auth/drive';
const folderMime='application/vnd.google-apps.folder';
const cookie=(v,age)=>`__Host-yg-drive=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const tokenOwner=u=>'agenda-drive:'+u;
const rootId=env=>{const id=env.AGENDA_DRIVE_ROOT_ID;if(!/^[A-Za-z0-9_-]{10,120}$/.test(id||''))fail(503,'Folder arsip Google Drive belum dikonfigurasi.');return id;};
export function drivePreviewUrl(value){try{const u=new URL(value);if(u.protocol==='https:'&&['drive.google.com','docs.google.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port)return u.href;}catch{}fail(502,'Tautan pratinjau Drive tidak valid.');}
async function google(access,path,options={}){
 const r=await fetch('https://www.googleapis.com'+path,{...options,headers:{Authorization:'Bearer '+access,...options.headers}});
 if(!r.ok){const e=await r.json().catch(()=>({})),disabled=(e.error?.errors||[]).some(x=>x.reason==='accessNotConfigured')||(e.error?.details||[]).some(x=>x.reason==='SERVICE_DISABLED');
  fail(r.status===401?409:502,disabled?'Google Drive API belum aktif pada project login YG. Aktifkan API lalu hubungkan kembali.':r.status===401?'Koneksi Drive berakhir. Direktur perlu menghubungkan kembali.':r.status===403||r.status===404?'Google Drive menolak akses. Periksa hak akun Direktur pada folder arsip YG.':'Penyimpanan Google Drive belum berhasil. Coba kembali; lampiran lama tetap tersedia.');
 }
 return r.status===204?null:r.json();
}
async function validFolder(access,id,root){
 const f=await google(access,`/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id,mimeType,parents,trashed,capabilities(canAddChildren)`);
 if(f.trashed||f.mimeType!==folderMime||!f.capabilities?.canAddChildren||(root&&!f.parents?.includes(root)))fail(409,'Folder arsip Drive telah dipindah, dihapus, atau tidak dapat ditulis. Hubungkan kembali.');return f;
}
export async function driveConnect(env,u){
 if(!taskDirector(u,env))fail(403,'Koneksi arsip Drive hanya dapat diatur Direktur.');rootId(env);
 const state=token(),nonce=token(),verifier=token();await q(env,'DELETE FROM agenda_drive_oauth_states WHERE expires<?',Date.now()).run();await q(env,'INSERT INTO agenda_drive_oauth_states VALUES(?,?,?,?,?)',await sha(state),u.id,nonce,verifier,Date.now()+600000).run();
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...hash)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.APP_ORIGIN+'/auth/callback',response_type:'code',scope:'openid email '+driveScope,state,nonce,login_hint:u.email,hd:env.GOOGLE_WORKSPACE_DOMAIN,access_type:'offline',prompt:'consent',code_challenge:challenge,code_challenge_method:'S256'});
 return Response.json({url:url.href},{headers:{'Set-Cookie':cookie(state,600),'Cache-Control':'no-store'}});
}
export async function driveCallback(req,env,url,u,verifyIdentity){
 if(!taskDirector(u,env))fail(403,'Koneksi arsip Drive hanya dapat diatur Direktur.');
 const state=url.searchParams.get('state'),saved=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-yg-drive='))?.slice('__Host-yg-drive='.length);
 if(!state||state!==saved)fail(403,'Permintaan koneksi Drive tidak cocok.');
 const row=await q(env,'DELETE FROM agenda_drive_oauth_states WHERE id=? AND user_id=? AND expires>? RETURNING *',await sha(state),u.id,Date.now()).first();if(!row)fail(403,'Permintaan koneksi Drive kedaluwarsa.');
 const redirect=code=>new Response(null,{status:302,headers:{Location:env.APP_ORIGIN+'/?view=agendas&drive='+code,'Set-Cookie':cookie('',0)}});
 if(url.searchParams.has('error'))return redirect('cancelled');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.APP_ORIGIN+'/auth/callback',grant_type:'authorization_code',code:url.searchParams.get('code')||'',code_verifier:row.verifier})});
 if(!response.ok)fail(401,'Google belum menerima koneksi Drive. Hubungkan kembali.');const t=await response.json(),claims=await verifyIdentity(t.id_token);
 if(claims.nonce!==row.nonce||claims.sub!==u.id||String(claims.email).toLowerCase()!==u.email.toLowerCase()||claims.email_verified!==true||claims.hd!==env.GOOGLE_WORKSPACE_DOMAIN)fail(403,'Pilih akun Direktur yang sama dengan akun staf Anda.');
 if(!String(t.scope||'').split(' ').includes(driveScope))fail(403,'Izin Google Drive belum diberikan.');
 const root=rootId(env),old=await q(env,'SELECT * FROM agenda_drive_connection WHERE id=1').first();
 if(!t.refresh_token&&(!old||old.user_id!==u.id))fail(400,'Izin penyimpanan otomatis belum tersedia. Hubungkan kembali Google Drive.');
 await validFolder(t.access_token,root);
 let folder=old?.root_id===root?old.folder_id:null;
 if(folder){await validFolder(t.access_token,folder,root);}else{
  // Locate only this application's archive to recover from a callback retry.
  const query=`'${root}' in parents and trashed = false and mimeType = '${folderMime}' and appProperties has { key='ygAgendaArchive' and value='v1' }`;
  const list=await google(t.access_token,'/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=2&fields=files(id)&q='+encodeURIComponent(query));
  if(list.files?.length>1)fail(409,'Ditemukan lebih dari satu arsip aplikasi. Administrator perlu memeriksa folder.');
  folder=list.files?.[0]?.id;
  if(!folder){const f=await google(t.access_token,'/drive/v3/files?supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Lampiran Agenda YG',mimeType:folderMime,parents:[root],appProperties:{ygAgendaArchive:'v1'}})});folder=f.id;}
  await validFolder(t.access_token,folder,root);
 }
 const sealed=t.refresh_token?await sealToken(env,tokenOwner(u.id),t.refresh_token):old.refresh_token;
 await q(env,"INSERT INTO agenda_drive_connection(id,user_id,email,refresh_token,root_id,folder_id,status,updated_at) VALUES(1,?,?,?,?,?,'connected',?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,email=excluded.email,refresh_token=excluded.refresh_token,root_id=excluded.root_id,folder_id=excluded.folder_id,status='connected',updated_at=excluded.updated_at",u.id,u.email,sealed,root,folder,now()).run();
 return redirect('connected');
}
export async function driveStatus(env){
 const c=await q(env,'SELECT c.folder_id,c.root_id,c.status FROM agenda_drive_connection c JOIN users u ON u.id=c.user_id WHERE c.id=1 AND u.disabled=0 AND u.role=\'admin\' AND lower(u.email)=?',String(env.ADMIN_EMAIL||'').toLowerCase()).first();
 return {enabled:!!env.AGENDA_DRIVE_ROOT_ID,connected:!!c&&c.root_id===env.AGENDA_DRIVE_ROOT_ID&&c.status==='connected',folderUrl:c?.folder_id?'https://drive.google.com/drive/folders/'+encodeURIComponent(c.folder_id):null};
}
async function driveAccess(env){
 const c=await q(env,"SELECT c.* FROM agenda_drive_connection c JOIN users u ON u.id=c.user_id WHERE c.id=1 AND u.disabled=0 AND u.role='admin' AND lower(u.email)=?",String(env.ADMIN_EMAIL||'').toLowerCase()).first();
 if(!c||c.root_id!==rootId(env)||c.status!=='connected')fail(409,'Direktur perlu menghubungkan Google Drive pada bagian lampiran terlebih dahulu.');
 const refresh=await openToken(env,tokenOwner(c.user_id),c.refresh_token);
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:refresh})});
 if(!r.ok){const data=await r.json().catch(()=>({}));if(data.error==='invalid_grant'){await q(env,"UPDATE agenda_drive_connection SET status='reconnect' WHERE id=1 AND refresh_token=?",c.refresh_token).run();fail(409,'Izin Drive berakhir. Direktur perlu menghubungkan kembali.');}fail(502,'Koneksi Google belum tersedia. Coba kembali.');}
 const t=await r.json();if(!t.access_token)fail(502,'Token Google Drive tidak tersedia.');await validFolder(t.access_token,c.folder_id,c.root_id);return {access:t.access_token,folder:c.folder_id};
}
export async function storeDriveFile(env,{id,agendaId,filename,type,bytes}){
 const {access,folder}=await driveAccess(env),boundary='yg-'+crypto.randomUUID();
 const metadata={name:filename,mimeType:type,parents:[folder],appProperties:{ygAgendaId:agendaId,ygAttachmentId:id}};
 const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,bytes,`\r\n--${boundary}--\r\n`]);
 const file=await google(access,'/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,size,md5Checksum',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 const discard=async()=>google(access,'/drive/v3/files/'+encodeURIComponent(file.id)+'?supportsAllDrives=true',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});
 try{if(!file.id||Number(file.size)!==bytes.length||file.md5Checksum!==createHash('md5').update(bytes).digest('hex'))fail(502,'Salinan Drive belum lolos pemeriksaan berkas. Coba unggah kembali.');return {id:file.id,url:drivePreviewUrl(file.webViewLink),discard};}catch(e){if(file.id)await discard().catch(()=>{});throw e;}
}
export async function migrateDriveFile(env,file){
 if(file.drive_file_id)return false;
 const lease=Date.now()+180000,locked=await q(env,'UPDATE agenda_files SET drive_lease_until=? WHERE id=? AND drive_file_id IS NULL AND drive_lease_until<? RETURNING *',lease,file.id,Date.now()).first();if(!locked)fail(409,'Lampiran sedang dipindahkan. Muat ulang sebentar lagi.');
 let stored;
 try{
  if(!env.MEDIA)fail(503,'Penyimpanan lampiran lama belum tersedia.');const object=await env.MEDIA.get('agendas/'+file.id);if(!object)fail(404,'Berkas lampiran lama tidak ditemukan.');
  const bytes=new Uint8Array(await new Response(object.body).arrayBuffer());
  stored=await storeDriveFile(env,{id:file.id,agendaId:file.agenda_id,filename:file.filename,type:file.type,bytes});
  const r=await q(env,'UPDATE agenda_files SET drive_file_id=?,drive_web_url=?,drive_lease_until=0 WHERE id=? AND drive_lease_until=? AND drive_file_id IS NULL',stored.id,stored.url,file.id,lease).run();if(!r.meta.changes)fail(409,'Lampiran berubah saat disalin. Muat ulang.');
  // Preserve the original object as a recovery copy, not a public URL.
  return true;
 }catch(e){if(stored)await stored.discard().catch(()=>{});throw e;}finally{await q(env,'UPDATE agenda_files SET drive_lease_until=0 WHERE id=? AND drive_lease_until=?',file.id,lease).run();}
}
export async function driveApi(req,env,url,u){
 if(url.pathname==='/api/agendas/drive'&&req.method==='GET')return Response.json(await driveStatus(env));
 if(url.pathname==='/api/agendas/drive/connect'&&req.method==='POST')return driveConnect(env,u);
 fail(405,'Layanan koneksi Drive tidak didukung.');
}
