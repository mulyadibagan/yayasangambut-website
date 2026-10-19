import {fail,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
import {payrollPage} from './payroll-page.mjs';

export const payrollOperator=(u,env)=>!!u&&!u.disabled&&!!env.PAYROLL_FINANCE_EMAIL&&u.email?.toLowerCase()===env.PAYROLL_FINANCE_EMAIL.toLowerCase();
export const payrollAccess=(u,env)=>financeOwner(u)||payrollOperator(u,env);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const uuid=()=>crypto.randomUUID();
function text(v,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Isian teks belum lengkap atau terlalu panjang.');return v.trim();}
export function payrollInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Data pengajuan tidak valid.');
 const period=text(body.period,7,true);if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))fail(400,'Periode gaji tidak valid.');
 if(!Array.isArray(body.items)||!body.items.length||body.items.length>100)fail(400,'Isi 1–100 penerima gaji.');
 const seen=new Set();let total=0;
 const money=v=>{if(!Number.isSafeInteger(v)||v<0||v>10000000000)fail(400,'Nominal harus berupa rupiah bulat, antara 0 dan 10 miliar.');return v;};
 const items=body.items.map(row=>{
  if(!row||typeof row!=='object')fail(400,'Baris penerima tidak valid.');
  const name=text(row.name,160,true),key=name.toLowerCase();if(seen.has(key))fail(400,'Nama penerima berulang. Gabungkan komponen gaji dalam satu baris.');seen.add(key);
  const base=money(row.base),allowance=money(row.allowance),deduction=money(row.deduction),net=base+allowance-deduction;
  if(net<=0)fail(400,'Gaji bersih setiap penerima harus lebih dari nol.');total+=net;
  return {name,program:text(row.program,200,true),bank:text(row.bank||'',80),account:text(row.account||'',80),base,allowance,deduction,net};
 });
 return {period,items,total,notes:text(body.notes||'',4000)};
}
async function body(req,limit=150000){const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>limit){await reader.cancel();fail(413,'Ukuran berkas atau data terlalu besar.');}chunks.push(r.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
async function input(req){try{const value=JSON.parse(new TextDecoder().decode(await body(req)));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data tidak valid.');return value;}catch(e){if(e.status)throw e;fail(400,'Data tidak valid.');}}
const serialize=r=>({...r,items:JSON.parse(r.items)});
async function read(env,id){const r=await q(env,'SELECT * FROM yg_payroll_requests WHERE id=?',id).first();if(!r)fail(404,'Pengajuan tidak ditemukan.');return r;}
async function detail(env,id){const row=await read(env,id);return {...serialize(row),files:(await q(env,'SELECT id,filename,mime,size,actor_email,created_at FROM yg_payroll_files WHERE request_id=? ORDER BY created_at,id',id).all()).results,events:(await q(env,'SELECT id,actor_email,action,version,created_at,snapshot FROM yg_payroll_events WHERE request_id=? ORDER BY version',id).all()).results.map(e=>({...e,snapshot:JSON.parse(e.snapshot)}))};}
function editable(u,env,row){if(!payrollOperator(u,env)||row.creator!==u.id)fail(403,'Hanya staf Finance pembuat pengajuan yang dapat menyunting.');if(!['draft','returned'].includes(row.status))fail(409,'Pengajuan sudah dikirim dan tidak dapat diubah.');}
function version(row,v){if(!Number.isInteger(v)||row.version!==v)fail(409,'Pengajuan telah berubah. Muat ulang sebelum melanjutkan.');}
function eventStatement(env,id,event,u,action,snapshot){return q(env,'INSERT INTO yg_payroll_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_payroll_requests WHERE id=? AND last_event=?',event,u.email,action,JSON.stringify(snapshot),id,event);}
async function mutate(env,statements){try{const result=await env.DB.batch(statements);if(!result[0].meta.changes)fail(409,'Pengajuan telah berubah. Muat ulang sebelum melanjutkan.');}catch(e){if(String(e.message).includes('UNIQUE constraint failed: yg_payroll_requests.period'))fail(409,'Sudah ada pengajuan aktif atau disetujui untuk bulan ini.');throw e;}}

export async function payrollRoute(req,env,u){
 if(!payrollAccess(u,env))fail(403,'Pengajuan gaji hanya untuk staf Finance yang ditunjuk dan Direktur.');
 const url=new URL(req.url),path=url.pathname;
 if(req.method!=='GET'&&req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Asal permintaan tidak valid.');
 if(path==='/finance/payroll'||path==='/finance/payroll/'){
  if(req.method!=='GET')fail(405,'Metode tidak didukung.');
  return new Response(payrollPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 const prefix='/finance/payroll/api';
 if(path===prefix&&req.method==='GET')return Response.json({user:{name:u.name,email:u.email,director:financeOwner(u),operator:payrollOperator(u,env)},requests:(await q(env,'SELECT id,period,status,total,creator_email,version,created_at,updated_at FROM yg_payroll_requests ORDER BY period DESC,created_at DESC LIMIT 500').all()).results});
 if(path===prefix&&req.method==='POST'){
  if(!payrollOperator(u,env))fail(403,'Pengajuan dibuat oleh staf Finance.');
  const data=payrollInput(await input(req)),id=uuid(),event=uuid(),at=now();
  await mutate(env,[q(env,"INSERT INTO yg_payroll_requests(id,period,status,creator,creator_email,items,total,notes,last_event,created_at,updated_at) VALUES(?,?,'draft',?,?,?,?,?,?,?,?)",id,data.period,u.id,u.email,JSON.stringify(data.items),data.total,data.notes,event,at,at),eventStatement(env,id,event,u,'created',data)]);
  return Response.json(await detail(env,id),{status:201});
 }
 const match=path.match(/^\/finance\/payroll\/api\/([a-f0-9-]{36})(?:\/(submit|approve|return|files)(?:\/([a-f0-9-]{36}))?)?$/);
 if(!match)fail(404,'Halaman pengajuan tidak ditemukan.');
 const [,id,action,fileId]=match,row=await read(env,id);
 if(!action&&req.method==='GET')return Response.json(await detail(env,id));
 if(action==='files'&&fileId&&req.method==='GET'){
  const f=await q(env,'SELECT * FROM yg_payroll_files WHERE id=? AND request_id=?',fileId,id).first();if(!f)fail(404,'Lampiran tidak ditemukan.');const obj=await env.MEDIA.get(f.object_key);if(!obj)fail(404,'Berkas tidak ditemukan.');
  return new Response(obj.body,{headers:{'Content-Type':f.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.filename),'Cache-Control':'no-store'}});
 }
 if(action==='files'&&!fileId&&req.method==='POST'){
  editable(u,env,row);version(row,Number(req.headers.get('X-Payroll-Version')));
  const count=await q(env,'SELECT COUNT(*) AS n FROM yg_payroll_files WHERE request_id=?',id).first();if(count.n>=10)fail(400,'Maksimal 10 lampiran per pengajuan.');
  let filename;try{filename=decodeURIComponent(req.headers.get('X-Filename')||'');}catch{fail(400,'Nama berkas tidak valid.');}filename=text(filename,180,true);if(/[\x00-\x1f\\/]/.test(filename))fail(400,'Nama berkas tidak valid.');
  const bytes=await body(req,5*1024*1024),head=new TextDecoder().decode(bytes.slice(0,5));
  const mime=head==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':null;
  if(!mime)fail(400,'Lampiran harus PDF, JPEG, atau PNG.');
  const fid=uuid(),key='payroll-private/'+id+'/'+fid,event=uuid(),at=now();await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{await mutate(env,[q(env,'UPDATE yg_payroll_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status IN (\'draft\',\'returned\')',event,at,id,row.version),q(env,'INSERT INTO yg_payroll_files(id,request_id,object_key,filename,mime,size,actor_email,created_at) SELECT ?,id,?,?,?,?,?,? FROM yg_payroll_requests WHERE id=? AND last_event=?',fid,key,filename,mime,bytes.length,u.email,at,id,event),eventStatement(env,id,event,u,'attached',{file_id:fid,filename,size:bytes.length})]);}
  catch(e){
   // A network failure may occur after D1 committed. Only remove an orphan
   // after confirming that no persisted file references it.
   const saved=await q(env,'SELECT id FROM yg_payroll_files WHERE id=?',fid).first();
   if(!saved)await env.MEDIA.delete(key);throw e;
  }
  return Response.json(await detail(env,id),{status:201});
 }
 if(fileId)fail(405,'Metode tidak didukung.');
 if((!action&&req.method==='PUT')||(['submit','approve','return'].includes(action)&&req.method==='POST')){
  const data=await input(req);version(row,data.version);const event=uuid(),at=now();let statement,snapshot,kind;
  if(!action){
   editable(u,env,row);const changed=payrollInput(data);snapshot=changed;kind='updated';
   statement=q(env,'UPDATE yg_payroll_requests SET period=?,items=?,total=?,notes=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',changed.period,JSON.stringify(changed.items),changed.total,changed.notes,event,at,id,row.version);
  }else{
   if(action==='submit'){editable(u,env,row);payrollInput(serialize(row));}
   else {if(!financeOwner(u))fail(403,'Hanya Direktur yang dapat menyetujui atau mengembalikan.');if(row.status!=='submitted')fail(409,'Hanya pengajuan yang sudah diajukan dapat ditinjau.');if(row.creator===u.id)fail(403,'Pembuat pengajuan tidak dapat menyetujui pengajuannya sendiri.');}
   const note=text(data.note||'',4000,action==='return'),status={submit:'submitted',approve:'approved',return:'returned'}[action];kind=status;
   const files=(await q(env,'SELECT id,filename,size FROM yg_payroll_files WHERE request_id=? ORDER BY id',id).all()).results;
   snapshot={...serialize(row),status,review_note:note,files};
   statement=q(env,'UPDATE yg_payroll_requests SET status=?,review_note=?,submitted_at=?,reviewed_at=?,reviewer_email=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',status,note,action==='submit'?at:row.submitted_at,action==='submit'?null:at,action==='submit'?null:u.email,event,at,id,row.version);
  }
  await mutate(env,[statement,eventStatement(env,id,event,u,kind,snapshot)]);return Response.json(await detail(env,id));
 }
 fail(405,'Metode tidak didukung.');
}
