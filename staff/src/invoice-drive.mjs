import {createHash} from 'node:crypto';
import {fail,now} from './core.mjs';
import {driveAccess,google,validFolder,drivePreviewUrl} from './agenda-drive.mjs';
import {invoicePrintRendition,invoiceArchiveOptions} from './invoice-archive.mjs';
import {pdfHash} from './payroll-pdf.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a),folderMime='application/vnd.google-apps.folder';
export const invoiceDriveEnabled=e=>!!e.INVOICE_DRIVE_ROOT_ID;
export async function invoiceDriveStatus(e,id){
 if(!invoiceDriveEnabled(e))return {enabled:false};
 const r=await q(e,'SELECT status,web_url,archived_at,error FROM yg_invoice_drive WHERE invoice_id=?',id).first();
 return {enabled:true,status:r?.status||'pending',url:r?.web_url||null,archived_at:r?.archived_at||null,error:r?.error||null};
}
async function fileMeta(access,id){
 const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields=id,name,mimeType,parents,trashed,size,md5Checksum,webViewLink,appProperties',{headers:{Authorization:'Bearer '+access}});
 if(response.status===404)return null;
 if(!response.ok)fail(502,'Arsip Drive belum dapat diperiksa. Coba kembali.');return response.json();
}
async function childFolder(access,parent,name){
 const quote=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 const query="'"+quote(parent)+"' in parents and trashed = false and mimeType = '"+folderMime+"' and name = '"+quote(name)+"'";
 const result=await google(access,'/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=2&fields=files(id)&q='+encodeURIComponent(query));
 if(result.files?.length>1)fail(409,'Ada folder arsip bernama sama. Periksa struktur folder sebelum mencoba kembali.');
 let id=result.files?.[0]?.id;
 if(!id){const created=await google(access,'/drive/v3/files?supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:folderMime,parents:[parent],appProperties:{ygFinanceArchive:'invoice-v1'}})});id=created.id;}
 await validFolder(access,id,parent);return id;
}
function verifiedFile(file,r,row,md5){
 if(file.trashed||file.mimeType!=='application/pdf'||!file.parents?.includes(row.folder_id)||Number(file.size)!==row.size||file.md5Checksum!==md5||file.appProperties?.ygInvoiceId!==r.id||file.appProperties?.ygInvoiceSource!==r.pdf_hash||file.appProperties?.ygInvoicePdf!==row.pdf_hash)fail(409,'Salinan Drive berbeda atau sudah dipindah. Arsip asli tetap utuh; periksa berkas Drive sebelum mencoba kembali.');
 return drivePreviewUrl(file.webViewLink);
}
export async function archiveInvoiceDrive(e,r){
 if(!invoiceDriveEnabled(e))return {enabled:false};
 if(r.status!=='issued'||!r.pdf_hash||!r.pdf_key)fail(409,'Hanya invoice yang sudah disetujui dapat diarsipkan ke Drive.');
 const root=e.INVOICE_DRIVE_ROOT_ID;if(!/^[A-Za-z0-9_-]{10,120}$/.test(root))fail(503,'Folder arsip invoice belum dikonfigurasi.');
  await q(e,"INSERT INTO yg_invoice_drive(invoice_id,root_id,updated_at) VALUES(?,?,?) ON CONFLICT(invoice_id) DO NOTHING",r.id,root,now()).run();
 const owner=crypto.randomUUID(),lease=Date.now()+180000;
 const lock=await q(e,'UPDATE yg_invoice_drive_lock SET owner=?,lease_until=? WHERE id=1 AND lease_until<? RETURNING id',owner,lease,Date.now()).first();
 if(!lock)fail(409,'Pengarsipan Drive sedang berjalan. Coba kembali sebentar lagi.');
 try{
  let row=await q(e,'SELECT * FROM yg_invoice_drive WHERE invoice_id=?',r.id).first();
  if(row.root_id!==root||row.source_hash&&row.source_hash!==r.pdf_hash)fail(409,'Tujuan atau sumber arsip berubah. Arsip lama tetap dipertahankan.');
  if(!(await invoiceArchiveOptions(e,r)).withSignature)fail(409,'Invoice ini belum memiliki PDF bertanda tangan elektronik.');
  const bytes=await invoicePrintRendition(e,r,'with'),hash=await pdfHash(bytes),md5=createHash('md5').update(bytes).digest('hex');
  if(row.pdf_hash&&row.pdf_hash!==hash)fail(409,'PDF arsip berbeda. Salinan yang sudah ada tetap dipertahankan.');
  const {access,root:connectedRoot}=await driveAccess(e);if(connectedRoot!==root)fail(409,'Folder koneksi Drive tidak sesuai arsip invoice yang dipilih Direktur.');
  await validFolder(access,root);
  if(!row.folder_id){
   let folder=root;for(const name of ['YG Finance','Invoice',String(r.year||r.data.date.slice(0,4)),r.data.customer_code]){if(!/^[A-Za-z0-9 -]{1,40}$/.test(name))fail(400,'Nama folder invoice tidak valid.');folder=await childFolder(access,folder,name);}
   await q(e,'UPDATE yg_invoice_drive SET folder_id=?,source_hash=?,pdf_hash=?,size=?,updated_at=? WHERE invoice_id=?',folder,r.pdf_hash,hash,bytes.length,now(),r.id).run();
   row=await q(e,'SELECT * FROM yg_invoice_drive WHERE invoice_id=?',r.id).first();
  }
  let ancestor=row.folder_id;for(let depth=0;ancestor!==root&&depth<5;depth++){const folder=await fileMeta(access,ancestor);if(!folder||folder.trashed||folder.mimeType!==folderMime||folder.parents?.length!==1)fail(409,'Folder arsip Drive tidak valid.');ancestor=folder.parents[0];}if(ancestor!==root)fail(409,'Folder invoice berada di luar arsip Drive yang dipilih.');
  if(!row.file_id){
   const ids=await google(access,'/drive/v3/files/generateIds?count=1&space=drive&type=files');if(!ids.ids?.[0])fail(502,'Identitas arsip Drive belum tersedia.');
   await q(e,'UPDATE yg_invoice_drive SET file_id=?,updated_at=? WHERE invoice_id=?',ids.ids[0],now(),r.id).run();row=await q(e,'SELECT * FROM yg_invoice_drive WHERE invoice_id=?',r.id).first();
  }
  let file=await fileMeta(access,row.file_id);
  if(!file){
   const boundary='yg-invoice-'+crypto.randomUUID(),metadata={id:row.file_id,name:'Invoice-'+r.number.replaceAll('/','-')+'-TTD.pdf',mimeType:'application/pdf',parents:[row.folder_id],appProperties:{ygInvoiceId:r.id,ygInvoiceSource:r.pdf_hash,ygInvoicePdf:hash}};
   const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,bytes,`\r\n--${boundary}--\r\n`]);
   await google(access,'/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
   file=await fileMeta(access,row.file_id);if(!file)fail(502,'Salinan Drive belum dapat ditemukan setelah unggah.');
  }
  const url=verifiedFile(file,r,row,md5);
  await q(e,"UPDATE yg_invoice_drive SET status='archived',web_url=?,archived_at=COALESCE(archived_at,?),error=NULL,retry_at=0,updated_at=? WHERE invoice_id=?",url,now(),now(),r.id).run();
  return invoiceDriveStatus(e,r.id);
 }catch(err){
  await q(e,"UPDATE yg_invoice_drive SET status='error',error=?,retry_at=?,updated_at=? WHERE invoice_id=?",err.status?err.message:'Penyimpanan Drive belum berhasil. Arsip asli tetap tersedia.',Date.now()+300000,now(),r.id).run();throw err;
 }finally{await q(e,'UPDATE yg_invoice_drive_lock SET lease_until=0,owner=NULL WHERE id=1 AND owner=?',owner).run();}
}
export async function syncInvoiceDrive(e){
 if(!invoiceDriveEnabled(e))return;
 const rows=(await q(e,"SELECT i.* FROM yg_invoices i JOIN yg_invoice_drive d ON d.invoice_id=i.id WHERE i.status='issued' AND d.status IN ('pending','error') AND d.retry_at<=? ORDER BY d.updated_at LIMIT 3",Date.now()).all()).results;
 for(const r of rows)try{await archiveInvoiceDrive(e,{...r,data:JSON.parse(r.data)});}catch{} // Original approval is never rolled back by delivery failure.
}
