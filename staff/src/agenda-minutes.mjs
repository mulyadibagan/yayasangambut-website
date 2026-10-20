import sanitizeHtml from 'sanitize-html';
import {fail,now} from './core.mjs';
import {taskDirector} from './tasks.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function minutesInput(input){
 if(typeof input.body!=='string'||input.body.length>180000)fail(400,'Isi MoM maksimal 180.000 karakter.');
 if(!['draft','final'].includes(input.status))fail(400,'Status MoM tidak valid.');
 const body=sanitizeHtml(input.body,{allowedTags:['p','br','h2','h3','strong','b','em','i','u','ul','ol','li','blockquote','a','table','thead','tbody','tr','th','td'],allowedAttributes:{a:['href','title']},allowedSchemes:['https','mailto'],allowProtocolRelative:false,transformTags:{a:(tag,attrs)=>({tagName:'a',attribs:{...attrs,rel:'noopener noreferrer',target:'_blank'}})}});
 if(!sanitizeHtml(body,{allowedTags:[],allowedAttributes:{}}).trim())fail(400,'Isi notulen terlebih dahulu.');
 if(!Number.isInteger(input.version)||input.version<0)fail(400,'Versi MoM tidak valid.');
 return {body,status:input.status,version:input.version};
}
export async function minutesApi(req,env,url,u,{payload}){
 const director=taskDirector(u,env),all=director&&url.searchParams.get('scope')==='all';
 if(url.pathname==='/api/agenda-minutes'&&req.method==='GET'){
  const rows=(await q(env,`SELECT m.agenda_id,m.status,m.version FROM agenda_minutes m JOIN team_agendas a ON a.id=m.agenda_id WHERE a.deleted=0 ${all?'':'AND (a.creator=? OR EXISTS(SELECT 1 FROM json_each(a.participant_ids) WHERE value=?))'}`,...(all?[]:[u.id,u.id])).all()).results;
  return Response.json({minutes:rows});
 }
 const id=/^\/api\/agenda-minutes\/([a-z0-9-]+)$/.exec(url.pathname)?.[1];if(!id)fail(404,'MoM tidak ditemukan.');
 const a=await q(env,'SELECT * FROM team_agendas WHERE id=?',id).first();if(!a)fail(404,'Agenda tidak ditemukan.');
 if(!director&&a.creator!==u.id&&!JSON.parse(a.participant_ids).includes(u.id))fail(403,'MoM hanya untuk peserta agenda dan Direktur.');
 const read=()=>q(env,'SELECT m.*,u.name AS author FROM agenda_minutes m JOIN users u ON u.id=m.updated_by WHERE agenda_id=?',id).first();
 if(req.method==='GET')return Response.json({minutes:await read(),history:(await q(env,'SELECT h.*,u.name AS author FROM agenda_minutes_history h JOIN users u ON u.id=h.actor WHERE agenda_id=? ORDER BY version DESC LIMIT 20',id).all()).results});
 if(req.method!=='PUT')fail(405,'Metode tidak didukung.');
 if(a.deleted)fail(409,'Pulihkan agenda sebelum menyunting MoM.');
 const old=await read();if(old?.status==='final'&&!director&&old.updated_by!==u.id&&a.creator!==u.id)fail(403,'MoM final hanya dapat direvisi penyusun terakhir, pembuat agenda, atau Direktur.');
 const input=minutesInput(await payload(req)),time=now(),revision=crypto.randomUUID();
 await q(env,"INSERT OR IGNORE INTO agenda_minutes(agenda_id,updated_by,updated_at) VALUES(?,?,?)",id,u.id,time).run();
 const result=await env.DB.batch([
  q(env,'UPDATE agenda_minutes SET body=?,status=?,version=version+1,revision_id=?,updated_by=?,updated_at=? WHERE agenda_id=? AND version=?',input.body,input.status,revision,u.id,time,id,input.version),
  q(env,'INSERT INTO agenda_minutes_history(id,agenda_id,body,status,version,actor,created_at) SELECT revision_id,agenda_id,body,status,version,updated_by,updated_at FROM agenda_minutes WHERE agenda_id=? AND revision_id=?',id,revision)
 ]);
 if(!result[0].meta.changes)fail(409,'MoM telah diperbarui. Salin perubahan Anda lalu muat ulang.');
 return Response.json({minutes:await read()});
}
