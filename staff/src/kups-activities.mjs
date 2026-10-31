import {fail,now} from './core.mjs';

export const activityKinds=['Panen','Sensus tanaman','Pemupukan','Penyiangan','Pengendalian hama','Gotong royong','Kegiatan lain'];
export const attendanceStatuses=['planned','present','permission','sick','absent'];
const text=(v,max)=>{if(typeof v!=='string'||v.length>max)fail(400,'Teks isian tidak valid.');return v.trim();};
const validDate=v=>{const d=new Date(v+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;};
export function canManageActivities(u,access){return access==='admin'||access==='treasurer'||u.scope==='webgis-staff'&&/^[^@\s]+@yayasangambut\.org$/.test(u.email||'');}
export function validateActivity(b,today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'})){
 if(!b||typeof b!=='object'||!validDate(b.date)||!activityKinds.includes(b.kind))fail(400,'Pilih tanggal dan jenis kegiatan yang valid.');
 const p={title:text(b.title,180),date:b.date,time:text(b.time||'',5),kind:b.kind,location:text(b.location||'',200),notes:text(b.notes||'',2000),result:text(b.result||'',2000),participants:[]};
 if(!p.title||p.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))fail(400,'Isi judul dan jam kegiatan yang valid.');
 if(!Array.isArray(b.participants)||b.participants.length>200)fail(400,'Maksimal 200 peserta per kegiatan.');
 const names=new Set(),emails=new Set(),ids=new Set();
 p.participants=b.participants.map(row=>{
  const r={id:text(row.id,80),name:text(row.name,100),email:text(row.email||'',254).toLowerCase(),status:row.status,note:text(row.note||'',300)};
  const name=r.name.toLocaleLowerCase('id-ID').replace(/\s+/g,' ');
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(r.id)||!r.name||!attendanceStatuses.includes(r.status)||names.has(name)||ids.has(r.id))fail(400,'Periksa nama, status, atau peserta ganda.');
  if(r.email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)||emails.has(r.email)))fail(400,'Periksa email peserta; satu email untuk satu peserta.');
  if(p.date>today&&r.status!=='planned')fail(400,'Kehadiran baru dapat dicatat pada tanggal kegiatan.');
  names.add(name);ids.add(r.id);if(r.email)emails.add(r.email);return r;
 });return p;
}
function publicRecord(row,u,manage){
 const p=JSON.parse(row.payload);
 return {id:row.id,version:row.version,...p,source_ref:row.source_ref,updated_at:row.updated_at,participants:p.participants.map(r=>({...r,email:manage||r.email===u.email?r.email:'',self:r.email===u.email}))};
}
// Public access is limited to the Dayun agenda and never exposes participant emails or private notes.
export async function publicActivities(req,env,url,{q,json}){
 if(req.method!=='GET'||url.pathname!=='/api/kups/activities'||url.searchParams.get('group')!=='dayun-rimba-sejahtera')return null;
 const rows=(await q(env,'SELECT * FROM kups_activities WHERE group_id=? ORDER BY event_date DESC,id','dayun-rimba-sejahtera').all()).results;
 return json({public:true,user:null,canManage:false,events:rows.map(row=>{
  const p=JSON.parse(row.payload);
  return {id:row.id,version:row.version,title:p.title,date:p.date,time:p.time,kind:p.kind,location:p.location,notes:p.notes,result:p.result,source_ref:row.source_ref,updated_at:row.updated_at,participants:p.participants.map(r=>({name:r.name,status:r.status}))};
 })});
}

export async function activitiesRoute(req,env,url,c){
 const {path,method,q,g,u,access,json,body}=c;
 if(!path.startsWith('/activities'))return null;
 const manage=canManageActivities(u,access);
 const audit=(action,id,snapshot)=>q(env,'INSERT INTO kups_activity_audit(id,group_id,actor,action,target,snapshot,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()>0',crypto.randomUUID(),g,u.email,action,id,JSON.stringify(snapshot),now());
 if(path==='/activities'&&method==='GET'){
  const rows=(await q(env,'SELECT * FROM kups_activities WHERE group_id=? ORDER BY event_date DESC,id',g).all()).results;
  return json({user:{name:u.name,email:u.email},canManage:manage,events:rows.map(r=>publicRecord(r,u,manage))});
 }
 if(path==='/activities'&&method==='POST'){
  if(!manage)fail(403,'Pengurus atau pendamping diperlukan untuk membuat kegiatan.');
  const b=await body(req),p=validateActivity(b),id=text(b.id,80);
  if(!/^[a-f0-9-]{36}$/.test(id))fail(400,'Identitas kegiatan tidak valid.');
  const old=await q(env,'SELECT * FROM kups_activities WHERE id=?',id).first();
  if(old){if(old.group_id===g&&old.created_by===u.email&&old.payload===JSON.stringify(p))return json({ok:true,id,version:old.version});fail(409,'Kegiatan sudah tersimpan. Muat ulang sebelum mengubah.');}
  await env.DB.batch([q(env,'INSERT INTO kups_activities(id,group_id,event_date,payload,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',id,g,p.date,JSON.stringify(p),u.email,u.email,now(),now()),audit('create',id,p)]);
  return json({ok:true,id,version:1},201);
 }
 const match=path.match(/^\/activities\/([a-zA-Z0-9-]{1,80})(\/self)?$/);
 if(match&&method==='PUT'){
  const [,id,self]=match,b=await body(req),old=await q(env,'SELECT * FROM kups_activities WHERE id=? AND group_id=?',id,g).first();
  if(!old)fail(404,'Kegiatan tidak ditemukan.');
  if(b.version!==old.version)fail(409,'Absensi telah berubah. Muat ulang sebelum menyimpan.');
  let p;
  if(self){
   const previous=JSON.parse(old.payload),person=previous.participants.find(r=>r.email===u.email);
   if(!person)fail(403,'Email Anda belum ditautkan pada peserta kegiatan ini.');
   if(!attendanceStatuses.includes(b.status))fail(400,'Status kehadiran tidak valid.');
   person.status=b.status;person.note=text(b.note||'',300);p=validateActivity(previous);
  }else{
   if(!manage)fail(403,'Pengurus atau pendamping diperlukan untuk mengubah absensi.');
   p=validateActivity(b);
  }
  const results=await env.DB.batch([q(env,'UPDATE kups_activities SET event_date=?,payload=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND group_id=? AND version=?',p.date,JSON.stringify(p),u.email,now(),id,g,b.version),audit(self?'self-attendance':'update',id,{before:JSON.parse(old.payload),after:p})]);
  if(!results[0].meta.changes)fail(409,'Absensi telah berubah. Muat ulang sebelum menyimpan.');
  return json({ok:true,id,version:old.version+1});
 }
 fail(404,'Halaman kegiatan tidak ditemukan.');
}
