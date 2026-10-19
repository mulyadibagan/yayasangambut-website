import {fail,now,imageType} from './core.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const managers=new Set(['mulyadi@yayasangambut.org','rajaalpian@yayasangambut.org']);
export const assetManager=u=>!!u&&!u.disabled&&managers.has(u.email?.toLowerCase());
export const assetCode=id=>'YG-AST-'+String(id).padStart(4,'0');
export const conditions=['Perlu verifikasi','Baik','Perlu perbaikan','Rusak'];
const fields=['name','category','acquired_date','purchase_price','location','custodian','condition','serial_number','notes','ownership','owner_name','funding_source','acquired_year'];
export function assetInput(input){
 const out={};for(const key of fields){if(['purchase_price','acquired_year'].includes(key))continue;const value=String(input[key]??'').trim();if(value.length>(key==='notes'?4000:200))fail(400,'Isian terlalu panjang.');out[key]=value;}
 out.ownership=out.ownership||'yg';if(!['yg','personal'].includes(out.ownership))fail(400,'Status kepemilikan tidak valid.');out.owner_name=out.owner_name||(out.ownership==='yg'?'Yayasan Gambut':'');if(out.ownership==='personal'&&!out.owner_name)fail(400,'Nama pemilik pribadi wajib diisi.');
 out.acquired_year=input.acquired_year==null||input.acquired_year===''?null:Number(input.acquired_year);if(out.acquired_year!==null&&(!Number.isInteger(out.acquired_year)||out.acquired_year<1900||out.acquired_year>2100))fail(400,'Tahun perolehan tidak valid.');
 if(!out.name)fail(400,'Nama aset wajib diisi.');
 if(out.acquired_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.acquired_date)||!Number.isFinite(Date.parse(out.acquired_date))||new Date(out.acquired_date).toISOString().slice(0,10)!==out.acquired_date))fail(400,'Tanggal perolehan tidak valid.');
 if(out.acquired_date){const y=Number(out.acquired_date.slice(0,4));if(out.acquired_year!==null&&out.acquired_year!==y)fail(400,'Tahun harus sesuai tanggal perolehan.');out.acquired_year=y;}
 if(!conditions.includes(out.condition))fail(400,'Kondisi tidak valid.');
 out.purchase_price=input.purchase_price===''||input.purchase_price==null?null:Number(input.purchase_price);
 if(out.purchase_price!==null&&(!Number.isFinite(out.purchase_price)||out.purchase_price<0||out.purchase_price>1e14))fail(400,'Harga perolehan tidak valid.');return out;
}
export function publicAsset(asset,manage){
 const {purchase_price,created_by,updated_by,source_key,...rest}=asset;
 return {...rest,code:assetCode(asset.id),...(manage?{purchase_price}:{})};
}
async function history(env,id,u,action){await q(env,'INSERT INTO inventory_history VALUES(?,?,?,?,?)',crypto.randomUUID(),id,u.id,action,now()).run();}
async function detail(env,asset,manage){const photos=(await q(env,"SELECT id,created_at,kind FROM inventory_photos WHERE asset_id=? AND (kind='photo' OR ?=1) ORDER BY created_at,id",asset.id,Number(manage)).all()).results;const events=(await q(env,'SELECT h.action,h.created_at,u.name AS actor FROM inventory_history h LEFT JOIN users u ON u.id=h.actor WHERE asset_id=? ORDER BY h.created_at DESC,h.id DESC LIMIT 50',asset.id).all()).results;return {...publicAsset(asset,manage),photos:photos.map(p=>({...p,url:`/api/assets/${asset.id}/photos/${p.id}`})),history:events};}
async function insert(env,data,u,sourceKey=null,sourceNote=''){
 const time=now();return q(env,`INSERT OR IGNORE INTO inventory_assets (${fields.join(',')},source_key,source_note,created_by,updated_by,created_at,updated_at) VALUES (${Array(fields.length+6).fill('?').join(',')})`,...fields.map(k=>data[k]),sourceKey,sourceNote,u.id,u.id,time,time);
}
export async function assetApi(req,env,url,u,{payload,readLimited}){
 const manage=assetManager(u),path=url.pathname,method=req.method;
 if(path==='/api/assets'&&method==='GET'){
  const assets=(await q(env,'SELECT a.*, (SELECT id FROM inventory_photos p WHERE p.asset_id=a.id AND kind=\'photo\' ORDER BY created_at,id LIMIT 1) AS photo_id FROM inventory_assets a WHERE archived=? ORDER BY a.id DESC',url.searchParams.get('archive')==='1'?1:0).all()).results;
  return json({manage,assets:assets.map(a=>publicAsset(a,manage))});
 }
 if(path==='/api/assets/import'&&method==='POST'){
  if(!manage)fail(403,'Hanya Mulyadi dan Raja Alpian dapat mengimpor aset.');
  const input=await payload(req);if(!Array.isArray(input.assets)||!input.assets.length||input.assets.length>100)fail(400,'Impor harus berisi 1–100 unit aset.');
  const rows=input.assets.map(row=>{if(!/^[a-z0-9-]{1,100}$/.test(row.source_key||''))fail(400,'Kode sumber impor tidak valid.');return {data:assetInput(row),key:row.source_key,source_note:String(row.source_note||'Daftar Aset Yayasan Gambut.xlsx · per 31 Desember 2024').slice(0,800)};});
  if(new Set(rows.map(r=>r.key)).size!==rows.length)fail(400,'Kode sumber ganda.');
  const statements=[];for(const r of rows)statements.push(await insert(env,r.data,u,r.key,r.source_note));
  // Stable source keys make a repeated import safe without overwriting edited records.
  const results=await env.DB.batch(statements.map(s=>s));return json({imported:results.reduce((n,r)=>n+(r.meta.changes||0),0)},201);
 }
 if(path==='/api/assets'&&method==='POST'){
  if(!manage)fail(403,'Hanya Mulyadi dan Raja Alpian dapat menambah aset.');
  const data=assetInput(await payload(req)),result=await (await insert(env,data,u)).run();const id=result.meta.last_row_id;await history(env,id,u,'Aset ditambahkan');return json(await detail(env,await q(env,'SELECT * FROM inventory_assets WHERE id=?',id).first(),manage),201);
 }
 const match=/^\/api\/assets\/([1-9]\d*)(?:\/(photos)(?:\/([a-f0-9-]{36}))?)?$/.exec(path);if(!match)fail(404,'Layanan aset tidak ditemukan.');
 const [,id,action,photoId]=match,asset=await q(env,'SELECT * FROM inventory_assets WHERE id=?',Number(id)).first();if(!asset)fail(404,'Aset tidak ditemukan.');
 if(action==='photos'&&photoId&&method==='GET'){
  const photo=await q(env,'SELECT * FROM inventory_photos WHERE id=? AND asset_id=?',photoId,Number(id)).first();if(!photo)fail(404,'Foto tidak ditemukan.');if(photo.kind==='receipt'&&!manage)fail(403,'Bukti pembelian hanya untuk pengelola inventaris.');const obj=await env.MEDIA.get(photo.object_key);if(!obj)fail(404,'Foto tidak ditemukan.');return new Response(obj.body,{headers:{'Content-Type':photo.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(!action&&method==='GET')return json(await detail(env,asset,manage));
 if(!manage)fail(403,'Hanya Mulyadi dan Raja Alpian dapat mengubah aset.');
 if(!action&&method==='PUT'){
  const input=await payload(req);if(!Number.isInteger(input.version)||input.version!==asset.version)fail(409,'Aset sudah diperbarui. Muat ulang sebelum menyimpan.');
  const data=assetInput(input);if('archived' in input&&typeof input.archived!=='boolean')fail(400,'Status arsip tidak valid.');const archived='archived' in input?Number(input.archived):asset.archived;
  const result=await q(env,`UPDATE inventory_assets SET ${fields.map(k=>k+'=?').join(',')},archived=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND version=?`,...fields.map(k=>data[k]),archived,u.id,now(),Number(id),input.version).run();if(!result.meta.changes)fail(409,'Aset sudah diperbarui. Muat ulang sebelum menyimpan.');
  await history(env,id,u,archived!==asset.archived?(archived?'Aset diarsipkan':'Aset dipulihkan'):'Data aset diperbarui');return json(await detail(env,await q(env,'SELECT * FROM inventory_assets WHERE id=?',Number(id)).first(),manage));
 }
 if(action==='photos'&&photoId&&method==='DELETE'){
  if(asset.archived)fail(409,'Pulihkan aset sebelum menghapus foto.');
  const photo=await q(env,'SELECT * FROM inventory_photos WHERE id=? AND asset_id=?',photoId,Number(id)).first();if(!photo)fail(404,'Foto tidak ditemukan.');
  await env.MEDIA.delete(photo.object_key);
  await env.DB.batch([
   q(env,'DELETE FROM inventory_photos WHERE id=? AND asset_id=?',photoId,Number(id)),
   q(env,'INSERT INTO inventory_history VALUES(?,?,?,?,?)',crypto.randomUUID(),Number(id),u.id,photo.kind==='receipt'?'Bukti pembelian dihapus':'Foto aset dihapus',now())
  ]);
  return json(await detail(env,asset,manage));
 }
 if(action==='photos'&&!photoId&&method==='POST'){
  if(asset.archived)fail(409,'Pulihkan aset sebelum mengunggah foto.');
  const kind=url.searchParams.get('kind')||'photo';if(!['photo','receipt'].includes(kind))fail(400,'Jenis lampiran tidak valid.');
  const count=await q(env,'SELECT COUNT(*) AS n FROM inventory_photos WHERE asset_id=?',Number(id)).first();if(count.n>=12)fail(400,'Maksimal 12 foto per aset.');
  const bytes=await readLimited(req,2*1024*1024),type=imageType(bytes);if(!type)fail(400,'Pilih foto JPEG, PNG, atau WebP.');
  const pid=crypto.randomUUID(),key=`inventory/${id}/${pid}`;await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type}});
  try{await q(env,'INSERT INTO inventory_photos VALUES(?,?,?,?,?,?,?,?)',pid,Number(id),key,type,bytes.length,u.id,now(),kind).run();}catch(e){await env.MEDIA.delete(key);throw e;}
  await history(env,id,u,kind==='receipt'?'Bukti pembelian ditambahkan':'Foto aset ditambahkan');return json(await detail(env,asset,manage),201);
 }
 fail(405,'Metode tidak tersedia.');
}
