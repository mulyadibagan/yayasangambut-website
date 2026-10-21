import {fail,now} from './core.mjs';
import {financeDashboardAccess} from './finance-access.mjs';
export const teamSizesAccess=financeDashboardAccess;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});
export function validateTeamSize(input){
 const name=String(input.name||'').trim().replace(/\s+/g,' '),size=String(input.size||'').toUpperCase();
 if(!name||name.length>160)fail(400,'Isi nama tim, maksimal 160 karakter.');
 if(!['XS','S','M','L','XL','XXL','3XL','4XL','5XL'].includes(size))fail(400,'Pilih ukuran kaos yang tersedia.');
 return {name,size};
}
export async function teamSizesApi(req,env,url,u,{payload}){
 if(!teamSizesAccess(u))fail(403,'Data ukuran kaos hanya untuk Mulyadi dan Riena.');
 const query=(sql,...args)=>env.DB.prepare(sql).bind(...args);
 if(url.pathname==='/api/team-sizes'&&req.method==='GET')return json((await query('SELECT id,name,size,version,updated_at FROM team_sizes ORDER BY name COLLATE NOCASE').all()).results);
 const match=url.pathname.match(/^\/api\/team-sizes\/([a-f0-9-]{36})$/);
 if((url.pathname==='/api/team-sizes'&&req.method==='POST')||(match&&req.method==='PUT')){
  const input=await payload(req),{name,size}=validateTeamSize(input),id=match?.[1]||crypto.randomUUID();
  if(await query('SELECT id FROM team_sizes WHERE name=? COLLATE NOCASE AND id<>?',name,id).first())fail(409,'Nama ini sudah tercatat. Sunting baris yang tersedia.');
  if(match){
   if(!Number.isSafeInteger(input.version))fail(400,'Versi data tidak valid.');
   const result=await query('UPDATE team_sizes SET name=?,size=?,version=version+1,updated_at=?,updated_by=? WHERE id=? AND version=?',name,size,now(),u.id,id,input.version).run();
   if(!result.meta.changes)fail(409,'Data sudah berubah. Muat ulang sebelum menyimpan.');
  }else await query('INSERT INTO team_sizes(id,name,size,updated_at,updated_by) VALUES(?,?,?,?,?)',id,name,size,now(),u.id).run();
  await query('INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',u.id,match?'team_size_update':'team_size_create',id,now()).run();
  return json({ok:true},match?200:201);
 }
 fail(404,'Halaman tidak ditemukan.');
}
