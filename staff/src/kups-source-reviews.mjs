import {fail,now} from './core.mjs';
const text=(v,max=2000)=>{if(typeof v!=='string'||v.length>max)fail(400,'Teks laporan sumber tidak valid.');return v;};
const amount=v=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)fail(400,'Nominal laporan sumber tidak valid.');return v;};
export function validateSourceReview(input){
 if(!input||input.schema!==1||!Array.isArray(input.months)||!input.months.length||input.months.length>120||!Array.isArray(input.rows)||input.rows.length>2000||!Array.isArray(input.notes)||input.notes.length>300)fail(400,'Format laporan sumber tidak valid.');
 const title=text(input.title,160),reviewed_at=text(input.reviewed_at,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewed_at))fail(400,'Tanggal tinjauan tidak valid.');
 const months=input.months.map(m=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m.month))fail(400,'Periode sumber tidak valid.');
  const source=text(m.source,240);
  if(!/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(source))fail(400,'Gunakan tautan berkas Google Drive sumber.');
  return {month:m.month,opening:amount(m.opening),income:amount(m.income),expense:amount(m.expense),closing:amount(m.closing),source};
 });
 if(new Set(months.map(m=>m.month)).size!==months.length)fail(400,'Periode sumber berulang.');
 months.sort((a,b)=>a.month.localeCompare(b.month));
 const rows=input.rows.map(r=>{
  if(!Array.isArray(r)||r.length!==8||!months.some(m=>m.month===r[1])||!['income','expense'].includes(r[4]))fail(400,'Baris laporan sumber tidak valid.');
  return [text(r[0],80),r[1],text(r[2],100),text(r[3],500),r[4],amount(r[5]),text(r[6],160),text(r[7],240)];
 });
 if(new Set(rows.map(r=>r[0])).size!==rows.length||rows.some(r=>r[5]<=0))fail(400,'ID sumber berulang atau nominal tidak positif.');
 for(const m of months){
  const sum=kind=>rows.filter(r=>r[1]===m.month&&r[4]===kind).reduce((n,r)=>n+r[5],0);
  if(Math.abs(sum('income')-m.income)>0.01||Math.abs(sum('expense')-m.expense)>0.01||Math.abs(m.opening+m.income-m.expense-m.closing)>0.01)fail(400,'Total transaksi tidak cocok dengan buku kas sumber.');
 }
 const notes=input.notes.map(n=>{if(!Array.isArray(n)||n.length!==5)fail(400,'Catatan sumber tidak valid.');return [text(n[0],80),text(n[1],7),text(n[2]),text(n[3]),text(n[4])];});
 const pending=(input.pending||[]);
 if(!Array.isArray(pending)||pending.length>1000)fail(400,'Rincian rekonsiliasi tidak valid.');
 const staged=pending.map(r=>{if(!Array.isArray(r)||r.length!==9)fail(400,'Baris rincian tidak valid.');return [text(r[0],80),text(r[1],7),text(r[2],100),text(r[3],500),amount(r[4]),text(r[5]),text(r[6],240),text(r[7],80),text(r[8],240)];});
 return {schema:1,title,reviewed_at,status:'unverified',months,rows,notes,pending:staged};
}
export async function sourceReviewRoute(req,env,{method,u,g,q,json,body,requireAdmin,audit}){
 if(method==='GET'){
  const row=await q(env,'SELECT snapshot,version,updated_at FROM kups_source_reviews WHERE group_id=?',g).first();
  return json(row?{review:JSON.parse(row.snapshot),version:row.version,updated_at:row.updated_at}:{review:null,version:0});
 }
 if(method!=='POST')fail(405,'Metode tidak didukung.');
 requireAdmin(u);const b=await body(req);
 if(!Number.isSafeInteger(b.version)||b.version<0)fail(400,'Versi laporan tidak valid.');
 const snapshot=validateSourceReview(b.review),stamp=now();
 const statement=q(env,`INSERT INTO kups_source_reviews(group_id,snapshot,version,updated_by,updated_at)
 SELECT ?,?,1,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM kups_source_reviews WHERE group_id=? AND version=?)
 ON CONFLICT(group_id) DO UPDATE SET snapshot=excluded.snapshot,version=kups_source_reviews.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE kups_source_reviews.version=?`,g,JSON.stringify(snapshot),u.email,stamp,b.version,g,b.version,b.version);
 const record=q(env,'INSERT INTO kups_audit SELECT ?,?,?,?,?,?,? WHERE changes()>0',crypto.randomUUID(),g,u.email,'source-review',g,JSON.stringify({title:snapshot.title,status:snapshot.status,months:snapshot.months.map(m=>m.month),rows:snapshot.rows.length}),stamp);
 const result=await env.DB.batch([statement,record]);
 if(!result[0].meta.changes)fail(409,'Laporan sumber berubah. Muat ulang sebelum menyimpan.');
 return json({ok:true,status:'unverified',rows:snapshot.rows.length});
}
