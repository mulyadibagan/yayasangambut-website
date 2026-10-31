import {cbaRoute} from './kups-cba.mjs';
import {activitiesRoute,publicActivities} from './kups-activities.mjs';
import {detailsRoute,ledgerDetails,categories} from './kups-ledger-details.mjs';
import {saveClosingReconciliation} from './kups-reconciliation.mjs';
import {balancesAt,entireReport} from './kups-reporting.mjs';
import {fail,now,imageType} from './core.mjs';
import {validateWebgisSession} from './webgis-sso.mjs';
const origin='https://webgisyg.id';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const json=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Filename','Vary':'Origin'}});
export const validMonth=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v||'');
export function validDate(v){const d=new Date(v+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
export function money(v,zero=false){if(!Number.isSafeInteger(v)||v<(zero?0:1)||v>1e12)fail(400,'Isi nominal rupiah bulat yang valid.');return v;}
export function openingBalance(v){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12||!/^\d+(?:\.\d{1,6})?$/.test(String(v)))fail(400,'Saldo awal harus berupa angka positif, maksimal enam angka desimal.');return v;}
const str=(v,max)=>{if(typeof v!=='string'||v.length>max)fail(400,'Isi teks yang valid.');return v.trim();};
export function validateTransaction(b,strict=false){
 if(!validDate(b.date)||!['income','expense'].includes(b.kind))fail(400,'Tanggal atau jenis transaksi tidak valid.');
 const p={date:b.date,kind:b.kind,category:str(b.category,80),description:str(b.description,500),amount:money(b.amount),quantity:b.quantity??null,unit:str(b.unit||'',20),unit_price:b.unit_price==null?null:money(b.unit_price,true),object_id:str(b.object_id||'',80),evidence_id:str(b.evidence_id||'',80),source_ref:str(b.source_ref||'',120),account:b.account||'unassigned',counterparty:str(b.counterparty||'',160),product:str(b.product||'',100),activity:str(b.activity||'',200)};
 if(!['cash','bank','unassigned'].includes(p.account))fail(400,'Akun pembayaran tidak valid.');
 if(strict&&!categories[p.kind]?.includes(p.category))fail(400,'Kategori tidak sesuai jenis transaksi.');
 if(!p.category||!p.description)fail(400,'Isi kategori dan uraian.');
 if(p.quantity!==null&&(!Number.isFinite(p.quantity)||p.quantity<=0||p.quantity>1e9||!p.unit))fail(400,'Isi jumlah positif dan satuannya.');
 return p;
}
async function body(req){if(Number(req.headers.get('content-length')||0)>200000)fail(413,'Data terlalu besar.');const reader=req.body?.getReader();let size=0;const parts=[];if(!reader)fail(400,'Data kosong.');while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>200000){await reader.cancel();fail(413,'Data terlalu besar.');}parts.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Data tidak valid.');}}
const ygStaff=u=>u.scope==='webgis-staff'&&/^[^@\s]+@yayasangambut\.org$/.test(u.email||'');
export function assertGroupAccess(u,member,write=false){
 if(u.scope==='webgis-staff'&&u.role==='admin')return 'admin';
 if(member?.disabled||(!member&&!ygStaff(u)))fail(403,'Email Anda belum memiliki akses keuangan kelompok ini.');
 const role=member?.role||'viewer';
 if(write&&role!=='treasurer')fail(403,'Akses bendahara diperlukan.');
 return role;
}
const audit=(env,u,g,action,target,data)=>q(env,'INSERT INTO kups_audit VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),g,u.email,action,target,JSON.stringify(data),now());
const requireAdmin=u=>{if(u.scope!=='webgis-staff'||u.role!=='admin')fail(403,'Akses admin YG diperlukan.');};
async function verifyEvidence(env,g,id){if(id&&!await q(env,'SELECT id FROM kups_evidence WHERE id=? AND group_id=?',id,g).first())fail(400,'Bukti tidak ditemukan pada kelompok ini.');}
async function insertTx(env,u,g,p,id=crypto.randomUUID()){
 return q(env,'INSERT INTO kups_transactions(id,group_id,date,kind,category,description,amount,quantity,unit,unit_price,object_id,evidence_id,source_ref,created_by,updated_by,created_at,updated_at,account,counterparty,product,activity) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,g,p.date,p.kind,p.category,p.description,p.amount,p.quantity,p.unit,p.unit_price,p.object_id,p.evidence_id,p.source_ref,u.email,u.email,now(),now(),p.account,p.counterparty,p.product,p.activity);
}
export async function finance(req,env,url){
 if(req.method==='OPTIONS')return json({},204);
 if(req.headers.get('Origin')!==origin)return json({error:'Alamat aplikasi tidak diizinkan.'},403);
 try{
 const raw=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 if(!raw){const publicResponse=await publicActivities(req,env,url,{q,json});if(publicResponse)return publicResponse;}
 const u=await validateWebgisSession(env,raw);if(!u)fail(401,'Silakan masuk dengan Google.');
 if(!['webgis-staff','kups-finance'].includes(u.scope))fail(403,'Akses tidak diizinkan.');
 const path=url.pathname.replace('/api/kups',''),method=req.method;
 if(path==='/groups'&&method==='GET'){
  const admin=u.scope==='webgis-staff'&&u.role==='admin';
  const sql=admin?"SELECT *,'admin' AS access FROM kups_groups":ygStaff(u)?"SELECT g.*,COALESCE(m.role,'viewer') AS access FROM kups_groups g LEFT JOIN kups_members m ON m.group_id=g.id AND m.email=? WHERE m.disabled IS NULL OR m.disabled=0":'SELECT g.*,m.role AS access FROM kups_groups g JOIN kups_members m ON m.group_id=g.id WHERE m.email=? AND m.disabled=0';
  const groups=(await q(env,sql,...(admin?[]:[u.email])).all()).results;
  return json({groups,user:{name:u.name,email:u.email,admin:u.scope==='webgis-staff'&&u.role==='admin'}});
 }
 const g=url.searchParams.get('group')||'';const group=await q(env,'SELECT * FROM kups_groups WHERE id=?',g).first();if(!group)fail(404,'Kelompok tidak ditemukan.');
 const member=await q(env,'SELECT * FROM kups_members WHERE group_id=? AND email=?',g,u.email).first();const access=assertGroupAccess(u,member);const write=()=>assertGroupAccess(u,member,true);
 if(path.startsWith('/activities'))return await activitiesRoute(req,env,url,{path,method,q,g,u,access,json,body});
 if(path.startsWith('/cba'))return await cbaRoute(req,env,url,{path,method,q,g,u,group,access,json,body,requireAdmin,write,audit});
 if(path==='/balances'&&method==='GET'){
  const date=url.searchParams.get('date'),exclude=url.searchParams.get('exclude')||'';
  if(!validDate(date)||group.start_date&&date<group.start_date)fail(400,'Pilih tanggal setelah awal pembukuan.');
  if(exclude&&!/^[a-f0-9-]{36}$/.test(exclude))fail(400,'Transaksi tidak valid.');
  return json(await balancesAt(env,q,g,group,date,exclude));
 }
 if(path==='/report'&&method==='GET')return json(await entireReport(env,q,g));
 if(path==='/reconciliation'&&method==='POST')return await saveClosingReconciliation(req,env,url,{u,g,group,requireAdmin,body,q,json});
 const extended=await detailsRoute(req,env,url,{u,g,group,write,requireAdmin,json,body,q,audit,verifyEvidence});if(extended)return extended;
 if(path==='/setup'&&method==='POST'){
  requireAdmin(u);const b=await body(req);openingBalance(b.opening_amount);const earliest=await q(env,'SELECT MIN(date) AS date FROM kups_transactions WHERE group_id=?',g).first();if(earliest.date&&b.start_date>earliest.date)fail(400,'Tanggal awal tidak boleh melewati transaksi yang sudah ada.');if(!validDate(b.start_date))fail(400,'Tanggal awal tidak valid.');
  const r=await env.DB.batch([q(env,'UPDATE kups_groups SET opening_amount=?,start_date=?,version=version+1 WHERE id=? AND opening_amount IS NULL AND version=?',b.opening_amount,b.start_date,g,b.version),q(env,"INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),g,u.email,'setup',g,JSON.stringify({opening_amount:b.opening_amount,start_date:b.start_date}),now())]);if(!r[0].meta.changes)fail(409,'Saldo sudah ditetapkan. Muat ulang.');return json({ok:true});
 }
 if(path==='/ledger'&&method==='GET'){
  const month=url.searchParams.get('month');if(!validMonth(month))fail(400,'Pilih bulan laporan.');if(group.start_date&&month<group.start_date.slice(0,7))fail(400,'Bulan sebelum awal pembukuan.');
  const rows=(await q(env,'SELECT * FROM kups_transactions WHERE group_id=? AND substr(date,1,7)=? ORDER BY date,created_at,id',g,month).all()).results;
  const prior=await q(env,"SELECT COALESCE(SUM(CASE WHEN kind='income' THEN amount ELSE -amount END),0) AS net FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL AND substr(date,1,7)<?",g,month).first();
  const active=rows.filter(t=>!t.deleted_at);const income=active.filter(t=>t.kind==='income').reduce((n,t)=>n+t.amount,0),expense=active.filter(t=>t.kind==='expense').reduce((n,t)=>n+t.amount,0);let opening=group.opening_amount===null?null:group.opening_amount+prior.net;
  const details=await ledgerDetails(env,q,g,group,month);
  if(details.opening_reconciliation)opening=details.accounts.reduce((n,a)=>n+a.opening,0);
  const chart=(await q(env,"SELECT substr(date,1,7) AS month,SUM(CASE WHEN kind='income' THEN amount ELSE 0 END) AS income,SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END) AS expense FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL AND substr(date,1,7)>=? AND substr(date,1,7)<=? GROUP BY substr(date,1,7) ORDER BY month",g,String(Number(month.slice(0,4))-1)+month.slice(4),month).all()).results;
  const period=await q(env,'SELECT * FROM kups_periods WHERE group_id=? AND month=?',g,month).first();const reconciliation=await q(env,'SELECT * FROM kups_reconciliations WHERE group_id=? AND month=?',g,month).first();return json({group,access,rows,summary:{opening,income,expense,closing:opening===null?null:opening+income-expense},chart,period,reconciliation,...details});
 }
 if(path==='/transactions'&&method==='POST'){
  write();if(group.opening_amount===null)fail(409,'Saldo awal belum ditetapkan.');const p=validateTransaction(await body(req),true);await verifyEvidence(env,g,p.evidence_id);const id=crypto.randomUUID();await env.DB.batch([await insertTx(env,u,g,p,id),audit(env,u,g,'create',id,p)]);return json({ok:true,id},201);
 }
 const match=path.match(/^\/transactions\/([a-f0-9-]{36})(?:\/(trash|restore))?$/);
 if(match&&['PUT','POST'].includes(method)){
  write();const [,id,action]=match,b=await body(req),old=await q(env,'SELECT * FROM kups_transactions WHERE id=? AND group_id=?',id,g).first();if(!old)fail(404,'Transaksi tidak ditemukan.');if(b.version!==old.version)fail(409,'Transaksi berubah. Muat ulang sebelum menyimpan.');
  let statement,snapshot;
  if(method==='PUT'&&!action){if(old.deleted_at)fail(409,'Pulihkan transaksi lebih dahulu.');const p=validateTransaction(b,true);await verifyEvidence(env,g,p.evidence_id);snapshot={before:old,after:p};statement=q(env,'UPDATE kups_transactions SET date=?,kind=?,category=?,description=?,amount=?,quantity=?,unit=?,unit_price=?,object_id=?,evidence_id=?,source_ref=?,account=?,counterparty=?,product=?,activity=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND group_id=? AND version=?',p.date,p.kind,p.category,p.description,p.amount,p.quantity,p.unit,p.unit_price,p.object_id,p.evidence_id,p.source_ref,p.account,p.counterparty,p.product,p.activity,u.email,now(),id,g,b.version);}
  else if(method==='POST'&&action){if((action==='trash')===!!old.deleted_at)fail(409,'Status transaksi sudah berubah.');snapshot={before:old,reason:str(b.reason||'',500)};if(action==='trash'&&!snapshot.reason)fail(400,'Isi alasan penghapusan.');statement=q(env,'UPDATE kups_transactions SET deleted_at=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND group_id=? AND version=?',action==='trash'?now():null,u.email,now(),id,g,b.version);}
  else fail(405,'Metode tidak diizinkan.');
  // Transaction statement and audit are atomic; abort stale races before writing audit.
  const results=await env.DB.batch([statement,q(env,"INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),g,u.email,action||'edit',id,JSON.stringify(snapshot),now())]);if(!results[0].meta.changes)fail(409,'Transaksi berubah. Muat ulang.');return json({ok:true});
 }
 if(path==='/members'&&method==='GET'){requireAdmin(u);return json((await q(env,'SELECT email,role,disabled FROM kups_members WHERE group_id=? ORDER BY email',g).all()).results);}
 if(path==='/members'&&method==='POST'){
  requireAdmin(u);const b=await body(req),email=str(b.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['viewer','treasurer'].includes(b.role)||typeof b.disabled!=='boolean')fail(400,'Email atau peran tidak valid.');
  if(email===u.email)fail(400,'Akses admin sendiri tidak dapat diubah di sini.');
  const targetUser=await q(env,'SELECT role FROM users WHERE email=?',email).first();if(targetUser?.role==='admin')fail(400,'Akun admin YG tidak dapat dipindahkan menjadi anggota KUPS.');
  await env.DB.batch([q(env,'INSERT INTO kups_members(group_id,email,role,disabled) VALUES(?,?,?,?) ON CONFLICT(group_id,email) DO UPDATE SET role=excluded.role,disabled=excluded.disabled',g,email,b.role,Number(b.disabled)),q(env,"INSERT INTO webgis_access(email,scope,disabled) VALUES(?,'kups-finance',0) ON CONFLICT(email) DO UPDATE SET scope='kups-finance',disabled=0",email),q(env,'DELETE FROM webgis_sessions WHERE user_id IN (SELECT id FROM users WHERE email=?)',email),audit(env,u,g,'member',email,b)]);return json({ok:true});
 }
 if(path==='/period'&&method==='POST'){
  requireAdmin(u);const b=await body(req);if(!validMonth(b.month)||!['close','reopen'].includes(b.action))fail(400,'Bulan tidak valid.');const note=str(b.note||'',500);if(group.opening_amount===null||b.month<group.start_date.slice(0,7))fail(400,'Tetapkan saldo awal dan pilih bulan pembukuan.');
  if(b.action==='close'){
   money(b.counted_amount,true);if(group.closed_through&&b.month<=group.closed_through)fail(409,'Bulan sudah ditutup.');
   const results=await env.DB.batch([q(env,'UPDATE kups_groups SET closed_through=?,version=version+1 WHERE id=? AND version=?',b.month,g,b.version),q(env,'INSERT INTO kups_periods(group_id,month,counted_amount,note,closed_by,closed_at) SELECT ?,?,?,?,?,? WHERE changes()>0 ON CONFLICT(group_id,month) DO UPDATE SET counted_amount=excluded.counted_amount,note=excluded.note,closed_by=excluded.closed_by,closed_at=excluded.closed_at',g,b.month,b.counted_amount,note,u.email,now()),q(env,"INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),g,u.email,'close',b.month,JSON.stringify(b),now())]);if(!results[0].meta.changes)fail(409,'Laporan berubah. Muat ulang.');
  }else{
   if(!note)fail(400,'Isi alasan membuka kembali laporan.');if(b.month!==group.closed_through)fail(409,'Buka bulan terakhir yang ditutup terlebih dahulu.');
   const previous=await q(env,'SELECT MAX(month) AS month FROM kups_periods WHERE group_id=? AND month<? AND closed_at IS NOT NULL',g,b.month).first();
   const results=await env.DB.batch([q(env,'UPDATE kups_groups SET closed_through=?,version=version+1 WHERE id=? AND version=?',previous.month||null,g,b.version),q(env,'UPDATE kups_periods SET closed_at=NULL,note=? WHERE group_id=? AND month=? AND changes()>0',note,g,b.month),q(env,"INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),g,u.email,'reopen',b.month,JSON.stringify(b),now())]);if(!results[0].meta.changes)fail(409,'Laporan berubah. Muat ulang.');
  }return json({ok:true});
 }
 if(path==='/history'&&method==='GET')return json((await q(env,'SELECT actor,action,target,snapshot,created_at FROM kups_audit WHERE group_id=? ORDER BY created_at DESC LIMIT 200',g).all()).results);
 if(path==='/import'&&method==='POST'){
  requireAdmin(u);const b=await body(req);if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>300)fail(400,'Impor 1–300 transaksi per berkas.');const rows=b.rows.map(validateTransaction);if(rows.some(p=>p.evidence_id||!p.source_ref))fail(400,'Impor membutuhkan referensi sumber unik tanpa ID bukti.');if(new Set(rows.map(p=>p.source_ref)).size!==rows.length)fail(400,'Referensi sumber berulang.');
  for(const p of rows){if(await q(env,'SELECT id FROM kups_transactions WHERE group_id=? AND source_ref=?',g,p.source_ref).first())fail(409,'Referensi sudah pernah diimpor: '+p.source_ref);}
  await env.DB.batch([q(env,'UPDATE kups_groups SET start_date=COALESCE(start_date,?) WHERE id=?',rows.map(p=>p.date).sort()[0],g),...(await Promise.all(rows.map(p=>insertTx(env,u,g,p)))),audit(env,u,g,'import',crypto.randomUUID(),{count:rows.length,references:rows.map(p=>p.source_ref),source_review:b.review||null})]);return json({ok:true,count:rows.length});
 }
 if(path==='/evidence'&&method==='POST'){
  write();if(!env.MEDIA)fail(503,'Penyimpanan bukti belum tersedia.');if(Number(req.headers.get('content-length')||0)>5242880)fail(413,'Bukti maksimal 5 MB.');const reader=req.body?.getReader();if(!reader)fail(400,'Berkas kosong.');let n=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>5242880){await reader.cancel();fail(413,'Bukti maksimal 5 MB.');}chunks.push(value);}const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const type=imageType(bytes)||(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-'?'application/pdf':null);if(!type)fail(400,'Gunakan PDF, JPEG, PNG, atau WebP.');let filename;try{filename=decodeURIComponent(req.headers.get('X-Filename')||'Bukti');}catch{fail(400,'Nama berkas tidak valid.');}filename=str(filename,180);const id=crypto.randomUUID();await env.MEDIA.put('kups/'+id,bytes,{httpMetadata:{contentType:type}});await env.DB.batch([q(env,'INSERT INTO kups_evidence VALUES(?,?,?,?,?,?,?)',id,g,filename,type,n,u.email,now()),audit(env,u,g,'evidence',id,{filename,size:n})]);return json({ok:true,id,filename});
 }
 const ev=path.match(/^\/evidence\/([a-f0-9-]{36})$/);if(ev&&method==='GET'){const meta=await q(env,'SELECT * FROM kups_evidence WHERE id=? AND group_id=?',ev[1],g).first();if(!meta)fail(404,'Bukti tidak ditemukan.');const file=await env.MEDIA.get('kups/'+ev[1]);if(!file)fail(404,'Bukti tidak tersedia.');const r=json({});return new Response(file.body,{headers:{...Object.fromEntries(r.headers),'Content-Type':meta.type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.filename),'X-Content-Type-Options':'nosniff'}});}
 fail(404,'Fitur tidak ditemukan.');
  }catch(e){
 const message=String(e.message),conflict=message.includes('KUPS_')||message.includes('UNIQUE constraint');
 const error=message.includes('KUPS_PERIOD_LOCKED')?'Periode ditutup atau tanggal sebelum awal pembukuan.':message.includes('KUPS_OVERPAYMENT')?'Pembayaran melebihi sisa tagihan atau tanggal/jenis tidak sesuai.':message.includes('KUPS_DOCUMENT_HAS_PAYMENTS')?'Nilai tagihan tidak boleh lebih kecil dari pembayaran. Hapus pembayaran aktif dahulu sebelum menghapus tagihan.':message.includes('UNIQUE constraint')?'Referensi atau permintaan sudah pernah disimpan. Muat ulang.':e.status?e.message:'Layanan keuangan belum dapat menyelesaikan permintaan.';
 return json({error},conflict?409:e.status||500);
 }
}


