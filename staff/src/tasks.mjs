import {fail,now,imageType} from './core.mjs';
const json=(value,status=200)=>Response.json(value,{status});
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const taskDirector=(u,env)=>u.role==='admin'&&u.email.toLowerCase()===String(env.ADMIN_EMAIL||'').toLowerCase();
export const taskMember=(task,u)=>task.creator===u.id||JSON.parse(task.assignees).includes(u.id);
const statusLabels={todo:'Belum dimulai',doing:'Dikerjakan',review:'Perlu ditinjau',done:'Selesai'};
function text(input,key,max,required=false){const value=String(input[key]??'').trim();if(value.length>max||required&&!value)fail(400,'Lengkapi '+key+' dengan benar.');return value;}
export function taskInput(input){
 const title=text(input,'title',200,true),description=text(input,'description',10000),program=text(input,'program',120),location=text(input,'location',160),due_date=text(input,'due_date',10,true);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due_date)||!Number.isFinite(Date.parse(due_date))||new Date(due_date).toISOString().slice(0,10)!==due_date)fail(400,'Tenggat harus berupa tanggal yang valid.');
 const priority=input.priority||'normal',status=input.status||'todo';
 if(!['low','normal','high'].includes(priority)||!Object.hasOwn(statusLabels,status))fail(400,'Prioritas atau status tidak valid.');
 return {title,description,program,location,due_date,priority,status};
}
async function people(env){return (await q(env,"SELECT id,name,email FROM users WHERE disabled=0 AND email LIKE ? AND NOT EXISTS(SELECT 1 FROM webgis_access a WHERE a.email=users.email AND a.scope='kups-finance') ORDER BY name",'%@'+env.GOOGLE_WORKSPACE_DOMAIN).all()).results;}
async function assignments(env,input,u,director){
 if(!director){if(input.assignees&&(!Array.isArray(input.assignees)||input.assignees.length!==1||input.assignees[0]!==u.id))fail(403,'Staf hanya dapat membuat tugas untuk dirinya sendiri.');return [u.id];}
 if(!Array.isArray(input.assignees)||!input.assignees.length||input.assignees.length>20||input.assignees.some(id=>typeof id!=='string'))fail(400,'Pilih penanggung jawab tugas.');
 const ids=[...new Set(input.assignees)],active=await people(env);if(ids.some(id=>!active.some(p=>p.id===id)))fail(400,'Penanggung jawab harus staf YG yang aktif dan sudah login.');return ids;
}
function access(task,u,director){if(!task)fail(404,'Tugas tidak ditemukan.');if(!director&&!taskMember(task,u))fail(403,'Tugas ini tidak termasuk penugasan Anda.');}
function decorate(task,people){const name=id=>people.find(p=>p.id===id)?.name||'Staf YG';return {...task,assignees:JSON.parse(task.assignees),assigneeNames:JSON.parse(task.assignees).map(name),creatorName:name(task.creator),assignedByName:name(task.assigned_by)};}
async function detail(env,task,staff){return {...decorate(task,staff),updates:(await q(env,'SELECT task_updates.*,users.name AS actorName FROM task_updates JOIN users ON users.id=actor WHERE task_id=? ORDER BY created_at DESC,id DESC',task.id).all()).results,files:(await q(env,'SELECT task_files.*,users.name AS actorName FROM task_files JOIN users ON users.id=actor WHERE task_id=? ORDER BY created_at DESC',task.id).all()).results};}
async function event(env,taskId,u,kind,body){await q(env,'INSERT INTO task_updates VALUES(?,?,?,?,?,?)',crypto.randomUUID(),taskId,u.id,kind,body,now()).run();}
export async function taskApi(req,env,url,u,{payload,readLimited}){
 const director=taskDirector(u,env),path=url.pathname,method=req.method;
 if(path==='/api/tasks'&&method==='GET'){
  const staff=await people(env),all=director&&url.searchParams.get('scope')==='all',archive=url.searchParams.get('archive')==='1';
  const tasks=(await q(env,'SELECT * FROM team_tasks WHERE archived=? '+(all?'':'AND (creator=? OR EXISTS(SELECT 1 FROM json_each(assignees) WHERE value=?)) ')+'ORDER BY CASE status WHEN \'done\' THEN 1 ELSE 0 END,due_date,created_at DESC',Number(archive),...(all?[]:[u.id,u.id])).all()).results;
  return json({director,people:director?staff:staff.filter(p=>p.id===u.id),tasks:tasks.map(t=>decorate(t,staff))});
 }
 if(path==='/api/tasks'&&method==='POST'){
  const input=await payload(req),data=taskInput(input),assignees=await assignments(env,input,u,director),id=crypto.randomUUID(),time=now();
  if(!director&&data.status!=='todo')fail(400,'Tugas baru dimulai dengan status Belum dimulai.');
  await env.DB.batch([q(env,'INSERT INTO team_tasks(id,creator,assigned_by,title,description,program,location,assignees,due_date,priority,status,mutation_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,u.id,u.id,data.title,data.description,data.program,data.location,JSON.stringify(assignees),data.due_date,data.priority,data.status,crypto.randomUUID(),time,time),q(env,'INSERT INTO task_updates VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,u.id,'created',director?'Tugas dibuat dan ditugaskan oleh Direktur.':'Tugas dibuat oleh staf.',time)]);
  return json(await detail(env,await q(env,'SELECT * FROM team_tasks WHERE id=?',id).first(),await people(env)),201);
 }
 const match=/^\/api\/tasks\/([a-f0-9-]+)(?:\/(comments|files)(?:\/([a-f0-9-]+))?)?$/.exec(path);if(!match)fail(404,'Layanan tugas tidak ditemukan.');
 const [,id,action,fileId]=match,task=await q(env,'SELECT * FROM team_tasks WHERE id=?',id).first();access(task,u,director);
 if(!action&&method==='GET')return json(await detail(env,task,await people(env)));
 if(!action&&method==='PUT'){
  const input=await payload(req);if(!Number.isInteger(input.version)||input.version!==task.version)fail(409,'Tugas sudah diperbarui. Muat ulang sebelum menyimpan.');
  if(task.archived&&input.archived!==false)fail(409,'Pulihkan tugas sebelum memperbarui.');
  const full=director||(task.creator===u.id&&task.assigned_by===u.id);
  const data=taskInput({...task,...input}),assignees=full&&'assignees' in input?await assignments(env,input,u,director):JSON.parse(task.assignees);
  if(!full&&['title','description','program','location','due_date','priority','assignees','archived'].some(k=>k in input&&JSON.stringify(input[k])!==JSON.stringify(k==='assignees'?JSON.parse(task[k]):task[k])))fail(403,'Penugasan hanya dapat diubah oleh Direktur.');
  if(!director&&task.assigned_by!==u.id&&data.status==='done')fail(403,'Ajukan untuk ditinjau. Direktur menandai penugasan ini selesai.');
  if(!director&&task.assigned_by!==u.id&&task.status==='done')fail(403,'Tugas telah selesai. Hubungi Direktur untuk membuka kembali.');
  if('archived' in input&&typeof input.archived!=='boolean')fail(400,'Status arsip tidak valid.');
  const archived='archived' in input?Number(input.archived):task.archived,mutation=crypto.randomUUID(),time=now();
  const body=archived!==task.archived?(archived?'Tugas diarsipkan.':'Tugas dipulihkan.'):(data.status!==task.status?'Status: '+statusLabels[data.status]+'.':'Rincian penugasan diperbarui.');
  const results=await env.DB.batch([q(env,'UPDATE team_tasks SET title=?,description=?,program=?,location=?,assigned_by=?,assignees=?,due_date=?,priority=?,status=?,archived=?,version=version+1,mutation_id=?,updated_at=? WHERE id=? AND version=?',data.title,data.description,data.program,data.location,director&&JSON.stringify(assignees)!==task.assignees?u.id:task.assigned_by,JSON.stringify(assignees),data.due_date,data.priority,data.status,archived,mutation,time,id,task.version),q(env,'INSERT INTO task_updates SELECT ?,id,?,?,?,? FROM team_tasks WHERE id=? AND mutation_id=?',crypto.randomUUID(),u.id,'changed',body,time,id,mutation)]);
  if(!results[0].meta.changes)fail(409,'Tugas sudah diperbarui. Muat ulang sebelum menyimpan.');
  return json(await detail(env,await q(env,'SELECT * FROM team_tasks WHERE id=?',id).first(),await people(env)));
 }
 if(action==='comments'&&method==='POST'){
  if(task.archived)fail(409,'Pulihkan tugas sebelum menambahkan catatan.');
  const input=await payload(req),body=text(input,'body',4000,true);await event(env,id,u,'comment',body);return json(await detail(env,task,await people(env)),201);
 }
 if(action==='files'&&method==='POST'&&!fileId){
  if(task.archived)fail(409,'Pulihkan tugas sebelum menambahkan lampiran.');
  if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');
  const bytes=await readLimited(req,5*1024*1024);if(!bytes.length)fail(400,'Pilih berkas lampiran.');
  const type=imageType(bytes)||(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':null);if(!type)fail(400,'Lampiran harus PDF, JPEG, PNG, atau WebP.');
  let filename;try{filename=decodeURIComponent(req.headers.get('X-Filename')||'Lampiran').replace(/[\r\n"\\/]/g,'_').slice(0,180);}catch{fail(400,'Nama berkas tidak valid.');}
  const fileId=crypto.randomUUID();await env.MEDIA.put('tasks/'+fileId,bytes,{httpMetadata:{contentType:type}});
  try{await q(env,'INSERT INTO task_files VALUES(?,?,?,?,?,?,?)',fileId,id,u.id,filename,type,bytes.length,now()).run();}catch(e){await env.MEDIA.delete('tasks/'+fileId);throw e;}
  return json(await detail(env,task,await people(env)),201);
 }
 if(action==='files'&&method==='GET'&&fileId){
  const file=await q(env,'SELECT * FROM task_files WHERE id=? AND task_id=?',fileId,id).first();if(!file)fail(404,'Lampiran tidak ditemukan.');
  const object=await env.MEDIA.get('tasks/'+fileId);if(!object)fail(404,'Lampiran tidak ditemukan.');
  return new Response(object.body,{headers:{'Content-Type':file.type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename),'Cache-Control':'private, no-store'}});
 }
 fail(405,'Metode tidak didukung.');
}
