import {fail,now,imageType} from './core.mjs';
import {taskDirector} from './tasks.mjs';
import {driveApi,driveStatus,drivePreviewUrl,storeDriveFile,migrateDriveFile} from './agenda-drive.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const member=(a,u)=>a.creator===u.id||JSON.parse(a.participant_ids).includes(u.id);
export function agendaInput(input){
 const text=(key,max)=>{const v=String(input[key]??'').trim();if(v.length>max)fail(400,'Isian '+key+' terlalu panjang.');return v;};
 const a={title:text('title',200),kind:text('kind',20),kind_custom:text('kind_custom',120),program:text('program',120),location:text('location',200),coordinator:text('coordinator',160),start_at:text('start_at',16),end_at:text('end_at',16),participants:text('participants',1000),description:text('description',10000),results:text('results',10000),status:text('status',20)||'scheduled'};
 if(!a.title||!['field','meeting','event','travel','other'].includes(a.kind)||!['scheduled','ongoing','done','cancelled'].includes(a.status))fail(400,'Lengkapi judul, jenis, dan status agenda.');
 for(const key of ['start_at','end_at']){const v=a[key];if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'Z'))||new Date(v+'Z').toISOString().slice(0,16)!==v)fail(400,'Tanggal dan waktu agenda tidak valid.');}
 if(a.end_at<a.start_at)fail(400,'Waktu selesai harus setelah waktu mulai.');return a;
}
export async function agendaApi(req,env,url,u,{payload,readLimited}){
 const director=taskDirector(u,env),path=url.pathname,method=req.method;
 if(path==='/api/agendas/drive'||path.startsWith('/api/agendas/drive/'))return driveApi(req,env,url,u);
 const people=(await q(env,"SELECT id,name,email FROM users WHERE disabled=0 AND email LIKE ? AND NOT EXISTS(SELECT 1 FROM webgis_access WHERE email=users.email AND scope='kups-finance') ORDER BY name",'%@'+env.GOOGLE_WORKSPACE_DOMAIN).all()).results;
 const read=async id=>{const a=await q(env,'SELECT * FROM team_agendas WHERE id=?',id).first();if(!a)fail(404,'Agenda tidak ditemukan.');if(!director&&!member(a,u))fail(403,'Agenda ini tidak termasuk kegiatan Anda.');return a;};
 if(path==='/api/agendas'&&method==='GET'){const all=director&&url.searchParams.get('scope')==='all';const agendas=(await q(env,'SELECT team_agendas.*,users.name AS creatorName FROM team_agendas JOIN users ON users.id=creator '+'WHERE deleted=? '+(all?'':'AND (creator=? OR EXISTS(SELECT 1 FROM json_each(participant_ids) WHERE value=?)) ')+'ORDER BY start_at DESC',Number(url.searchParams.get('trash')==='1'),...(all?[]:[u.id,u.id])).all()).results;return Response.json({director,people,agendas});}
 if(path==='/api/agendas'&&method==='POST'){
  const input=await payload(req),a=agendaInput(input);if('participant_ids' in input&&!Array.isArray(input.participant_ids))fail(400,'Pilih anggota tim dengan benar.');const ids=[...new Set([...(director?[]:[u.id]),...(Array.isArray(input.participant_ids)?input.participant_ids:[])])];if(ids.length>30||ids.some(id=>!people.some(p=>p.id===id)))fail(400,'Pilih anggota tim YG yang aktif.');
  const id=crypto.randomUUID(),time=now();await q(env,'INSERT INTO team_agendas(id,creator,title,kind,kind_custom,program,location,coordinator,start_at,end_at,participant_ids,participants,description,results,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.id,a.title,a.kind,a.kind_custom,a.program,a.location,a.coordinator,a.start_at,a.end_at,JSON.stringify(ids),a.participants,a.description,a.results,a.status,time,time).run();return Response.json(await read(id),{status:201});
 }
 const match=/^\/api\/agendas\/([a-z0-9-]+)(?:\/(restore|files)(?:\/([a-f0-9-]+)(?:\/(drive))?)?)?$/.exec(path);if(!match)fail(404,'Layanan agenda tidak ditemukan.');const a=await read(match[1]);
 if(match[2]==='files'){
  const fileId=match[3];
  if(method==='GET'&&!fileId)return Response.json({files:(await q(env,'SELECT agenda_files.*,users.name AS actorName FROM agenda_files JOIN users ON users.id=actor WHERE agenda_id=? ORDER BY created_at DESC,id DESC',a.id).all()).results,drive:await driveStatus(env)});
  if(method==='GET'&&fileId&&!match[4]){
   const file=await q(env,'SELECT * FROM agenda_files WHERE id=? AND agenda_id=?',fileId,a.id).first();if(!file)fail(404,'Lampiran tidak ditemukan.');
   if(file.drive_file_id)return new Response(null,{status:302,headers:{Location:drivePreviewUrl(file.drive_web_url),'Cache-Control':'private, no-store'}});
   if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');const object=await env.MEDIA.get('agendas/'+fileId);if(!object)fail(404,'Lampiran tidak ditemukan.');
   return new Response(object.body,{headers:{'Content-Type':file.type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(!director&&a.creator!==u.id)fail(403,'Hanya pembuat agenda atau Direktur dapat mengelola lampiran.');
  if(a.deleted)fail(409,'Pulihkan agenda sebelum mengubah lampiran.');
  if(method==='POST'&&fileId&&match[4]==='drive'){
   const file=await q(env,'SELECT * FROM agenda_files WHERE id=? AND agenda_id=?',fileId,a.id).first();if(!file)fail(404,'Lampiran tidak ditemukan.');await migrateDriveFile(env,file);return Response.json({ok:true});
  }
  if(match[4])fail(405,'Metode tidak didukung.');
  if(method==='POST'&&!fileId){
   const bytes=await readLimited(req,5*1024*1024);if(!bytes.length)fail(400,'Pilih berkas lampiran.');
   const type=imageType(bytes)||(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':null);if(!type)fail(400,'Gunakan PDF, JPEG, PNG, atau WebP. Maksimal 5 MB per berkas.');
   let filename;try{filename=decodeURIComponent(req.headers.get('X-Filename')||'Lampiran').replace(/[\x00-\x1f\x7f"\\/]/g,'_').trim().slice(0,180)||'Lampiran';}catch{fail(400,'Nama berkas tidak valid.');}
   const id=crypto.randomUUID();
   if(env.AGENDA_DRIVE_ROOT_ID){
    const stored=await storeDriveFile(env,{id,agendaId:a.id,filename,type,bytes});
    try{await q(env,'INSERT INTO agenda_files(id,agenda_id,actor,filename,type,size,created_at,drive_file_id,drive_web_url) VALUES(?,?,?,?,?,?,?,?,?)',id,a.id,u.id,filename,type,bytes.length,now(),stored.id,stored.url).run();}catch(error){await stored.discard().catch(()=>{});throw error;}
   }else{
    if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');await env.MEDIA.put('agendas/'+id,bytes,{httpMetadata:{contentType:type}});
    try{await q(env,'INSERT INTO agenda_files(id,agenda_id,actor,filename,type,size,created_at) VALUES(?,?,?,?,?,?,?)',id,a.id,u.id,filename,type,bytes.length,now()).run();}catch(error){await env.MEDIA.delete('agendas/'+id);throw error;}
   }
   return Response.json({id,filename},{status:201});
  }
  if(method==='DELETE'&&fileId){
   const file=await q(env,'SELECT * FROM agenda_files WHERE id=? AND agenda_id=?',fileId,a.id).first();if(!file)fail(404,'Lampiran tidak ditemukan.');
   if(file.drive_lease_until>Date.now())fail(409,'Lampiran sedang dipindahkan. Tunggu sampai selesai.');
   // Removing an agenda link must not destroy the organization's Drive archive.
   if(!file.drive_file_id){if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');await env.MEDIA.delete('agendas/'+fileId);}
   await q(env,'DELETE FROM agenda_files WHERE id=? AND agenda_id=?',fileId,a.id).run();return Response.json({ok:true});
  }
  fail(405,'Metode tidak didukung.');
 }
 if(match[3])fail(404,'Layanan agenda tidak ditemukan.');
 if(method==='DELETE'||(method==='POST'&&match[2]==='restore')){
  if(!director&&a.creator!==u.id)fail(403,'Hanya pembuat agenda atau Direktur dapat menghapus dan memulihkan agenda.');
  const input=await payload(req),deleted=method==='DELETE'?1:0;
  if(input.version!==a.version||a.deleted===deleted)fail(409,'Agenda telah berubah. Muat ulang sebelum melanjutkan.');
  const result=await q(env,'UPDATE team_agendas SET deleted=?,version=version+1,updated_at=? WHERE id=? AND version=?',deleted,now(),a.id,input.version).run();if(!result.meta.changes)fail(409,'Agenda telah berubah. Muat ulang sebelum melanjutkan.');
  return Response.json(await read(a.id));
 }
 if(match[2])fail(405,'Metode tidak didukung.');
 if(method==='GET')return Response.json(a);
 if(a.deleted)fail(409,'Pulihkan agenda sebelum menyunting.');
 if(method==='PUT'){
  const input=await payload(req);if('participant_ids' in input&&!Array.isArray(input.participant_ids))fail(400,'Pilih anggota tim dengan benar.');if(input.version!==a.version)fail(409,'Agenda telah berubah. Muat ulang sebelum menyimpan.');
  const full=director||a.creator===u.id;if(!full&&Object.keys(input).some(k=>!['version','results','status'].includes(k)))fail(403,'Peserta dapat memperbarui hasil dan status. Rincian diubah oleh pembuat agenda atau Direktur.');
  const data=agendaInput({...a,...input}),ids=full&&'participant_ids' in input?[...new Set([...(director?[]:[a.creator]),...input.participant_ids])]:JSON.parse(a.participant_ids);
  if('participant_ids' in input&&(ids.length>30||ids.some(id=>!people.some(p=>p.id===id))))fail(400,'Anggota tim harus staf YG yang aktif.');
  const r=await q(env,'UPDATE team_agendas SET title=?,kind=?,kind_custom=?,program=?,location=?,coordinator=?,start_at=?,end_at=?,participant_ids=?,participants=?,description=?,results=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?',data.title,data.kind,data.kind_custom,data.program,data.location,data.coordinator,data.start_at,data.end_at,JSON.stringify(ids),data.participants,data.description,data.results,data.status,now(),a.id,a.version).run();if(!r.meta.changes)fail(409,'Agenda telah berubah. Muat ulang sebelum menyimpan.');return Response.json(await read(a.id));
 }
 fail(405,'Metode tidak didukung.');
}
