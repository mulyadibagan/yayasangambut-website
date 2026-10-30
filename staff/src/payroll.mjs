import {staffTerms,saveStaffTerm,staffTermsPage} from './payroll-staff.mjs';
import {documentSignature,signatureDataUrl} from './document-signature.mjs';
import {savePayrollPdf,pdfHash} from './payroll-pdf.mjs';
import {payrollReviewPage} from './payroll-review.mjs';
import {payrollNotificationStatement,payrollNotificationStatus,sendPayrollNotifications,payrollEmailService} from './payroll-notifications.mjs';
import {payrollGuide} from './payroll-guide.mjs';
import {canonicalStaffName,displayStaffName} from './payroll-identity.mjs';
import {fail,now} from './core.mjs';
import {financeOwner} from './finance-access.mjs';
import {payrollPage} from './payroll-page.mjs';
import {payrollDefaults,payrollSource,payrollReport,staffKey,validDate,dateKey,today,bankId,resolveBank} from './payroll-data.mjs';
import {payrollPrint} from './payroll-print.mjs';
import {payrollReportPage} from './payroll-report-page.mjs';

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
  const name=displayStaffName(text(row.name,160,true)),key=staffKey(name);if(seen.has(key))fail(400,'Nama penerima berulang. Gabungkan komponen gaji dalam satu baris.');seen.add(key);
  const base=money(row.base),allowance=money(row.allowance),deduction=money(row.deduction),net=base+allowance-deduction;
  if(net<=0)fail(400,'Gaji bersih setiap penerima harus lebih dari nol.');total+=net;
  return {staff_id:staffKey(name),name,program:text(row.program,200,true),budget_code:text(row.budget_code||'',80),description:text(row.description||'Gaji '+name,600,true),account_name:text(row.account_name||name,160,true),remarks:text(row.remarks||'',500),bank:text(row.bank||'',80),account:text(row.account||'',80),base,allowance,deduction,net};
 });
 return {period,items,total,notes:text(body.notes||'',4000)};
}
async function body(req,limit=150000){const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>limit){await reader.cancel();fail(413,'Ukuran berkas atau data terlalu besar.');}chunks.push(r.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
async function input(req){try{const value=JSON.parse(new TextDecoder().decode(await body(req)));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Data tidak valid.');return value;}catch(e){if(e.status)throw e;fail(400,'Data tidak valid.');}}
const serialize=r=>({...r,status:r.cancelled_at?'cancelled':r.status,items:JSON.parse(r.items),form_meta:JSON.parse(r.form_meta||'{}')});
async function read(env,id){const r=await q(env,'SELECT * FROM yg_payroll_requests WHERE id=?',id).first();if(!r)fail(404,'Pengajuan tidak ditemukan.');return r;}
async function detail(env,id){const notification=await payrollNotificationStatus(env,id),document=await q(env,'SELECT filename,sha256,size,created_at FROM yg_payroll_documents WHERE request_id=?',id).first();const row=await read(env,id),payments=(await q(env,'SELECT * FROM yg_payroll_payments WHERE request_id=? ORDER BY paid_date,created_at',id).all()).results.map(p=>({...p,allocations:JSON.parse(p.allocations),proof_ids:JSON.parse(p.proof_ids)})),paid=payments.reduce((s,p)=>s+p.amount,0);return {...serialize(row),document,notification,payments,paid,remaining:row.total-paid,payment_status:paid===row.total?'paid':paid?'partial':'unpaid',files:(await q(env,'SELECT id,filename,mime,size,purpose,actor_email,created_at FROM yg_payroll_files WHERE request_id=? ORDER BY created_at,id',id).all()).results,events:(await q(env,'SELECT id,actor_email,action,version,created_at,snapshot FROM yg_payroll_events WHERE request_id=? ORDER BY version',id).all()).results.map(e=>({...e,snapshot:JSON.parse(e.snapshot)}))};}
async function formMeta(env,u,input,data,id,old={}){
 if(!input)return old;
 const meta={number:text(input.number||old.number||'GJ-'+id.slice(0,8).toUpperCase()+'/YG-Bnd/'+data.period.slice(5)+'/'+data.period.slice(0,4),100,true),date:validDate(input.date),applicant:text(input.applicant,160,true),title:text(input.title,160,true),purpose:text(input.purpose,500,true),place:text(input.place||'',160),adjustment_note:text(input.adjustment_note||'',2000)};
 const source=await payrollSource(env,u,data.period);meta.allocation_as_of=source.asOf;meta.policy_snapshot={};const report=await payrollReport(env,u,source);
 for(const i of data.items){const policy=source.policy[canonicalStaffName(i.name)];if(!policy?.active||!Number.isSafeInteger(policy.monthlySalary))fail(400,'Penerima harus sesuai daftar staf aktif pada alokasi gaji. Muat ulang sumber alokasi.');meta.policy_snapshot[i.staff_id]={monthlySalary:policy.monthlySalary};const allocation=report.staff.find(s=>s.id===i.staff_id);i.allocation_snapshot={asOf:source.asOf,monthlySalary:policy.monthlySalary,position:allocation?.position??null,source_ids:allocation?.sources.map(s=>s.id)||[]};if(i.net!==policy.monthlySalary&&!meta.adjustment_note)fail(400,'Isi alasan penyesuaian jika nominal berbeda dari kebijakan gaji.');}
 return meta;
}
function editable(u,env,row){if(row.cancelled_at)fail(409,'Pengajuan sudah dibatalkan. Buat pengajuan baru bila diperlukan.');if(!payrollOperator(u,env)&&!(financeOwner(u)&&row.creator===u.id))fail(403,'Draf hanya dapat disunting Finance atau Direktur pembuatnya.');if(!['draft','returned'].includes(row.status))fail(409,'Pengajuan sudah dikirim dan tidak dapat diubah.');}
function version(row,v){if(!Number.isInteger(v)||row.version!==v)fail(409,'Pengajuan telah berubah. Muat ulang sebelum melanjutkan.');}
function eventStatement(env,id,event,u,action,snapshot){return q(env,'INSERT INTO yg_payroll_events(id,request_id,actor_email,action,version,snapshot,created_at) SELECT ?,id,?,?,version,?,updated_at FROM yg_payroll_requests WHERE id=? AND last_event=?',event,u.email,action,JSON.stringify(snapshot),id,event);}
async function mutate(env,statements){try{const result=await env.DB.batch(statements);if(!result[0].meta.changes)fail(409,'Pengajuan telah berubah. Muat ulang sebelum melanjutkan.');}catch(e){if(String(e.message).includes('UNIQUE constraint failed: yg_payroll_requests.period'))fail(409,'Sudah ada pengajuan aktif atau disetujui untuk bulan ini.');if(String(e.message).includes('UNIQUE constraint failed'))fail(409,'Nomor formulir, referensi pembayaran, atau mutasi sudah digunakan.');throw e;}}

export async function payrollRoute(req,env,u,ctx){
 if(!payrollAccess(u,env))fail(403,'Pengajuan gaji hanya untuk staf Finance yang ditunjuk dan Direktur.');
 const url=new URL(req.url),path=url.pathname;
 if(req.method!=='GET'&&req.headers.get('Origin')!==env.APP_ORIGIN)fail(403,'Asal permintaan tidak valid.');
 if(path==='/finance/payroll'||path==='/finance/payroll/'){
  if(req.method!=='GET')fail(405,'Metode tidak didukung.');
  return new Response(payrollPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 if(path==='/finance/payroll/guide'&&req.method==='GET')return new Response(payrollGuide(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 const prefix='/finance/payroll/api';
 if(path==='/finance/payroll/staff'&&req.method==='GET')return new Response(staffTermsPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(path===prefix+'/staff-terms'&&req.method==='GET')return Response.json({director:financeOwner(u),rows:await staffTerms(env)});
 if(path===prefix+'/staff-terms'&&req.method==='POST'){if(!financeOwner(u))fail(403,'Hanya Direktur dapat menetapkan data gaji.');return Response.json(await saveStaffTerm(env,u,await input(req)),{status:201});}
 if(path===prefix+'/email-service'&&req.method==='GET')return Response.json(await payrollEmailService(env));
 if(path==='/finance/payroll/report'&&req.method==='GET')return new Response(payrollReportPage(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 if(path===prefix+'/defaults'&&req.method==='GET')return Response.json(await payrollDefaults(env,u,url.searchParams.get('period')));
 if(path===prefix+'/report'&&req.method==='GET')return Response.json(await payrollReport(env,u));
 if(path===prefix+'/bank'&&req.method==='GET'){
  const source=await payrollSource(env,u),used=(await q(env,'SELECT bank_entry_id FROM yg_payroll_payments WHERE bank_entry_id IS NOT NULL').all()).results.map(x=>x.bank_entry_id);
  return Response.json({account:source.bank.account,asOf:source.asOf,entries:source.entries.filter(e=>e.debit>0&&!used.includes(bankId(source,e))).map(e=>({id:bankId(source,e),date:dateKey(e.date),reference:e.reference,amount:e.debit,description:e.description}))});
 }
 if(path==='/finance/payroll/print-preview'&&req.method==='GET'){
  const period=url.searchParams.get('period')||today().slice(0,7),data=await payrollDefaults(env,u,period);
  return new Response(payrollPrint({...data,id:'preview',preview:true,status:'preview',period,total:data.items.reduce((sum,i)=>sum+i.net,0),created_at:today(),creator_email:'',version:0,form_meta:{...data.form_meta,number:'PRATINJAU — belum diberi nomor'},payments:[]}),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 const pdf=path.match(/^\/finance\/payroll\/pdf\/([a-f0-9-]{36})$/);
 if(pdf&&req.method==='GET'){
  const r=await read(env,pdf[1]);if(r.cancelled_at)fail(409,'Pengajuan sudah dibatalkan; dokumen persetujuan tidak berlaku.');
  const file=await q(env,'SELECT * FROM yg_payroll_documents WHERE request_id=?',r.id).first();if(!file)fail(404,'PDF final belum tersedia untuk pengajuan ini.');
  const object=await env.MEDIA.get(file.object_key);if(!object)fail(404,'PDF belum dapat dibaca.');
  const bytes=new Uint8Array(await object.arrayBuffer());if(await pdfHash(bytes)!==file.sha256)fail(503,'Pemeriksaan dokumen gagal.');
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="'+file.filename+'"','Cache-Control':'no-store'}});
 }
 const reviewPage=path.match(/^\/finance\/payroll\/review\/([a-f0-9-]{36})$/);
 if(reviewPage&&req.method==='GET'){
  const r=await detail(env,reviewPage[1]);let review=null;
  if(financeOwner(u)&&r.status==='submitted'){
   await q(env,'INSERT OR IGNORE INTO yg_payroll_reviews(token,request_id,actor_email,version,opened_at) VALUES(?,?,?,?,?)',uuid(),r.id,u.email,r.version,now()).run();
   review=await q(env,'SELECT * FROM yg_payroll_reviews WHERE request_id=? AND actor_email=? AND version=?',r.id,u.email,r.version).first();
  }
  return new Response(payrollReviewPage(r,review,signatureDataUrl(await documentSignature(env,r))),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 const print=path.match(/^\/finance\/payroll\/print\/([a-f0-9-]{36})$/);
 if(print&&req.method==='GET'){
  const r=await detail(env,print[1]),token=url.searchParams.get('review');
  if(token){
   if(!financeOwner(u))fail(403,'Hanya Direktur yang dapat mencatat pemeriksaan.');
   const evidence=await q(env,'SELECT * FROM yg_payroll_reviews WHERE token=? AND request_id=? AND actor_email=? AND version=?',token,r.id,u.email,r.version).first();
   if(!evidence||r.status!=='submitted')fail(409,'Formulir berubah. Buka ulang review versi terbaru.');
   await q(env,'UPDATE yg_payroll_reviews SET print_opened_at=? WHERE token=?',now(),token).run();
  }
  return new Response(payrollPrint(r,signatureDataUrl(await documentSignature(env,r))),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 if(path===prefix&&req.method==='GET')return Response.json({user:{name:u.name,email:u.email,director:financeOwner(u),operator:payrollOperator(u,env)},requests:(await q(env,'SELECT id,period,CASE WHEN cancelled_at IS NOT NULL THEN \'cancelled\' ELSE status END AS status,total,creator_email,version,created_at,updated_at,cancelled_at FROM yg_payroll_requests ORDER BY period DESC,created_at DESC LIMIT 500').all()).results});
 if(path===prefix&&req.method==='POST'){
  if(!payrollAccess(u,env))fail(403,'Pengajuan dibuat oleh Finance atau Direktur.');
  const raw=await input(req),data=payrollInput(raw),id=uuid(),event=uuid(),at=now(),meta=await formMeta(env,u,raw.form_meta,data,id);
  await mutate(env,[q(env,"INSERT INTO yg_payroll_requests(id,period,status,creator,creator_email,items,total,notes,last_event,created_at,updated_at,form_meta) VALUES(?,?,'draft',?,?,?,?,?,?,?,?,?)",id,data.period,u.id,u.email,JSON.stringify(data.items),data.total,data.notes,event,at,at,JSON.stringify(meta)),eventStatement(env,id,event,u,'created',{...data,form_meta:meta})]);
  return Response.json(await detail(env,id),{status:201});
 }
 const match=path.match(/^\/finance\/payroll\/api\/([a-f0-9-]{36})(?:\/(submit|approve|return|files|payments|notify|cancel)(?:\/([a-f0-9-]{36}))?)?$/);
 if(!match)fail(404,'Halaman pengajuan tidak ditemukan.');
 const [,id,action,fileId]=match,row=await read(env,id);
 if(!action&&req.method==='GET')return Response.json(await detail(env,id));
 if(action==='cancel'&&req.method==='POST'&&!fileId){
  if(row.cancelled_at)return Response.json(await detail(env,id));
  const data=await input(req);version(row,data.version);const reason=text(data.reason||'',1000,true),event=uuid(),at=now();
  if((await q(env,'SELECT COUNT(*) n FROM yg_payroll_payments WHERE request_id=?',id).first()).n)fail(409,'Pengajuan sudah memiliki pembayaran. Pembatalan tidak boleh menghapus realisasi yang telah dicatat.');
  if(await q(env,"SELECT id FROM yg_payroll_notifications WHERE request_id=? AND lease_until>?",id,at).first())fail(409,'Email sedang diproses. Tunggu sebentar, muat ulang, lalu batalkan.');
  await mutate(env,[
   q(env,"UPDATE yg_payroll_requests SET cancelled_at=?,cancelled_by=?,cancellation_reason=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND cancelled_at IS NULL AND NOT EXISTS(SELECT 1 FROM yg_payroll_payments WHERE request_id=?) AND NOT EXISTS(SELECT 1 FROM yg_payroll_notifications WHERE request_id=? AND lease_until>?)",at,u.email,reason,event,at,id,row.version,id,id,at),
   eventStatement(env,id,event,u,'cancelled',{...serialize(row),status:'cancelled',reason,cancelled_by:u.email,cancelled_at:at}),
   q(env,"UPDATE yg_payroll_notifications SET status='cancelled',lease_until=NULL,error='Pengajuan dibatalkan; email tidak dilanjutkan.' WHERE request_id=? AND status!='sent' AND EXISTS(SELECT 1 FROM yg_payroll_requests WHERE id=? AND last_event=?)",id,id,event)
  ]);
  return Response.json(await detail(env,id));
 }
 if(row.cancelled_at&&req.method!=='GET')fail(409,'Pengajuan sudah dibatalkan. Tidak dapat diajukan, disetujui, dibayar, atau dikirim ulang.');
 if(action==='notify'&&!fileId&&req.method==='POST'){
  if(row.status!=='approved')fail(409,'Email hanya untuk pengajuan yang telah disetujui.');
  await q(env,"UPDATE yg_payroll_notifications SET attempts=0,next_attempt_at=? WHERE request_id=? AND status NOT IN ('sent','cancelled') AND (lease_until IS NULL OR lease_until<?)",now(),id,now()).run();
  await sendPayrollNotifications(env,id);
  return Response.json(await detail(env,id));
 }
 if(action==='payments'&&!fileId&&req.method==='POST'){
  if(!payrollOperator(u,env))fail(403,'Pembayaran dicatat oleh Finance.');if(row.status!=='approved')fail(409,'Pengajuan harus disetujui terlebih dahulu.');
  const data=await input(req),pid=text(data.id,36,true);if(!/^[a-f0-9-]{36}$/.test(pid))fail(400,'ID pembayaran tidak valid.');
  const prior=await q(env,'SELECT * FROM yg_payroll_payments WHERE id=?',pid).first();if(prior){if(prior.request_id!==id||prior.paid_date!==data.paid_date||prior.source_account!==data.source_account||prior.reference!==String(data.reference||'').trim()||prior.notes!==String(data.notes||'').trim()||JSON.stringify(JSON.parse(prior.allocations).map(a=>({staff_id:a.staff_id,amount:a.amount})))!==JSON.stringify(data.allocations)||JSON.stringify(JSON.parse(prior.proof_ids))!==JSON.stringify(data.proof_ids))fail(409,'ID pembayaran telah digunakan dengan rincian berbeda.');return Response.json(await detail(env,id));}
  version(row,data.version);const paymentDate=validDate(data.paid_date);if(paymentDate>today())fail(400,'Tanggal pembayaran tidak boleh di masa depan.');
  const reference=text(data.reference,140,true);if(['-','0'].includes(reference))fail(400,'Isi nomor referensi transfer yang sebenarnya.');
  const source=await payrollSource(env,u);if(data.source_account!==source.bank.account)fail(400,'Rekening sumber harus sesuai rekening pada register keuangan.');
  const current=await detail(env,id),approved=new Map(current.items.map(i=>[i.staff_id||staffKey(i.name),i]));
  if(!Array.isArray(data.allocations)||!data.allocations.length||data.allocations.length>100)fail(400,'Pilih penerima dan nominal pembayaran.');
  let total=0;const seen=new Set(),allocations=data.allocations.map(a=>{const i=approved.get(a.staff_id);if(!i||seen.has(a.staff_id)||!Number.isSafeInteger(a.amount)||a.amount<=0)fail(400,'Alokasi pembayaran tidak valid.');seen.add(a.staff_id);const paid=current.payments.flatMap(p=>p.allocations).filter(x=>x.staff_id===a.staff_id).reduce((s,x)=>s+x.amount,0);if(paid+a.amount>i.net)fail(400,'Pembayaran melebihi gaji yang disetujui untuk '+i.name+'.');total+=a.amount;return {staff_id:a.staff_id,name:i.name,amount:a.amount};});
  const proofs=data.proof_ids;if(!Array.isArray(proofs)||!proofs.length||proofs.length>10||new Set(proofs).size!==proofs.length)fail(400,'Lampirkan minimal satu bukti transfer.');
  for(const fid of proofs)if(!current.files.some(f=>f.id===fid&&f.purpose==='payment'))fail(400,'Bukti transfer tidak sesuai pengajuan.');
  const linked=data.bank_entry_id||null,payment={source_account:source.bank.account,paid_date:paymentDate,amount:total,reference,bank_entry_id:linked};
  const resolved=resolveBank(source,payment);if(resolved.issue)fail(409,resolved.issue+' Pilih mutasi yang benar sebelum mencatat pembayaran.');
  if(linked&&!resolved.entry)fail(400,'Mutasi tidak ditemukan.');
  const bankEntry=resolved.entry?bankId(source,resolved.entry):null;
  const event=uuid(),at=now(),notes=text(data.notes||'',2000),snapshot={...payment,id:pid,allocations,proof_ids:proofs,notes};
  await mutate(env,[q(env,"UPDATE yg_payroll_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status='approved'",event,at,id,row.version),q(env,'INSERT INTO yg_payroll_payments(id,request_id,paid_date,source_account,reference,amount,allocations,proof_ids,bank_entry_id,notes,actor_email,created_at) SELECT ?,id,?,?,?,?,?,?,?,?,?,? FROM yg_payroll_requests WHERE id=? AND last_event=?',pid,paymentDate,source.bank.account,reference,total,JSON.stringify(allocations),JSON.stringify(proofs),bankEntry,notes,u.email,at,id,event),eventStatement(env,id,event,u,'paid',snapshot)]);
  return Response.json(await detail(env,id),{status:201});
 }
 if(action==='files'&&fileId&&req.method==='GET'){
  const f=await q(env,'SELECT * FROM yg_payroll_files WHERE id=? AND request_id=?',fileId,id).first();if(!f)fail(404,'Lampiran tidak ditemukan.');const obj=await env.MEDIA.get(f.object_key);if(!obj)fail(404,'Berkas tidak ditemukan.');
  return new Response(obj.body,{headers:{'Content-Type':f.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.filename),'Cache-Control':'no-store'}});
 }
 if(action==='files'&&!fileId&&req.method==='POST'){
  const purpose=req.headers.get('X-File-Purpose')==='payment'?'payment':'support';
  if(purpose==='payment'){if(!payrollOperator(u,env))fail(403,'Bukti transfer ditambahkan oleh Finance.');if(row.status!=='approved')fail(409,'Bukti transfer hanya untuk pengajuan yang sudah disetujui.');}else editable(u,env,row);
  version(row,Number(req.headers.get('X-Payroll-Version')));
  const count=await q(env,'SELECT COUNT(*) AS n FROM yg_payroll_files WHERE request_id=?',id).first();if(count.n>=30)fail(400,'Maksimal 30 lampiran per pengajuan.');
  let filename;try{filename=decodeURIComponent(req.headers.get('X-Filename')||'');}catch{fail(400,'Nama berkas tidak valid.');}filename=text(filename,180,true);if(/[\x00-\x1f\\/]/.test(filename))fail(400,'Nama berkas tidak valid.');
  const bytes=await body(req,5*1024*1024),head=new TextDecoder().decode(bytes.slice(0,5));
  const mime=head==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':null;
  if(!mime)fail(400,'Lampiran harus PDF, JPEG, atau PNG.');
  const fid=uuid(),key='payroll-private/'+id+'/'+fid,event=uuid(),at=now();await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{await mutate(env,[q(env,'UPDATE yg_payroll_requests SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status=?',event,at,id,row.version,row.status),q(env,'INSERT INTO yg_payroll_files(id,request_id,object_key,filename,mime,size,actor_email,created_at,purpose) SELECT ?,id,?,?,?,?,?,?,? FROM yg_payroll_requests WHERE id=? AND last_event=?',fid,key,filename,mime,bytes.length,u.email,at,purpose,id,event),eventStatement(env,id,event,u,'attached',{file_id:fid,filename,size:bytes.length,purpose})]);}
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
  const data=await input(req);version(row,data.version);const event=uuid(),at=now();let statement,snapshot,kind,document;
  if(!action){
   editable(u,env,row);const changed=payrollInput(data),meta=await formMeta(env,u,data.form_meta,changed,id,JSON.parse(row.form_meta||'{}'));snapshot={...changed,form_meta:meta};kind='updated';
   statement=q(env,'UPDATE yg_payroll_requests SET period=?,items=?,total=?,notes=?,form_meta=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',changed.period,JSON.stringify(changed.items),changed.total,changed.notes,JSON.stringify(meta),event,at,id,row.version);
  }else{
   if(action==='submit'){editable(u,env,row);payrollInput(serialize(row));}
   else {if(!financeOwner(u))fail(403,'Hanya Direktur yang dapat menyetujui atau mengembalikan.');if(row.status!=='submitted')fail(409,'Hanya pengajuan yang sudah diajukan dapat ditinjau.');}
   let evidence=null;
   if(action==='approve'){
    if(data.review_confirmed!==true||typeof data.review_token!=='string')fail(409,'Buka Review formulir dan hasil cetak, lalu konfirmasikan pemeriksaan sebelum menyetujui.');
    evidence=await q(env,'SELECT * FROM yg_payroll_reviews WHERE token=? AND request_id=? AND actor_email=? AND version=?',data.review_token,id,u.email,row.version).first();
    if(!evidence?.print_opened_at)fail(409,'Buka hasil cetak dari halaman review terlebih dahulu. Jika formulir berubah, review ulang versi terbaru.');
   }
   const note=text(data.note||'',4000,action==='return'),status={submit:'submitted',approve:'approved',return:'returned'}[action];kind=status;
   const files=(await q(env,'SELECT id,filename,size FROM yg_payroll_files WHERE request_id=? ORDER BY id',id).all()).results;
   snapshot={...serialize(row),status,review_note:note,files,review_evidence:evidence,self_approved:action==='approve'&&row.creator===u.id,submitted_by:action==='submit'?u.email:null};
   statement=q(env,'UPDATE yg_payroll_requests SET status=?,review_note=?,submitted_at=?,reviewed_at=?,reviewer_email=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=?',status,note,action==='submit'?at:row.submitted_at,action==='submit'?null:at,action==='submit'?null:u.email,event,at,id,row.version);
  }
  if(action==='approve'){
   try{document=await savePayrollPdf(env,{...serialize(row),status:'approved',reviewed_at:at,reviewer_email:u.email,version:row.version+1},event,at);}
   catch{fail(503,'PDF formulir belum berhasil dibuat. Persetujuan belum disimpan; coba kembali.');}
   snapshot.document={filename:document.filename,sha256:document.sha256};
  }
  await mutate(env,[statement,eventStatement(env,id,event,u,kind,snapshot),...(action==='approve'?[q(env,'INSERT INTO yg_payroll_documents(request_id,approval_event,object_key,filename,sha256,size,created_at) SELECT id,?,?,?,?,?,? FROM yg_payroll_requests WHERE id=? AND last_event=?',event,document.object_key,document.filename,document.sha256,document.size,at,id,event),payrollNotificationStatement(env,row,event,at,document)]:[])]);
  if(action==='approve'&&ctx)ctx.waitUntil(sendPayrollNotifications(env,id));
  return Response.json(await detail(env,id));
 }
 fail(405,'Metode tidak didukung.');
}
