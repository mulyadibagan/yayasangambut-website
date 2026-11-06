import {createHash} from 'node:crypto';
import {fail,now,HttpError} from './core.mjs';
import {taskDirector} from './tasks.mjs';
import {driveAccess,google} from './agenda-drive.mjs';
import {openTimesheet,collectTimesheetSources,patchTimesheet} from './timesheet-workbook.mjs';
import {translateBatch} from './translation.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const mime='application/vnd.ms-excel.sheet.macroEnabled.12';
const md5=bytes=>createHash('md5').update(bytes).digest('hex');
export function adoptSourceActivities(book,sources,managed){
 const result={...managed},strip=value=>String(value).split('\n').map(line=>line.replace(/^\[[^\]]*\]\s*/,'').trim()).filter(Boolean).sort().join('\n');
 for(const sheet of book.sheets)for(const [date,row] of sheet.dates){const key=sheet.path+'|B'+row,cell=sheet.cells.get('B'+row),expected=[...new Set(sources.filter(s=>s.date===date).map(s=>s.title+(s.program?' · '+s.program:'')))].join('\n');if(!(key in result)&&expected&&cell&&!cell.formula&&strip(cell.value)===strip(expected))result[key]=cell.value;}
 return result;
}
export async function englishTimesheetText(env,sources,entries){
 const texts=[...new Set([...sources.map(s=>s.title.replace(/^\[[^\]]*\]\s*/,'')),...entries.map(e=>e.activity)])];
 const translations=new Map(),pending=[];
 for(const text of texts){
  const key='timesheets/english/v1/'+createHash('sha256').update(text).digest('hex')+'.txt',cached=await env.MEDIA?.get?.(key);
  if(cached){translations.set(text,await cached.text());continue;}
  pending.push({text,key});
 }
 while(pending.length){
  if(!env.AI)fail(503,'Terjemahan Inggris timesheet belum tersedia. Excel belum diubah.');
  const batch=[];let size=0;while(pending.length&&batch.length<25&&(!batch.length||size+pending[0].text.length<=5500)){const item=pending.shift();batch.push(item);size+=item.text.length;}
  const values=await translateBatch(env.AI,batch.map((item,i)=>({id:'s'+i,text:item.text})));
  for(const [i,item] of batch.entries()){translations.set(item.text,values['s'+i]);await env.MEDIA?.put(item.key,values['s'+i],{httpMetadata:{contentType:'text/plain; charset=utf-8'}});}
 }
 return {sources:sources.map(s=>({...s,title:s.title.replace(/^(\[[^\]]*\]\s*)?(.*)$/,(_,prefix='',text)=>prefix+translations.get(text))})),entries:entries.map(e=>({...e,activity:translations.get(e.activity)}))};
}
// Timesheet destinations cover organizational employees, including staff who
// also use KUPS. This does not change their login scope or portal permissions.
const staffList=async env=>(await q(env,"SELECT id,name,email FROM users WHERE disabled=0 AND email LIKE ? ORDER BY name",'%@'+env.GOOGLE_WORKSPACE_DOMAIN).all()).results;
export function timesheetFileId(input){const s=String(input||'').trim(),id=/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d|spreadsheets\/d)\/([\w-]+)/.exec(s)?.[1]||s;if(!/^[\w-]{15,120}$/.test(id))fail(400,'Masukkan tautan file Excel Drive yang benar.');return id;}
export function actualInput(input){
 const date=String(input.work_date||''),program=String(input.program||'').trim(),activity=String(input.activity||'').trim(),hours=Number(input.hours),today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today||!program||program.length>120||!activity||activity.length>4000||!Number.isFinite(hours)||hours<=0||hours>24||Math.abs(Math.round(hours*100)-hours*100)>1e-8||input.confirmed!==true)fail(400,'Isi tanggal pelaksanaan, program, uraian dan jam aktual (maksimal dua desimal), lalu konfirmasi. Tanggal mendatang tidak boleh dianggap aktual.');
 return {work_date:date,program,activity,hours};
}
async function workbookFile(access,id){
 const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields=id,name,mimeType,trashed,md5Checksum,size,version,capabilities(canEdit)',{headers:{Authorization:'Bearer '+access}});
 if(!metadata.ok)fail(409,'File timesheet belum dapat diakses dengan koneksi Drive Ruang Staf.');const file=await metadata.json();
 if(file.trashed||!file.capabilities?.canEdit||file.mimeType.toLowerCase()!==mime.toLowerCase()||Number(file.size)>4*1024*1024)fail(409,'Timesheet harus berupa XLSM yang dapat disunting dan berukuran maksimal 4 MB.');
 const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media&supportsAllDrives=true',{headers:{Authorization:'Bearer '+access}});if(!response.ok)fail(502,'File Excel belum dapat dibaca.');
 const bytes=new Uint8Array(await response.arrayBuffer());if(md5(bytes)!==file.md5Checksum)fail(409,'File berubah saat dibaca. Coba lagi.');return {file,bytes,etag:metadata.headers.get('etag')};
}
async function sourcesFor(env,user){
 const tasks=(await q(env,"SELECT id,title,program,due_date,status FROM team_tasks WHERE archived=0 AND EXISTS(SELECT 1 FROM json_each(assignees) WHERE value=?)",user).all()).results;
 const agendas=(await q(env,"SELECT id,title,program,start_at,end_at,status FROM team_agendas WHERE deleted=0 AND status!='cancelled' AND EXISTS(SELECT 1 FROM json_each(participant_ids) WHERE value=?)",user).all()).results;
 return collectTimesheetSources(tasks,agendas);
}
export async function syncTimesheet(env,user){
 const lease=Date.now()+120000,config=await q(env,'UPDATE team_timesheet_files SET lock_until=?,last_attempt=? WHERE user_id=? AND enabled=1 AND lock_until<? RETURNING *',lease,now(),user,Date.now()).first();if(!config)fail(409,'Timesheet belum dihubungkan atau sedang disinkronkan.');
 try{
  const {access}=await driveAccess(env),original=await workbookFile(access,config.file_id),sources=await sourcesFor(env,user),entries=(await q(env,'SELECT * FROM team_timesheet_days WHERE user_id=? ORDER BY work_date,program',user).all()).results;
  const book=openTimesheet(original.bytes),dates=new Set(book.sheets.flatMap(s=>[...s.dates.keys()])),inside=sources.filter(s=>dates.has(s.date));
  // Adopt only existing activity text that exactly matches this day's source
  // descriptions. Any additional manual notes or numeric hours stay protected.
  const managed=adoptSourceActivities(book,inside,JSON.parse(config.managed_json));
  const english=await englishTimesheetText(env,inside,entries);
  const result=patchTimesheet(original.bytes,english.sources,english.entries,managed);result.outside+=sources.length-inside.length;
  if(result.changes){
   if(!env.MEDIA)fail(503,'Penyimpanan cadangan belum tersedia.');
   await env.MEDIA.put('timesheets/backups/'+config.file_id+'/'+original.file.md5Checksum+'.xlsm',original.bytes,{httpMetadata:{contentType:mime}});
   const current=await google(access,'/drive/v3/files/'+encodeURIComponent(config.file_id)+'?supportsAllDrives=true&fields=md5Checksum,version');
   if(current.md5Checksum!==original.file.md5Checksum||current.version!==original.file.version)fail(409,'Excel baru saja diubah. Sinkronisasi ditunda agar isian manual tidak tertimpa.');
   let etag=original.etag,driveVersion='v3';
   // Drive v2 exposes the file entity tag explicitly. When v3 omits its
   // header, read and update the same v2 resource with that conditional tag.
   if(!etag){const v2=await google(access,'/drive/v2/files/'+encodeURIComponent(config.file_id)+'?supportsAllDrives=true&fields=etag,md5Checksum,version');if(v2.md5Checksum!==original.file.md5Checksum||v2.version!==original.file.version)fail(409,'Excel baru saja diubah. Sinkronisasi ditunda agar isian manual tidak tertimpa.');etag=v2.etag;driveVersion='v2';}
   if(!etag)fail(409,'Google belum menyediakan penanda versi untuk pembaruan aman. File asli tidak diubah.');
   // Conditional write uses the Drive entity tag where supplied, plus the file-version check above.
   const response=await fetch('https://www.googleapis.com/upload/drive/'+driveVersion+'/files/'+encodeURIComponent(config.file_id)+'?uploadType=media&supportsAllDrives=true&fields=id,md5Checksum',{method:driveVersion==='v2'?'PUT':'PATCH',headers:{Authorization:'Bearer '+access,'Content-Type':mime,'If-Match':etag},body:result.bytes});
   if(!response.ok)fail(response.status===412?409:502,'Penyimpanan Excel belum berhasil (HTTP '+response.status+'). Cadangan file asli tersedia.');const saved=await response.json();if(saved.md5Checksum!==md5(result.bytes))fail(502,'Isi Excel tersimpan belum dapat diverifikasi. Periksa file sebelum mencoba lagi.');
  }
  await q(env,"UPDATE team_timesheet_files SET managed_json=?,last_synced=?,last_error='' WHERE user_id=? AND lock_until=?",JSON.stringify(result.managed),now(),user,lease).run();
  return {changedCells:result.changes,sources:sources.length,outside:result.outside,unresolved:result.unresolved,sheets:result.sheets,url:'https://drive.google.com/file/d/'+config.file_id+'/view'};
 }catch(e){await q(env,'UPDATE team_timesheet_files SET last_error=? WHERE user_id=? AND lock_until=?',String(e.message||'Sinkronisasi belum berhasil.').slice(0,500),user,lease).run();if(!(e instanceof HttpError))fail(409,String(e.message||'Sinkronisasi belum berhasil.').slice(0,500));throw e;}finally{await q(env,'UPDATE team_timesheet_files SET lock_until=0 WHERE user_id=? AND lock_until=?',user,lease).run();}
}
export async function syncTeamTimesheets(env){
 const configs=(await q(env,"SELECT t.user_id FROM team_timesheet_files t JOIN users u ON u.id=t.user_id WHERE t.enabled=1 AND u.disabled=0 AND t.lock_until<? AND (t.last_attempt IS NULL OR t.last_attempt<?) ORDER BY t.last_attempt LIMIT 5",Date.now(),new Date(Date.now()-10*60000).toISOString()).all()).results;
 for(const c of configs)await syncTimesheet(env,c.user_id).catch(()=>{});
}
export async function timesheetApi(req,env,url,u,{payload}){
 const director=taskDirector(u,env),staff=await staffList(env),user=url.searchParams.get('staff')||u.id;
 if(!staff.some(s=>s.id===user)||!director&&user!==u.id)fail(403,'Timesheet staf ini tidak dapat diakses.');
 const path=url.pathname,config=await q(env,'SELECT user_id,file_id,enabled,last_synced,last_error FROM team_timesheet_files WHERE user_id=?',user).first();
 if(path==='/api/timesheets'&&req.method==='GET')return Response.json({director,staff:director?staff:staff.filter(s=>s.id===u.id),user,config,sources:await sourcesFor(env,user),entries:(await q(env,'SELECT work_date,program,hours,activity,updated_at FROM team_timesheet_days WHERE user_id=? ORDER BY work_date,program',user).all()).results});
 if(path==='/api/timesheets/enabled'&&req.method==='POST'){
  const input=await payload(req);if(!config||typeof input.enabled!=='boolean')fail(400,'Koneksi timesheet tidak valid.');
  const result=await q(env,'UPDATE team_timesheet_files SET enabled=?,updated_at=? WHERE user_id=? AND lock_until<?',Number(input.enabled),now(),user,Date.now()).run();if(!result.meta.changes)fail(409,'Tunggu sinkronisasi selesai, lalu coba kembali.');
  return Response.json({enabled:input.enabled});
 }
 if(path==='/api/timesheets/connect'&&req.method==='POST'){
  if(!director)fail(403,'Hanya Direktur dapat menghubungkan file timesheet.');const input=await payload(req),file=timesheetFileId(input.url);const existing=await q(env,'SELECT user_id FROM team_timesheet_files WHERE file_id=? AND user_id!=?',file,user).first();if(existing)fail(409,'File ini sudah terhubung ke staf lain.');
  const {access}=await driveAccess(env),original=await workbookFile(access,file),book=openTimesheet(original.bytes);
  const old=await q(env,'SELECT file_id,lock_until FROM team_timesheet_files WHERE user_id=?',user).first();if(old?.lock_until>Date.now())fail(409,'Tunggu sinkronisasi selesai sebelum mengubah koneksi.');if(old&&old.file_id!==file)fail(409,'Timesheet sudah terhubung ke file lain. Hubungi administrator untuk mengganti file.');
  await q(env,"INSERT INTO team_timesheet_files(user_id,file_id,configured_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=1,updated_at=excluded.updated_at",user,file,u.id,now()).run();
  await q(env,'INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',u.id,'timesheet_connected',user,now()).run();
  return Response.json({connected:true,name:original.file.name,sheets:book.sheets.map(s=>({name:s.name,programs:Object.keys(s.columns)})),...await syncTimesheet(env,user)});
 }
 if(path==='/api/timesheets/sync'&&req.method==='POST')return Response.json(await syncTimesheet(env,user));
 if(path==='/api/timesheets/actual'&&req.method==='POST'){
  if(!config?.enabled)fail(409,'Aktifkan koneksi file timesheet terlebih dahulu.');const entry=actualInput(await payload(req));
  const {access}=await driveAccess(env),original=await workbookFile(access,config.file_id),sheet=openTimesheet(original.bytes).sheets.find(s=>s.dates.has(entry.work_date));if(!sheet||!sheet.columns[entry.program])fail(400,'Tanggal atau kolom program tidak tersedia pada template Excel staf ini.');
  const others=await q(env,'SELECT COALESCE(SUM(hours),0) AS total FROM team_timesheet_days WHERE user_id=? AND work_date=? AND program!=?',user,entry.work_date,entry.program).first();if(others.total+entry.hours>24)fail(400,'Total jam aktual per hari melebihi 24 jam.');
  await q(env,'INSERT INTO team_timesheet_days VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,work_date,program) DO UPDATE SET hours=excluded.hours,activity=excluded.activity,confirmed_by=excluded.confirmed_by,updated_at=excluded.updated_at',user,entry.work_date,entry.program,entry.hours,entry.activity,u.id,now()).run();
  await q(env,'INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',u.id,'timesheet_actual_confirmed',user+':'+entry.work_date+':'+entry.program,now()).run();
  return Response.json({saved:true,...await syncTimesheet(env,user)});
 }
 fail(405,'Layanan timesheet tidak didukung.');
}
