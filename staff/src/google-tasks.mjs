import {sha,now} from './core.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export const tasksScope='https://www.googleapis.com/auth/tasks';
export function taskBody(task,origin,marker){
 const status={todo:'Belum dimulai',doing:'Dikerjakan',review:'Perlu ditinjau',done:'Selesai'}[task.status];
 const note=[task.program&&'Program: '+task.program,'Status portal: '+status,task.description,'Perbarui tugas di '+origin+'/?view=tasks'].filter(Boolean).join('\n\n');
 return {title:task.title,notes:note.slice(0,7800)+'\n\n'+marker,status:task.status==='done'?'completed':'needsAction',due:task.due_date+'T00:00:00.000Z'};
}
async function request(access,path,method='GET',body){
 const r=await fetch('https://tasks.googleapis.com/tasks/v1'+path,{method,headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},signal:AbortSignal.any([access.signal,AbortSignal.timeout(15000)]),...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){const e=new Error('Google Tasks '+r.status);e.status=r.status;throw e;}
 return r.status===204?null:r.json();
}
async function list(access,path){
 const items=[];let page='';
 for(let n=0;n<30;n++){
  const r=await request(access,path+(path.includes('?')?'&':'?')+'maxResults=100'+(page?'&pageToken='+encodeURIComponent(page):''));
  items.push(...(r.items||[]));page=r.nextPageToken;if(!page)return items;
 }
 throw new Error('Daftar terlalu besar untuk diverifikasi dengan aman.');
}
export async function syncTasks(env,c,access){
 if(!c.tasks_enabled)return {changes:0};
 access={token:access,signal:AbortSignal.timeout(60000)};
 try{
  let tasklist=c.tasklist_id;
  // Recover a lost create response using a stable, application-specific list name.
  if(!tasklist){
   const title='Yayasan Gambut — Tugas '+(await sha(env.APP_ORIGIN+':'+c.user_id)).slice(0,8);
   const lists=await list(access,'/users/@me/lists');
   const matches=lists.filter(l=>l.title===title);if(matches.length>1)throw new Error('Daftar YG ganda.');
   tasklist=matches[0]?.id||(await request(access,'/users/@me/lists','POST',{title})).id;
   await q(env,'UPDATE calendar_connections SET tasklist_id=? WHERE user_id=? AND generation=?',tasklist,c.user_id,c.generation).run();
  }
  const path='/lists/'+encodeURIComponent(tasklist)+'/tasks';
  const remote=await list(access,path+'?showCompleted=true&showHidden=true');
  const tasks=(await q(env,'SELECT * FROM team_tasks WHERE archived=0 AND EXISTS(SELECT 1 FROM json_each(assignees) WHERE value=?)',c.user_id).all()).results;
  const saved=(await q(env,'SELECT * FROM google_task_links WHERE user_id=?',c.user_id).all()).results;
  const desired=new Set(tasks.map(t=>t.id));let changes=0,pending=false;
  // Only delete copies explicitly recorded as managed by this application.
  for(const m of saved){
   if(desired.has(m.source_id))continue;if(changes>=20){pending=true;break;}
   try{await request(access,path+'/'+encodeURIComponent(m.task_id),'DELETE');}catch(e){if(![404,410].includes(e.status))throw e;}
   await q(env,'DELETE FROM google_task_links WHERE user_id=? AND source_id=?',c.user_id,m.source_id).run();changes++;
  }
  for(const task of tasks){
   const marker='[YG:'+await sha(env.APP_ORIGIN+':'+c.user_id+':'+task.id)+']';
   const body=taskBody(task,env.APP_ORIGIN,marker),hash=await sha(JSON.stringify(body));
   const m=saved.find(x=>x.source_id===task.id);
   // Tasks API assigns IDs: recover a successful POST whose response was lost.
   const existing=remote.find(x=>x.id===m?.task_id)||remote.find(x=>(x.notes||'').endsWith(marker));
   if(existing&&m?.content_hash===hash)continue;
   if(changes>=20){pending=true;break;}
   let id=existing?.id;
   if(id)await request(access,path+'/'+encodeURIComponent(id),'PATCH',body);
   else id=(await request(access,path,'POST',body)).id;
   await q(env,'INSERT INTO google_task_links(user_id,source_id,task_id,content_hash) VALUES(?,?,?,?) ON CONFLICT(user_id,source_id) DO UPDATE SET task_id=excluded.task_id,content_hash=excluded.content_hash',c.user_id,task.id,id,hash).run();changes++;
  }
  await q(env,"UPDATE calendar_connections SET tasks_last_synced=?,tasks_error='' WHERE user_id=? AND generation=?",pending?c.tasks_last_synced:now(),c.user_id,c.generation).run();return {changes,pending};
 }catch(e){
  const error=e.status===403?'Google Tasks menolak akses. Periksa aktivasi Tasks API dan izin Google Tasks.':e.status===401?'Izin Google Tasks berakhir. Hubungkan kembali.':e.status===404?'Daftar Google Tasks YG tidak ditemukan. Hubungi administrator untuk memulihkan koneksi.':'Google Tasks belum berhasil disinkronkan. Sistem akan mencoba kembali.';
  await q(env,'UPDATE calendar_connections SET tasks_error=? WHERE user_id=? AND generation=?',error,c.user_id,c.generation).run();return {error};
 }
}
