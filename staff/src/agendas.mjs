import {fail,now} from './core.mjs';
import {taskDirector} from './tasks.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const member=(a,u)=>a.creator===u.id||JSON.parse(a.participant_ids).includes(u.id);
export function agendaInput(input){
 const text=(key,max)=>{const v=String(input[key]??'').trim();if(v.length>max)fail(400,'Isian '+key+' terlalu panjang.');return v;};
 const a={title:text('title',200),kind:text('kind',20),kind_custom:text('kind_custom',120),program:text('program',120),location:text('location',200),coordinator:text('coordinator',160),start_at:text('start_at',16),end_at:text('end_at',16),participants:text('participants',1000),description:text('description',10000),results:text('results',10000),status:text('status',20)||'scheduled'};
 if(!a.title||!['field','meeting','event','travel','other'].includes(a.kind)||!['scheduled','ongoing','done','cancelled'].includes(a.status))fail(400,'Lengkapi judul, jenis, dan status agenda.');
 for(const key of ['start_at','end_at']){const v=a[key];if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'Z'))||new Date(v+'Z').toISOString().slice(0,16)!==v)fail(400,'Tanggal dan waktu agenda tidak valid.');}
 if(a.end_at<a.start_at)fail(400,'Waktu selesai harus setelah waktu mulai.');return a;
}
export async function agendaApi(req,env,url,u,{payload}){
 const director=taskDirector(u,env),path=url.pathname,method=req.method;
 const people=(await q(env,"SELECT id,name,email FROM users WHERE disabled=0 AND email LIKE ? AND NOT EXISTS(SELECT 1 FROM webgis_access WHERE email=users.email AND scope='kups-finance') ORDER BY name",'%@'+env.GOOGLE_WORKSPACE_DOMAIN).all()).results;
 const read=async id=>{const a=await q(env,'SELECT * FROM team_agendas WHERE id=?',id).first();if(!a)fail(404,'Agenda tidak ditemukan.');if(!director&&!member(a,u))fail(403,'Agenda ini tidak termasuk kegiatan Anda.');return a;};
 if(path==='/api/agendas'&&method==='GET'){const all=director&&url.searchParams.get('scope')==='all';const agendas=(await q(env,'SELECT team_agendas.*,users.name AS creatorName FROM team_agendas JOIN users ON users.id=creator '+(all?'':'WHERE creator=? OR EXISTS(SELECT 1 FROM json_each(participant_ids) WHERE value=?) ')+'ORDER BY start_at DESC',...(all?[]:[u.id,u.id])).all()).results;return Response.json({director,people,agendas});}
 if(path==='/api/agendas'&&method==='POST'){
  const input=await payload(req),a=agendaInput(input);if('participant_ids' in input&&!Array.isArray(input.participant_ids))fail(400,'Pilih anggota tim dengan benar.');const ids=[...new Set([...(director?[]:[u.id]),...(Array.isArray(input.participant_ids)?input.participant_ids:[])])];if(ids.length>30||ids.some(id=>!people.some(p=>p.id===id)))fail(400,'Pilih anggota tim YG yang aktif.');
  const id=crypto.randomUUID(),time=now();await q(env,'INSERT INTO team_agendas(id,creator,title,kind,kind_custom,program,location,coordinator,start_at,end_at,participant_ids,participants,description,results,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.id,a.title,a.kind,a.kind_custom,a.program,a.location,a.coordinator,a.start_at,a.end_at,JSON.stringify(ids),a.participants,a.description,a.results,a.status,time,time).run();return Response.json(await read(id),{status:201});
 }
 const match=/^\/api\/agendas\/([a-z0-9-]+)$/.exec(path);if(!match)fail(404,'Layanan agenda tidak ditemukan.');const a=await read(match[1]);
 if(method==='GET')return Response.json(a);
 if(method==='PUT'){
  const input=await payload(req);if('participant_ids' in input&&!Array.isArray(input.participant_ids))fail(400,'Pilih anggota tim dengan benar.');if(input.version!==a.version)fail(409,'Agenda telah berubah. Muat ulang sebelum menyimpan.');
  const full=director||a.creator===u.id;if(!full&&Object.keys(input).some(k=>!['version','results','status'].includes(k)))fail(403,'Peserta dapat memperbarui hasil dan status. Rincian diubah oleh pembuat agenda atau Direktur.');
  const data=agendaInput({...a,...input}),ids=full&&'participant_ids' in input?[...new Set([...(director?[]:[a.creator]),...input.participant_ids])]:JSON.parse(a.participant_ids);
  if('participant_ids' in input&&(ids.length>30||ids.some(id=>!people.some(p=>p.id===id))))fail(400,'Anggota tim harus staf YG yang aktif.');
  const r=await q(env,'UPDATE team_agendas SET title=?,kind=?,kind_custom=?,program=?,location=?,coordinator=?,start_at=?,end_at=?,participant_ids=?,participants=?,description=?,results=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?',data.title,data.kind,data.kind_custom,data.program,data.location,data.coordinator,data.start_at,data.end_at,JSON.stringify(ids),data.participants,data.description,data.results,data.status,now(),a.id,a.version).run();if(!r.meta.changes)fail(409,'Agenda telah berubah. Muat ulang sebelum menyimpan.');return Response.json(await read(a.id));
 }
 fail(405,'Metode tidak didukung.');
}
