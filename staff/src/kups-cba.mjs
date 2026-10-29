import {fail,now} from './core.mjs';
const fields=['npm_pineapple','npm_mpts','npm_shared','npm_cost','kups_existing','kups_new','kups_chili','kups_cost','queen_income','madu_income','chili_income','kups_income','opening','adjustment','closing','mpts_income','queen_harvest','madu_harvest','chili_kg'];
const validMonth=v=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(v||'');
const nextMonth=v=>{const [y,m]=v.split('-').map(Number);return m===12?(y+1)+'-01':y+'-'+String(m+1).padStart(2,'0');};
export function validateCbaPlan(p){
 if(!p||p.schema!=='dayun-cba-plan-v1'||!Array.isArray(p.months)||p.months.length<1||p.months.length>120||!validMonth(p.start)||!validMonth(p.end)||typeof p.source_name!=='string'||p.source_name.length>180||!/^[a-f0-9]{64}$/.test(p.source_sha256||''))fail(400,'Format rencana CBA tidak valid.');
 if(!Number.isFinite(p.opening)||p.opening<0||!Number.isFinite(p.reserve)||p.reserve<0)fail(400,'Saldo awal dan cadangan CBA tidak valid.');
 let expected=p.start,opening=p.opening;
 for(const m of p.months){
  if(m.month!==expected||fields.some(k=>!Number.isFinite(m[k])||Math.abs(m[k])>1e13))fail(400,'Bulan atau angka CBA tidak valid.');
  if(fields.filter(k=>!['closing','adjustment','opening'].includes(k)).some(k=>m[k]<0))fail(400,'Produksi, penerimaan dan biaya tidak boleh negatif.');
  const same=(a,b)=>Math.abs(a-b)<0.02;
  if(!same(m.opening,opening)||!same(m.opening+m.kups_income-m.kups_cost+m.adjustment,m.closing)||!same(m.kups_existing+m.kups_new+m.kups_chili,m.kups_cost)||!same(m.queen_income+m.madu_income+m.chili_income+m.mpts_income,m.kups_income)||!same(m.npm_pineapple+m.npm_mpts+m.npm_shared,m.npm_cost))fail(400,'Perhitungan rencana CBA tidak seimbang.');
  opening=m.closing;expected=nextMonth(expected);
 }
 if(p.months.at(-1).month!==p.end)fail(400,'Akhir periode CBA tidak sesuai.');
 return {schema:p.schema,source_name:p.source_name,source_sha256:p.source_sha256,source_sheet:'Cashflow',version_date:String(p.version_date||'').slice(0,10),start:p.start,end:p.end,opening:p.opening,reserve:p.reserve,months:p.months.map(m=>Object.fromEntries(['month',...fields].map(k=>[k,m[k]])))};
}
export async function cbaRoute(req,env,url,c){
 const {path,method,q,g,u,group,access,json,body,requireAdmin,write,audit}=c;
 if(!path.startsWith('/cba'))return null;
 if(g!=='dayun-rimba-sejahtera')fail(404,'CBA hanya tersedia untuk KUPS Dayun.');
 if(path==='/cba/plan'&&method==='PUT'){
  requireAdmin(u);const b=await body(req),plan=validateCbaPlan(b.plan),old=await q(env,'SELECT version FROM kups_cba_plans WHERE group_id=?',g).first();
  if(!Number.isInteger(b.version)||b.version!==(old?.version||0))fail(409,'Rencana sudah berubah. Muat ulang sebelum mengimpor.');
  const sql=old?'UPDATE kups_cba_plans SET payload=?,version=version+1,updated_by=?,updated_at=? WHERE group_id=? AND version=?':'INSERT INTO kups_cba_plans(payload,updated_by,updated_at,group_id,version) SELECT ?,?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM kups_cba_plans WHERE group_id=?)';
  const result=await env.DB.batch([q(env,sql,JSON.stringify(plan),u.email,now(),g,old?b.version:g)]);
  if(!result[0].meta.changes)fail(409,'Rencana sudah berubah. Muat ulang.');
  await audit(env,u,g,'cba_plan',g,{version:b.version+1,source_sha256:plan.source_sha256,source_name:plan.source_name}).run();
  return json({ok:true,version:b.version+1});
 }
 if(path==='/cba'&&method==='GET'){
  const saved=await q(env,'SELECT * FROM kups_cba_plans WHERE group_id=?',g).first();
  const plan=saved?JSON.parse(saved.payload):null;
  const transactions=plan?(await q(env,'SELECT * FROM kups_transactions WHERE group_id=? AND deleted_at IS NULL AND substr(date,1,7)>=? AND substr(date,1,7)<=? ORDER BY date,created_at,id',g,plan.start,plan.end).all()).results:[];
  const npm_costs=(await q(env,'SELECT * FROM kups_cba_costs WHERE group_id=? AND deleted_at IS NULL ORDER BY date,created_at,id',g).all()).results;
  return json({group:{id:g,name:group.name,closed_through:group.closed_through},access,plan,plan_version:saved?.version||0,plan_updated_at:saved?.updated_at||null,transactions,npm_costs});
 }
 if(path==='/cba/costs'&&method==='POST'){
  write();const b=await body(req);const date=new Date(b.date+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==b.date||!['Nanas','MPTS','Operasional bersama'].includes(b.category)||typeof b.description!=='string'||!b.description.trim()||b.description.length>500||!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>1e12||typeof b.activity_ref!=='string'||b.activity_ref.length>120||!/^[a-f0-9-]{36}$/.test(b.id||''))fail(400,'Isi biaya NPM yang valid.');
  const saved=await q(env,'SELECT payload FROM kups_cba_plans WHERE group_id=?',g).first();const plan=saved&&JSON.parse(saved.payload);if(!plan||b.date.slice(0,7)<plan.start||b.date.slice(0,7)>plan.end)fail(400,'Tanggal di luar periode CBA.');
  const existing=await q(env,'SELECT * FROM kups_cba_costs WHERE id=?',b.id).first();
  if(existing){if(existing.group_id===g&&existing.date===b.date&&existing.category===b.category&&existing.description===b.description.trim()&&existing.amount===b.amount&&existing.activity_ref===b.activity_ref&&!existing.deleted_at)return json({ok:true,reused:true});fail(409,'ID biaya sudah dipakai.');}
  await env.DB.batch([q(env,'INSERT INTO kups_cba_costs(id,group_id,date,category,description,amount,activity_ref,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)',b.id,g,b.date,b.category,b.description.trim(),b.amount,b.activity_ref,u.email,now()),audit(env,u,g,'cba_npm_cost',b.id,{...b})]);
  return json({ok:true},201);
 }
 const voidCost=path.match(/^\/cba\/costs\/([a-f0-9-]{36})\/void$/);
 if(voidCost&&method==='POST'){
  write();const b=await body(req);if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>500)fail(400,'Isi alasan pembatalan.');
  const old=await q(env,'SELECT * FROM kups_cba_costs WHERE id=? AND group_id=? AND deleted_at IS NULL',voidCost[1],g).first();if(!old)fail(404,'Biaya aktif tidak ditemukan.');
  await env.DB.batch([q(env,'UPDATE kups_cba_costs SET deleted_at=? WHERE id=? AND group_id=?',now(),old.id,g),audit(env,u,g,'cba_npm_void',old.id,{reason:b.reason,before:old})]);return json({ok:true});
 }
 fail(404,'Halaman CBA tidak ditemukan.');
}
