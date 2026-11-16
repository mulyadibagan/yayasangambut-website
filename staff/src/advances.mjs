import {pjumNotificationStatement,sendPjumNotifications,pjumNotificationStatus} from './pjum-notifications.mjs';
import {advanceProjects,projectSource,projectCommitments,linkAdvanceProject} from './advance-projects.mjs';
import {fail,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
import {advancesPage} from './advances-page.mjs';
import {legacySource} from './advance-legacy.mjs';
import {receiptReviewKey,receiptChecks,receiptImage,scanReceipt,receiptPageCount,today} from './pjum-evidence.mjs';
import {loadBudget,saveBudget,budgetPage} from './project-budget.mjs';

const applicants=new Set(['mulyadi@yayasangambut.org','zamharier@yayasangambut.org','rienaprasiddha@yayasangambut.org']);
export const advanceAccess=u=>!!u&&!u.disabled&&applicants.has(u.email?.toLowerCase());
export const advanceFinance=u=>advanceAccess(u)&&u.email.toLowerCase()==='rienaprasiddha@yayasangambut.org';
const director=u=>advanceAccess(u)&&financeOwner(u);
const manager=u=>director(u)||advanceFinance(u);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function binary(req){const reader=req.body?.getReader();if(!reader)fail(400,'Berkas kosong.');const parts=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>5*1024*1024){await reader.cancel();fail(413,'Berkas maksimal 5 MB.');}parts.push(r.value);}if(!size)fail(400,'Berkas kosong.');const bytes=new Uint8Array(size);let p=0;for(const b of parts){bytes.set(b,p);p+=b.length;}return bytes;}
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
  const times=row.times??1;if(!Number.isSafeInteger(times)||times<1||times>3660)fail(400,'Frekuensi harus bilangan bulat positif.');
  const subtotal=Math.round(quantity*days*times*rate);amount(subtotal,report);total+=subtotal;
  return {description,unit,quantity,days,times,rate,subtotal,...(row.activity_code?{activity_code:string(row.activity_code,80)}:{}),...(report?{date:date(row.date),receipt_no:string(row.receipt_no||'',80,false),recipient:string(row.recipient||'',240,false),file_id:string(row.file_id||'',80,false),page:Number.isSafeInteger(row.page)&&row.page>0&&row.page<=100?row.page:null}:{})};
 });
 amount(total,report);
 if(report)return {schema:2,items,total,report_date:date(body.report_date||today()),report_number:string(body.report_number||'',160,false),notes:string(body.notes||'',4000,false)};
 const start=date(body.start),end=date(body.end);if(end<start)fail(400,'Tanggal akhir mendahului tanggal mulai.');
 return {project_id:body.project_id?string(body.project_id,40):'',bank:string(body.bank||'',80,false),account:string(body.account||'',80,false),account_name:string(body.account_name||'',160,false),project:string(body.project,160),activity:string(body.activity,240),location:string(body.location,240),start,end,notes:string(body.notes||'',4000,false),items,total};
}
const own=(u,row)=>row.creator===u.id;
function visible(u,row){if(!manager(u)&&!own(u,row))fail(403,'Pengajuan hanya dapat dibuka pengaju, Bagian Keuangan, dan Direktur.');}
const number=row=>row.legacy_id?JSON.parse(row.payload).legacy.number:'UM-'+row.created_at.slice(0,4)+'-'+String(row.seq).padStart(5,'0');
function serialize(row){return {...row,number:number(row),payload:JSON.parse(row.payload),report:row.report?JSON.parse(row.report):null};}
async function read(env,id){const r=await q(env,'SELECT * FROM yg_advance_requests WHERE id=?',id).first();if(!r)fail(404,'Pengajuan tidak ditemukan.');return r;}
async function detail(env,row){const files=(await q(env,'SELECT id,purpose,filename,mime,size,pages,actor_email,created_at FROM yg_advance_files WHERE request_id=? ORDER BY created_at',row.id).all()).results,ocr=(await q(env,'SELECT file_id,page,result,created_at FROM yg_advance_ocr WHERE request_id=?',row.id).all()).results.map(r=>({...r,result:JSON.parse(r.result)}));return {...serialize(row),notification:row.report?await pjumNotificationStatus(env,row.id):null,files,ocr,checks:row.report?receiptChecks(JSON.parse(row.report),files,ocr,row.paid_date):null,events:(await q(env,'SELECT actor_email,action,version,snapshot,created_at FROM yg_advance_events WHERE request_id=? ORDER BY version',row.id).all()).results.map(r=>({...r,snapshot:JSON.parse(r.snapshot)}))};}
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
   q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_advance_requests WHERE id=? AND last_event=?',event,u.email,action,JSON.stringify(snapshot),row.id,event),
   ...(action==='report_submit'?[pjumNotificationStatement(env,row,event,at)]:[])
  ]);if(!result[0].meta.changes)fail(409,'Pengajuan telah diubah. Muat ulang sebelum menyimpan.');
 }catch(e){if(String(e.message).includes('ADVANCE_BUDGET_EXCEEDED'))fail(409,'Pengajuan melebihi sisa pagu kegiatan atau pagu telah digunakan pengajuan lain. Muat ulang anggaran.');if(String(e.message).includes('UNIQUE constraint failed'))fail(409,'Referensi pembayaran sudah digunakan.');throw e;}
 return read(env,row.id);
}
const uploadAllowed=(u,row,purpose)=>purpose==='um'?own(u,row)&&['draft','returned'].includes(row.status):purpose==='pjum'?own(u,row)&&['disbursed','pjum_returned','pjum_draft'].includes(row.status):purpose==='payment'?advanceFinance(u)&&row.status==='approved':purpose==='settlement'?advanceFinance(u)&&row.status==='settlement':false;
async function proof(env,id,purpose){if(!await q(env,'SELECT id FROM yg_advance_files WHERE request_id=? AND purpose=?'+(purpose==='pjum'?" AND mime IN ('application/pdf','image/jpeg','image/png')":''),id,purpose).first())fail(400,'Unggah dokumen pendukung '+({pjum:'PJUM',payment:'pencairan',settlement:'penyelesaian'}[purpose]||'UM')+' terlebih dahulu.');}
export async function advancesRoute(req,env,u){
 if(!advanceAccess(u))fail(403,'Pengajuan UM hanya tersedia untuk Mulyadi, Zamharir, dan Riena.');
 if(req.method!=='GET'&&req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Asal permintaan tidak valid.');
 const path=new URL(req.url).pathname,prefix='/finance/advances';
 if([prefix,prefix+'/'].includes(path)&&req.method==='GET')return new Response(advancesPage(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 if(path===prefix+'/budget'&&req.method==='GET')return new Response(budgetPage(await loadBudget(env),manager(u)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 if(path===prefix+'/api/budget'){
  if(!manager(u))fail(403,'Anggaran dikelola Direktur dan Finance.');
  if(req.method==='GET')return json(await loadBudget(env));
  if(req.method==='POST')return json(await saveBudget(env,u,await input(req)));
  fail(405,'Metode tidak didukung.');
 }
 if(path===prefix+'/api/me'&&req.method==='GET')return json({id:u.id,name:u.name,email:u.email,director:director(u),finance:advanceFinance(u),payroll:manager(u),dashboard:manager(u)});
 if(path===prefix+'/api/projects'&&req.method==='GET')return json(advanceProjects);
 if(path===prefix+'/api/pjum_preview'&&req.method==='POST'){
  const {importPjumExcel}=await import('./pjum-excel.mjs');return json(importPjumExcel(await binary(req)));
 }
 if(path===prefix+'/api/pjum_resolve'&&req.method==='POST'){
  const body=await input(req),normalize=s=>String(s||'').replace(/\s/g,'').toUpperCase(),um=normalize(string(body.um_number,160));
  const requests=(await q(env,'SELECT * FROM yg_advance_requests WHERE creator=?',u.id).all()).results;
  const matches=requests.filter(r=>normalize(number(r))===um);if(matches.length>1)fail(409,'Nomor UM memiliki lebih dari satu catatan. Pilih UM yang sesuai.');
  if(matches.length===1){if(!uploadAllowed(u,matches[0],'pjum'))fail(409,'PJUM untuk UM ini sudah dikirim atau belum dapat dilaporkan.');return json(await detail(env,matches[0]));}
  if(!manager(u))fail(400,'UM belum ditemukan pada pengajuan Anda. Minta Finance menghubungkan UM arsip terlebih dahulu.');
  const legacy=(await legacySource(env,u)).filter(r=>normalize(r.number)===um);if(legacy.length!==1)fail(400,'Nomor UM pada Excel belum cocok dengan arsip. Pilih UM asal atau periksa nomor pada Excel.');
  const source=legacy[0],expected=/mulyadi/i.test(source.applicant)?'mulyadi@yayasangambut.org':/riena/i.test(source.applicant)?'rienaprasiddha@yayasangambut.org':/zamhar|ariel/i.test(source.applicant)?'zamharier@yayasangambut.org':'';
  if(expected!==u.email.toLowerCase())fail(403,'PJUM harus dilaporkan oleh pengaju UM yang tercantum pada arsip.');
  if(source.bank_status!=='Cocok'||source.bank_amount!==source.amount||!source.paid_date)fail(400,'Bukti pencairan UM lama perlu diperiksa Finance terlebih dahulu.');
  return advancesRoute(new Request(env.APP_ORIGIN+prefix+'/api/legacy',{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({id:source.id,owner_email:u.email,paid_date:source.paid_date,reference:source.reference||'Mutasi terverifikasi '+source.paid_date+' / '+source.number})}),env,u);
 }
 if(path===prefix+'/api/legacy'&&req.method==='GET'){
  if(!manager(u))fail(403,'Arsip UM dilaporkan oleh Direktur atau Finance.');
  const adopted=(await q(env,'SELECT legacy_id,id,status FROM yg_advance_requests WHERE legacy_id IS NOT NULL').all()).results;
  return json((await legacySource(env,u)).map(r=>({...r,linked:adopted.find(a=>a.legacy_id===r.id)||null})));
 }
 if(path===prefix+'/api/legacy'&&req.method==='POST'){
  if(!manager(u))fail(403,'Arsip UM dilaporkan oleh Direktur atau Finance.');
  const body=await input(req),legacy=(await legacySource(env,u)).find(r=>r.id===body.id);if(!legacy)fail(404,'UM arsip tidak ditemukan.');
  const old=await q(env,'SELECT * FROM yg_advance_requests WHERE legacy_id=?',legacy.id).first();if(old)return json(await detail(env,old));
  if(legacy.reported>0)fail(409,'UM arsip sudah memiliki PJUM. Periksa laporan yang telah ada agar tidak dilaporkan dua kali.');
  // Archive values are retained verbatim. Missing bank metadata must be confirmed
  // against the existing transfer, never interpreted as a new cash payment.
  const paid=date(legacy.paid_date||body.paid_date);if(paid>today())fail(400,'Tanggal pencairan tidak boleh di masa depan.');
  if(!legacy.paid_date&&body.confirm_existing_payment!==true)fail(400,'Konfirmasi bukti pencairan UM lama terlebih dahulu.');
  const reference=legacy.reference||string(body.reference,160),ownerEmail=string(body.owner_email,160).toLowerCase();if(!applicants.has(ownerEmail))fail(400,'Pilih pengaju UM lama.');
  if(legacy.applicant&&/mulyadi|riena|zamhar|ariel/i.test(legacy.applicant)){
   const expected=/mulyadi/i.test(legacy.applicant)?'mulyadi@yayasangambut.org':/riena/i.test(legacy.applicant)?'rienaprasiddha@yayasangambut.org':'zamharier@yayasangambut.org';if(ownerEmail!==expected)fail(400,'Pengaju berbeda dari arsip UM.');
  }
  const owner=await q(env,'SELECT id,email,name FROM users WHERE email=? AND disabled=0',ownerEmail).first();if(!owner)fail(400,'Akun pengaju belum tersedia.');
  const id=crypto.randomUUID(),event=crypto.randomUUID(),at=now(),data={legacy,project_id:legacy.project.replace(/^YG[_-]/,''),project:legacy.project,activity:legacy.title,location:'Sesuai UM arsip',start:paid,end:paid,items:[{description:legacy.title,quantity:1,times:1,days:1,unit:'UM',rate:legacy.amount,subtotal:legacy.amount}],total:legacy.amount,allocations:[],notes:'Pelaporan UM arsip; pencairan telah terjadi.'};
  try{await env.DB.batch([q(env,"INSERT INTO yg_advance_requests(id,creator,creator_email,creator_name,status,payload,total,paid_date,payment_reference,legacy_id,last_event,created_at,updated_at) VALUES(?,?,?,?,'disbursed',?,?,?,?,?,?,?,?)",id,owner.id,owner.email,owner.name,JSON.stringify(data),legacy.amount,paid,'ARSIP:'+legacy.id,legacy.id,event,at,at),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) VALUES(?,?,?,?,1,?,?)',event,id,u.email,'legacy_linked',JSON.stringify({legacy,paid_date:paid,reference,confirmed:body.confirm_existing_payment===true}),at)]);}catch(e){if(String(e.message).includes('UNIQUE constraint'))fail(409,'UM arsip ini sudah terhubung. Muat ulang daftar.');throw e;}
  return json(await detail(env,await read(env,id)),201);
 }
 if(path===prefix+'/api/project'&&req.method==='GET'){
  const url=new URL(req.url),source=await projectSource(env,u,url.searchParams.get('id'));
  const records=(await q(env,'SELECT id,status,payload,report FROM yg_advance_requests').all()).results;
  return json(projectCommitments(source,records,url.searchParams.get('exclude')));
 }
 if(path===prefix+'/api'){
  if(req.method==='GET'){const rows=(await q(env,'SELECT * FROM yg_advance_requests '+(manager(u)?'':'WHERE creator=? ')+'ORDER BY seq DESC LIMIT 500',...(manager(u)?[]:[u.id])).all()).results;return json(rows.map(serialize));}
  if(req.method==='POST'){
   const data=await linkAdvanceProject(env,u,advanceInput(await input(req))),id=crypto.randomUUID(),event=crypto.randomUUID(),at=now();
   await env.DB.batch([q(env,'INSERT INTO yg_advance_requests(id,creator,creator_email,creator_name,payload,total,last_event,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',id,u.id,u.email,u.name,JSON.stringify(data),data.total,event,at,at),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) VALUES(?,?,?,?,1,?,?)',event,id,u.email,'created',JSON.stringify(data),at)]);
   return json(await detail(env,await read(env,id)),201);
  }
  fail(405,'Metode tidak didukung.');
 }
 const match=path.match(/^\/finance\/advances\/api\/([a-f0-9-]{36})(?:\/(files|[a-z_]+)(?:\/([a-f0-9-]{36}))?)?$/);if(!match)fail(404,'Halaman tidak ditemukan.');
 const [,id,action,fileId]=match,row=await read(env,id);visible(u,row);
 if(action==='files'&&fileId&&req.method==='GET'){
  const file=await q(env,'SELECT * FROM yg_advance_files WHERE id=? AND request_id=?',fileId,id).first();if(!file)fail(404,'Berkas tidak ditemukan.');const object=await env.MEDIA.get(file.storage_key);if(!object)fail(404,'Berkas belum tersedia.');
   const imagePage=new URL(req.url).searchParams.get('image_page');if(imagePage!==null){const image=await receiptImage(new Uint8Array(await object.arrayBuffer()),file.mime,Number(imagePage));if(image.error)fail(422,image.error);return new Response(image.bytes,{headers:{'Content-Type':image.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
  return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':(new URL(req.url).searchParams.get('preview')==='1'&&['application/pdf','image/jpeg','image/png'].includes(file.mime)?"inline":"attachment")+"; filename*=UTF-8''"+encodeURIComponent(file.filename),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(action==='excel'&&req.method==='GET'){
  const template=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/um-template-yg.xlsx'));
  if(!template.ok)fail(503,'Template Excel UM belum tersedia.');
  const {advanceExcel}=await import('./advance-excel.mjs');
  const bytes=advanceExcel(new Uint8Array(await template.arrayBuffer()),await detail(env,row));
  return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="'+number(row)+'.xlsx"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(!action&&req.method==='GET')return json(await detail(env,row));
 if(action==='import_excel'&&req.method==='POST'){
  if(!uploadAllowed(u,row,'pjum'))fail(403,'Excel hanya dapat diimpor pengaju pada draf PJUM.');
  if(Number(new URL(req.url).searchParams.get('version'))!==row.version)fail(409,'Pengajuan berubah. Muat ulang.');
  const bytes=await binary(req),{importPjumExcel}=await import('./pjum-excel.mjs'),parsed=importPjumExcel(bytes);return json(parsed);
 }
 if(action==='files'&&!fileId&&req.method==='POST'){
  const url=new URL(req.url),purpose=url.searchParams.get('purpose');if(!uploadAllowed(u,row,purpose))fail(403,'Lampiran tidak dapat ditambahkan pada tahap ini.');
  if(Number(url.searchParams.get('version'))!==row.version)fail(409,'Pengajuan berubah. Muat ulang.');
  const name=string(url.searchParams.get('name'),180),bytes=await binary(req),size=bytes.length;
  let mime=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':null;
  if(!mime&&purpose==='pjum'&&/\.xlsx$/i.test(name)){const {importPjumExcel}=await import('./pjum-excel.mjs');importPjumExcel(bytes);mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}
  if(!mime)fail(400,'Gunakan PDF, JPG, PNG, atau Excel PJUM YG (.xlsx).');if(!env.MEDIA)fail(503,'Penyimpanan lampiran belum tersedia.');
  const similar=(await q(env,'SELECT storage_key FROM yg_advance_files WHERE request_id=? AND purpose=? AND filename=? AND size=? AND mime=? LIMIT 5',id,purpose,name,size,mime).all()).results;
  if(similar.length){const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join(''),digest=await hash(bytes);for(const prior of similar){const object=await env.MEDIA.get(prior.storage_key);if(object){const old=object.arrayBuffer?await object.arrayBuffer():await new Response(object.body).arrayBuffer();if(await hash(old)===digest)return json(await detail(env,row));}}}
  const pages=await receiptPageCount(bytes,mime);const fid=crypto.randomUUID(),key='advances/'+id+'/'+fid,event=crypto.randomUUID(),at=now();await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{const out=await env.DB.batch([q(env,'UPDATE yg_advance_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',event,at,id,row.version),q(env,'INSERT INTO yg_advance_files(id,request_id,purpose,filename,mime,size,storage_key,actor_email,created_at,pages) SELECT ?,id,?,?,?,?,?,?,?,? FROM yg_advance_requests WHERE id=? AND last_event=?',fid,purpose,name,mime,size,key,u.email,at,pages,id,event),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_advance_requests WHERE id=? AND last_event=?',event,u.email,'file_added',JSON.stringify({purpose,name}),id,event)]);if(!out[0].meta.changes)fail(409,'Pengajuan berubah. Muat ulang dan unggah kembali.');}catch(e){await env.MEDIA.delete(key);throw e;}
  return json(await detail(env,await read(env,id)));
 }
 if(req.method!=='POST'&&req.method!=='PUT')fail(405,'Metode tidak didukung.');
 const body=await input(req);if(body.version!==row.version)fail(409,'Pengajuan berubah. Muat ulang.');
 if(action==='receipt_review'&&req.method==='POST'){
  if(!own(u,row)||!['pjum_draft','pjum_returned'].includes(row.status))fail(403,'Hanya pelapor dapat mengonfirmasi kuitansi pada draf PJUM.');
  const data=await detail(env,row),report=data.report,index=body.index,check=data.checks?.rows[index];
  if(!Number.isInteger(index)||!check||!report?.items[index])fail(400,'Pilih kuitansi pada laporan ini.');
  if(!['matched','needs_fix'].includes(body.status))fail(400,'Pilih hasil pemeriksaan kuitansi.');
  if(!check.read)fail(400,'Jalankan pembacaan otomatis terlebih dahulu.');
  if(body.status==='matched'&&check.issues.length)fail(400,'Lengkapi data dan tautan bukti terlebih dahulu.');
  if(!check.manual&&!check.warnings.length&&check.comparisons.every(c=>c.status==='Cocok'))fail(400,'Kuitansi ini sudah cocok otomatis.');
  const note=string(body.note||'',2000,body.status==='needs_fix');
  const allowedFields=['receipt_no','recipient','amount','date','description','other'];
  const fields=body.status==='needs_fix'&&Array.isArray(body.fields)?[...new Set(body.fields)]:[];
  if(body.status==='needs_fix'&&(!fields.length||fields.some(f=>!allowedFields.includes(f))))fail(400,'Pilih bidang data yang perlu diperbaiki.');
  const review={index,key:receiptReviewKey(report.items[index]),status:body.status,fields,note,actor_email:u.email,actor_name:u.name||u.email,created_at:now()};
  report.receipt_reviews=[...(report.receipt_reviews||[]).filter(r=>r.index!==index),review];
  return json(await detail(env,await mutate(env,row,u,'receipt_review',{report:JSON.stringify(report)},review)));
 }
 if(action==='scan'&&req.method==='POST'){
  if(!uploadAllowed(u,row,'pjum')&&!advanceFinance(u))fail(403,'Pembacaan bukti tidak tersedia pada tahap ini.');
  if(!['disbursed','pjum_draft','pjum_returned','pjum_submitted'].includes(row.status))fail(409,'Tahap PJUM telah berubah.');
  const pages=body.pages||[{file_id:body.file_id,page:body.page}];
  if(!Array.isArray(pages)||pages.length<1||pages.length>3)fail(400,'Periksa 1–3 halaman sekaligus.');
  const keys=new Set();for(const p of pages){if(!p||typeof p.file_id!=='string'||!Number.isInteger(p.page)||p.page<1||p.page>100)fail(400,'Pilih bukti dan halaman 1–100.');const key=p.file_id+':'+p.page;if(keys.has(key))fail(400,'Halaman pemeriksaan berulang.');keys.add(key);}
  const sources=await Promise.all(pages.map(async p=>{const file=await q(env,"SELECT * FROM yg_advance_files WHERE request_id=? AND id=? AND purpose='pjum'",row.id,p.file_id).first();if(!file||!['application/pdf','image/jpeg','image/png'].includes(file.mime))fail(400,'Pilih PDF atau gambar bukti PJUM.');if(file.pages&&p.page>file.pages)fail(400,'Halaman tidak ada pada bukti.');const cached=await q(env,'SELECT result FROM yg_advance_ocr WHERE request_id=? AND file_id=? AND page=?',row.id,file.id,p.page).first();return {...p,file,previous:cached?JSON.parse(cached.result):null,cached:cached&&!JSON.parse(cached.result).error&&JSON.parse(cached.result).receipt_number_engine==='header-crop-v1'&&String(JSON.parse(cached.result).receipt_no||'').trim()?JSON.parse(cached.result):null};}));
  const pending=sources.filter(p=>!p.cached);if(!pending.length)return json(await detail(env,row));
  const results=await Promise.all(pending.map(async p=>{const object=await env.MEDIA.get(p.file.storage_key);if(!object)fail(404,'Berkas bukti belum tersedia.');const raw=object.arrayBuffer?await object.arrayBuffer():await new Response(object.body).arrayBuffer();return {file_id:p.file_id,page:p.page,result:await scanReceipt(env,new Uint8Array(raw),p.file.mime,p.page,p.previous)};}));
  const at=now(),event=crypto.randomUUID();
  const out=await env.DB.batch([q(env,'UPDATE yg_advance_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',event,at,row.id,row.version),...results.map(p=>q(env,'INSERT INTO yg_advance_ocr(request_id,file_id,page,result,created_at) SELECT id,?,?,?,? FROM yg_advance_requests WHERE id=? AND last_event=? ON CONFLICT(request_id,file_id,page) DO UPDATE SET result=excluded.result,created_at=excluded.created_at',p.file_id,p.page,JSON.stringify(p.result),at,row.id,event)),q(env,'INSERT INTO yg_advance_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_advance_requests WHERE id=? AND last_event=?',event,u.email,'receipt_read',JSON.stringify({pages:results}),row.id,event)]);if(!out[0].meta.changes)fail(409,'Draf telah berubah. Muat ulang.');
  return json(await detail(env,await read(env,row.id)));
 }
 if(!action&&req.method==='PUT'){
  if(!own(u,row)||!['draft','returned'].includes(row.status))fail(403,'Hanya pengaju yang dapat menyunting draf UM.');const data=await linkAdvanceProject(env,u,advanceInput(body));return json(await detail(env,await mutate(env,row,u,'updated',{payload:JSON.stringify(data),total:data.total},data)));
 }
 if(req.method!=='POST')fail(405,'Metode tidak didukung.');
 const status=advanceTransition(u,row,action),changes={status},snapshot={};
 if(action==='submit'&&JSON.parse(row.payload).project_id){const data=await linkAdvanceProject(env,u,JSON.parse(row.payload));changes.payload=JSON.stringify(data);snapshot.allocations=data.allocations;}
 if(['return','report_return'].includes(action))changes.note=string(body.note,4000);
 else if(['check','approve','report_check','report_approve'].includes(action))changes.note=string(body.note||'',4000,false);
 if(action==='disburse'){
  await proof(env,id,'payment');changes.paid_date=date(body.date);if(changes.paid_date>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}))fail(400,'Tanggal pencairan tidak boleh di masa depan.');changes.payment_reference=string(body.reference,160);snapshot.amount=row.total;snapshot.date=changes.paid_date;snapshot.reference=changes.payment_reference;
 }
 if(action==='report'){const data=advanceInput(body,true);changes.report=JSON.stringify(data);changes.actual=data.total;Object.assign(snapshot,data);}
 if(action==='report_submit'){
  await proof(env,id,'pjum');if(!row.report)fail(400,'Isi rincian PJUM terlebih dahulu.');
  const data=await detail(env,row),report=data.report;
  if(!data.checks.complete)fail(400,'Lengkapi nomor kuitansi, penerima, dan halaman bukti; perbaiki nomor/halaman ganda serta tanggal pengeluaran.');

  if(report.report_date>today())fail(400,'PJUM dapat diajukan mulai tanggal laporan. Simpan sebagai draf terlebih dahulu.');

  snapshot.checks=data.checks;snapshot.report_date=report.report_date;
 }
 if(action==='report_check'){
  const data=await detail(env,row);if(!data.checks?.complete)fail(400,'Bukti PJUM belum lengkap.');
  if(body.evidence_reviewed!==true)fail(400,'Konfirmasi pemeriksaan kuitansi asli, tanda tangan, dan kesesuaian kegiatan.');
  if(data.checks.warnings&&!body.note?.trim())fail(400,'Isi hasil pemeriksaan atas peringatan kuitansi.');
  snapshot.evidence_reviewed=true;snapshot.checks=data.checks;
 }
 if(action==='settle'){
  await proof(env,id,'settlement');if(amount(body.amount)!==Math.abs(row.total-row.actual))fail(400,'Nominal penyelesaian harus sama dengan selisih UM dan realisasi.');const settledDate=date(body.date);if(settledDate>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}))fail(400,'Tanggal penyelesaian tidak boleh di masa depan.');changes.settlement_reference=string(body.reference,160);Object.assign(snapshot,{amount:body.amount,date:settledDate,reference:changes.settlement_reference,direction:row.total>row.actual?'refund':'reimbursement'});
 }
 const updated=await mutate(env,row,u,action,changes,{...snapshot,note:changes.note||''});
 if(action==='report_submit')await sendPjumNotifications(env,row.id);
 return json(await detail(env,updated));
}
