import {fail,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
import {advancesPage} from './advances-page.mjs';

const applicants=new Set(['mulyadi@yayasangambut.org','zamharier@yayasangambut.org','rienaprasiddha@yayasangambut.org']);
export const advanceAccess=u=>!!u&&!u.disabled&&applicants.has(u.email?.toLowerCase());
export const advanceFinance=u=>advanceAccess(u)&&u.email.toLowerCase()==='rienaprasiddha@yayasangambut.org';
const director=u=>advanceAccess(u)&&financeOwner(u);
const manager=u=>director(u)||advanceFinance(u);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const string=(v,max=500,required=true)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Lengkapi isian teks sesuai batas yang tersedia.');return v.trim();};
function date(v){if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail(400,'Tanggal tidak valid.');return v;}
function amount(v,zero=false){if(!Number.isSafeInteger(v)||v<(zero?0:1)||v>10000000000)fail(400,'Nominal harus rupiah bulat dan tidak melebihi Rp10 miliar.');return v;}
export function advanceInput(body,report=false){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Data pengajuan tidak valid.');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)fail(400,'Isi 1–100 rincian biaya.');
 let total=0;
 const items=body.items.map(row=>{
  if(!row||typeof row!=='object')fail(400,'Rincian biaya tidak valid.');
  const description=string(row.description),unit=string(row.unit,60),quantity=row.quantity,days=row.days,rate=amount(row.rate,report);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000||Math.abs(Math.round(quantity*100)-quantity*100)>0.000001||!Number.isSafeInteger(days)||days<1||days>3660)fail(400,'Volume maksimal dua desimal dan hari harus bilangan bulat positif.');
  const subtotal=Math.round(quantity*days*rate);amount(subtotal,report);total+=subtotal;
  return {description,unit,quantity,days,rate,subtotal,...(report?{date:date(row.date)}:{})};
 });
 amount(total,report);
 if(report)return {items,total,notes:string(body.notes||'',4000,false)};
 const start=date(body.start),end=date(body.end);if(end<start)fail(400,'Tanggal akhir mendahului tanggal mulai.');
 return {project:string(body.project,160),activity:string(body.activity,240),location:string(body.location,240),start,end,notes:string(body.notes||'',4000,false),items,total};
}
const own=(u,row)=>row.creator===u.id;
function visible(u,row){if(!manager(u)&&!own(u,row))fail(403,'Pengajuan hanya dapat dibuka pengaju, Bagian Keuangan, dan Direktur.');}
const number=row=>'UM-'+row.created_at.slice(0,4)+'-'+String(row.seq).padStart(5,'0');
function serialize(row){return {...row,number:number(row),payload:JSON.parse(row.payload),report:row.report?JSON.parse(row.report):null};}
async function read(env,id){const r=await q(env,'SELECT * FROM yg_advance_requests WHERE id=?',id).first();if(!r)fail(404,'Pengajuan tidak ditemukan.');return r;}
async function detail(env,row){return {...serialize(row),files:(await q(env,'SELECT id,purpose,filename,mime,size,actor_email,created_at FROM yg_advance_files WHERE request_id=? ORDER BY created_at',row.id).all()).results,events:(await q(env,'SELECT actor_email,action,version,snapshot,created_at FROM yg_advance_events WHERE request_id=? ORDER BY version',row.id).all()).results.map(r=>({...r,snapshot:JSON.parse(r.snapshot)}))};}
async function input(req){let size=0;const chunks=[];const reader=req.body?.getReader();if(!reader)fail(400,'Data kosong.');while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>150000){await reader.cancel();fail(413,'Data terlalu besar.');}chunks.push(r.value);}try{const out=new Uint8Array(size);let n=0;for(const c of chunks){out.set(c,n);n+=c.length;}return JSON.parse(new TextDecoder().decode(out));}catch{fail(400,'Data tidak valid.');}}
export function advanceTransition(u,row,action){
 const state=row.status;
 const rules={submit:[own(u,row),['draft','returned'],'submitted'],check:[advanceFinance(u),['submitted'],'checked'],approve:[director(u),['checked'],'approved'],disburse:[advanceFinance(u),['approved'],'disbursed'],report:[own(u,row),['disbursed','pjum_returned','pjum_draft'],'pjum_draft'],report_submit:[own(u,row),['pjum_draft'],'pjum_submitted'],report_check:[advanceFinance(u),['pjum_submitted'],'pjum_checked'],report_approve:[director(u),['pjum_checked'],row.actual===row.total?'closed':'settlement'],settle:[advanceFinance(u),['settlement'],'closed'],cancel:[own(u,row),['draft','returned'],'cancelled']};
 if(action==='return')return advanceFinance(u)&&['submitted'].includes(state)||director(u)&&['checked'].includes(state)?'returned':fail(403,'Pengajuan tidak dapat dikembalikan pada tahap ini.');
 if(action==='report_return')return advanceFinance(u)&&state==='pjum_submitted'||director(u)&&state==='pjum_checked'?'pjum_returned':fail(403,'PJUM tidak dapat dikembalikan pada tahap ini.');
 const rule=rules[action];if(!rule)fail(400,'Tindakan tidak dikenal.');if(!rule[0])fail(403,'Anda tidak memiliki kewenangan untuk tindakan ini.');if(!rule[1].includes(state))fail(409,'Status telah berubah atau belum memenuhi tahapan. Muat ulang pengajuan.');return rule[2];
}
async function mutate(env,row,u,action,changes,snapshot={}){
 const event=crypto.randomUUID(),at=now(),fields=Object.keys(changes);const allowed=new Set(['status','payload','total','report','actual','paid_date','payment_reference','settlement_reference','note']);if(fields.some(k=>!allowed.has(k)))throw Error('Invalid advance mutation');
 try{
  const result=await env.DB.batch([
   q(env,'UPDATE yg_advance_requests SET '+fields.map(k=>k+'=?').join(',')+',version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',...fields.map(k=>changes[k]),event,at,row.id,row.version),
   q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_advance_requests WHERE id=? AND last_event=?',event,u.email,action,JSON.stringify(snapshot),row.id,event)
  ]);if(!result[0].meta.changes)fail(409,'Pengajuan telah diubah. Muat ulang sebelum menyimpan.');
 }catch(e){if(String(e.message).includes('UNIQUE constraint failed'))fail(409,'Referensi pembayaran sudah digunakan.');throw e;}
 return read(env,row.id);
}
const uploadAllowed=(u,row,purpose)=>purpose==='um'?own(u,row)&&['draft','returned'].includes(row.status):purpose==='pjum'?own(u,row)&&['disbursed','pjum_returned','pjum_draft'].includes(row.status):purpose==='payment'?advanceFinance(u)&&row.status==='approved':purpose==='settlement'?advanceFinance(u)&&row.status==='settlement':false;
async function proof(env,id,purpose){if(!await q(env,'SELECT id FROM yg_advance_files WHERE request_id=? AND purpose=?',id,purpose).first())fail(400,'Unggah dokumen pendukung '+({pjum:'PJUM',payment:'pencairan',settlement:'penyelesaian'}[purpose]||'UM')+' terlebih dahulu.');}
export async function advancesRoute(req,env,u){
 if(!advanceAccess(u))fail(403,'Pengajuan UM hanya tersedia untuk Mulyadi, Zamharir, dan Riena.');
 if(req.method!=='GET'&&req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Asal permintaan tidak valid.');
 const path=new URL(req.url).pathname,prefix='/finance/advances';
 if([prefix,prefix+'/'].includes(path)&&req.method==='GET')return new Response(advancesPage(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 if(path===prefix+'/api/me'&&req.method==='GET')return json({id:u.id,name:u.name,email:u.email,director:director(u),finance:advanceFinance(u),payroll:manager(u),dashboard:manager(u)});
 if(path===prefix+'/api'){
  if(req.method==='GET'){const rows=(await q(env,'SELECT * FROM yg_advance_requests '+(manager(u)?'':'WHERE creator=? ')+'ORDER BY seq DESC LIMIT 500',...(manager(u)?[]:[u.id])).all()).results;return json(rows.map(serialize));}
  if(req.method==='POST'){
   const data=advanceInput(await input(req)),id=crypto.randomUUID(),event=crypto.randomUUID(),at=now();
   await env.DB.batch([q(env,'INSERT INTO yg_advance_requests(id,creator,creator_email,creator_name,payload,total,last_event,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',id,u.id,u.email,u.name,JSON.stringify(data),data.total,event,at,at),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) VALUES(?,?,?,?,1,?,?)',event,id,u.email,'created',JSON.stringify(data),at)]);
   return json(await detail(env,await read(env,id)),201);
  }
  fail(405,'Metode tidak didukung.');
 }
 const match=path.match(/^\/finance\/advances\/api\/([a-f0-9-]{36})(?:\/(files|[a-z_]+)(?:\/([a-f0-9-]{36}))?)?$/);if(!match)fail(404,'Halaman tidak ditemukan.');
 const [,id,action,fileId]=match,row=await read(env,id);visible(u,row);
 if(action==='files'&&fileId&&req.method==='GET'){
  const file=await q(env,'SELECT * FROM yg_advance_files WHERE id=? AND request_id=?',fileId,id).first();if(!file)fail(404,'Berkas tidak ditemukan.');const object=await env.MEDIA.get(file.storage_key);if(!object)fail(404,'Berkas belum tersedia.');
  return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(!action&&req.method==='GET')return json(await detail(env,row));
 if(action==='files'&&!fileId&&req.method==='POST'){
  const url=new URL(req.url),purpose=url.searchParams.get('purpose');if(!uploadAllowed(u,row,purpose))fail(403,'Lampiran tidak dapat ditambahkan pada tahap ini.');
  if(Number(url.searchParams.get('version'))!==row.version)fail(409,'Pengajuan berubah. Muat ulang.');
  const name=string(url.searchParams.get('name'),180),reader=req.body?.getReader();if(!reader)fail(400,'Berkas kosong.');let size=0;const chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>5*1024*1024){await reader.cancel();fail(413,'Berkas maksimal 5 MB.');}chunks.push(r.value);}if(!size)fail(400,'Berkas kosong.');const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
  const mime=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':null;
  if(!mime)fail(400,'Gunakan PDF, JPG, atau PNG.');if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');
  const fid=crypto.randomUUID(),key='advances/'+id+'/'+fid,event=crypto.randomUUID(),at=now();await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{const out=await env.DB.batch([q(env,'UPDATE yg_advance_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',event,at,id,row.version),q(env,'INSERT INTO yg_advance_files(id,request_id,purpose,filename,mime,size,storage_key,actor_email,created_at) SELECT ?,id,?,?,?,?,?,?,? FROM yg_advance_requests WHERE id=? AND last_event=?',fid,purpose,name,mime,size,key,u.email,at,id,event),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_advance_requests WHERE id=? AND last_event=?',event,u.email,'file_added',JSON.stringify({purpose,name}),id,event)]);if(!out[0].meta.changes)fail(409,'Pengajuan berubah. Muat ulang dan unggah kembali.');}catch(e){await env.MEDIA.delete(key);throw e;}
  return json(await detail(env,await read(env,id)));
 }
 if(req.method!=='POST'&&req.method!=='PUT')fail(405,'Metode tidak didukung.');
 const body=await input(req);if(body.version!==row.version)fail(409,'Pengajuan berubah. Muat ulang.');
 if(!action&&req.method==='PUT'){
  if(!own(u,row)||!['draft','returned'].includes(row.status))fail(403,'Hanya pengaju yang dapat menyunting draf UM.');const data=advanceInput(body);return json(await detail(env,await mutate(env,row,u,'updated',{payload:JSON.stringify(data),total:data.total},data)));
 }
 if(req.method!=='POST')fail(405,'Metode tidak didukung.');
 const status=advanceTransition(u,row,action),changes={status},snapshot={};
 if(['return','report_return'].includes(action))changes.note=string(body.note,4000);
 else if(['check','approve','report_check','report_approve'].includes(action))changes.note=string(body.note||'',4000,false);
 if(action==='disburse'){
  await proof(env,id,'payment');changes.paid_date=date(body.date);if(changes.paid_date>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}))fail(400,'Tanggal pencairan tidak boleh di masa depan.');changes.payment_reference=string(body.reference,160);snapshot.amount=row.total;snapshot.date=changes.paid_date;snapshot.reference=changes.payment_reference;
 }
 if(action==='report'){const data=advanceInput(body,true);changes.report=JSON.stringify(data);changes.actual=data.total;Object.assign(snapshot,data);}
 if(action==='report_submit'){await proof(env,id,'pjum');if(!row.report)fail(400,'Isi rincian PJUM terlebih dahulu.');}
 if(action==='settle'){
  await proof(env,id,'settlement');if(amount(body.amount)!==Math.abs(row.total-row.actual))fail(400,'Nominal penyelesaian harus sama dengan selisih UM dan realisasi.');const settledDate=date(body.date);if(settledDate>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}))fail(400,'Tanggal penyelesaian tidak boleh di masa depan.');changes.settlement_reference=string(body.reference,160);Object.assign(snapshot,{amount:body.amount,date:settledDate,reference:changes.settlement_reference,direction:row.total>row.actual?'refund':'reimbursement'});
 }
 return json(await detail(env,await mutate(env,row,u,action,changes,{...snapshot,note:changes.note||''})));
}
