import {createHash} from 'node:crypto';
import {driveAccess,google,validFolder,drivePreviewUrl} from './agenda-drive.mjs';
import {fail,now} from './core.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
// Uses the existing director-authorized work Drive grant. No new OAuth scopes or public sharing.
export async function letterDrive(e,r,u){
 if(r.status!=='issued')fail(409,'Hanya surat terbit dapat diarsipkan ke Drive.');
 const root=e.SURAT_DRIVE_ROOT_ID||e.INVOICE_DRIVE_ROOT_ID;if(!root)fail(503,'Folder arsip Drive belum dikonfigurasi. Arsip R2 tetap tersedia.');
 const {access,root:connected}=await driveAccess(e);if(connected!==root)fail(409,'Folder Drive berbeda dari koneksi yang disetujui Direktur.');await validFolder(access,root);
 const results=[];
 for(const format of ['docx','pdf']){
  let row=await q(e,'SELECT * FROM surat_drive WHERE surat_id=? AND format=?',r.id,format).first();
  if(!row){const ids=await google(access,'/drive/v3/files/generateIds?count=1&space=drive&type=files');if(!ids.ids?.[0])fail(502,'ID arsip Drive belum tersedia.');await q(e,'INSERT OR IGNORE INTO surat_drive(surat_id,format,file_id) VALUES(?,?,?)',r.id,format,ids.ids[0]).run();row=await q(e,'SELECT * FROM surat_drive WHERE surat_id=? AND format=?',r.id,format).first();}
  const object=await e.MEDIA.get(r[format+'_key']);if(!object)fail(503,'Arsip sumber tidak ditemukan.');const bytes=new Uint8Array(await object.arrayBuffer()),md5=createHash('md5').update(bytes).digest('hex'),type=format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const metaPath='/drive/v3/files/'+encodeURIComponent(row.file_id)+'?supportsAllDrives=true&fields=id,mimeType,parents,trashed,size,md5Checksum,webViewLink,appProperties';
  const response=await fetch('https://www.googleapis.com'+metaPath,{headers:{Authorization:'Bearer '+access}});let file;
  if(response.status===404){const boundary='yg-surat-'+crypto.randomUUID(),metadata={id:row.file_id,name:'Surat-'+r.number.replaceAll('/','-')+'.'+format,mimeType:type,parents:[root],appProperties:{ygSuratId:r.id,ygSuratFormat:format}};
   const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,bytes,`\r\n--${boundary}--\r\n`]);
   try{await google(access,'/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});}catch{fail(502,'Unggahan Drive belum terkonfirmasi. Coba kembali; ID arsip dipertahankan.');}file=await google(access,metaPath);
  }else{if(!response.ok)fail(502,'Arsip Drive belum dapat diperiksa.');file=await response.json();}
  if(file.trashed||file.mimeType!==type||file.md5Checksum!==md5||Number(file.size)!==bytes.length||!file.parents?.includes(root)||file.appProperties?.ygSuratId!==r.id||file.appProperties?.ygSuratFormat!==format)fail(409,'Arsip Drive berbeda. Berkas yang ada tidak ditimpa.');
  const url=drivePreviewUrl(file.webViewLink);await q(e,'UPDATE surat_drive SET web_url=?,archived_at=COALESCE(archived_at,?) WHERE surat_id=? AND format=?',url,now(),r.id,format).run();results.push({format,url});
 }
 await q(e,'INSERT INTO surat_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),r.id,u.id,'archive_drive',r.version,now()).run();return {id:r.id,files:results};
}
