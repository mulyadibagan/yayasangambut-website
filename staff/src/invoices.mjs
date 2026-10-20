import {archiveInvoiceDrive,invoiceDriveStatus,invoiceDriveEnabled} from './invoice-drive.mjs';
import {previewDocumentSignature,signatureDataUrl} from './document-signature.mjs';
import {draftInvoicePdf,saveInvoiceArchive,readInvoiceArchive,invoicePrintRendition,invoiceArchiveOptions,invoicePrintChoices} from './invoice-archive.mjs';
import {invoiceBankDefaults,invoiceBankRoute} from './invoice-bank.mjs';
import {fail,now,sha,imageType} from './core.mjs';
import {financeDashboardAccess,financeOwner} from './finance-access.mjs';
import {invoiceInput,invoiceNumber,invoiceChecks,invoiceSeed} from './invoice-model.mjs';
import {invoicePage} from './invoice-page.mjs';
import {invoicePrint} from './invoice-print.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a),uuid=()=>crypto.randomUUID(),root='/finance/invoices';
export function invoiceAttachmentType(bytes,name){
 const image=imageType(bytes);if(image)return image;
 if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')return 'application/pdf';
 if(/\.doc$/i.test(name)&&[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((v,i)=>bytes[i]===v))return 'application/msword';
 if(/\.docx$/i.test(name)&&bytes[0]===0x50&&bytes[1]===0x4b&&bytes[2]===3&&bytes[3]===4){const zipNames=new TextDecoder('latin1').decode(bytes);if(zipNames.includes('[Content_Types].xml')&&zipNames.includes('word/document.xml'))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
 return null;
}
const decode=r=>({...r,data:JSON.parse(r.data)});
async function read(e,id){const r=await q(e,'SELECT * FROM yg_invoices WHERE id=?',id).first();if(!r)fail(404,'Invoice tidak ditemukan.');return decode(r);}
async function detail(e,id){const r=await read(e,id),files=(await q(e,'SELECT * FROM yg_invoice_files WHERE invoice_id=? ORDER BY created_at,id',id).all()).results,events=(await q(e,'SELECT actor,action,version,created_at FROM yg_invoice_events WHERE invoice_id=? ORDER BY version,created_at',id).all()).results;return {...r,pdf_key:undefined,creation_hash:undefined,files,events,issues:invoiceChecks(r,files),drive:await invoiceDriveStatus(e,id)};}
const version=(r,b)=>{if(!Number.isInteger(b.version)||r.version!==b.version)fail(409,'Invoice telah berubah. Muat ulang sebelum melanjutkan.');};
const editable=r=>{if(r.status!=='draft')fail(409,'Hanya draf yang dapat disunting. Nomor tetap tersimpan dan tidak dapat digunakan ulang.');};
function event(e,id,key,u,action,snapshot){return q(e,'INSERT INTO yg_invoice_events SELECT ?,id,?,?,version,?,updated_at FROM yg_invoices WHERE id=? AND last_event=?',key,u.email,action,JSON.stringify(snapshot),id,key);}
async function batch(e,statements){try{const result=await e.DB.batch(statements);if(!result[0].meta.changes)fail(409,'Invoice telah berubah. Muat ulang sebelum melanjutkan.');}catch(err){if(/invoice_sequence|UNIQUE constraint/.test(err.message))fail(409,'Nomor invoice sudah dipakai atau bukan nomor urutan berikutnya. Muat ulang daftar.');throw err;}}

export async function invoiceRoute(req,e,u,{payload,readLimited}){
 if(!financeDashboardAccess(u))fail(403,'Invoice hanya untuk Finance yang ditunjuk dan Direktur.');
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(method!=='GET'&&req.headers.get('Origin')!==e.APP_ORIGIN)fail(403,'Permintaan harus berasal dari website YG.');
 if(path===root+'/bank-settings'||path===root+'/bank-settings/api')return invoiceBankRoute(req,e,u,payload);
 if(path===root&&method==='GET')return new Response(invoicePage(),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 const api=root+'/api';
 if(path===api&&method==='GET')return Response.json({director:financeOwner(u),seed:{...invoiceSeed,...await invoiceBankDefaults(e)},sequences:(await q(e,'SELECT * FROM yg_invoice_sequences ORDER BY year').all()).results,invoices:(await q(e,'SELECT id,number,status,amount,total,version,created_at,updated_at,data FROM yg_invoices ORDER BY year DESC,seq DESC LIMIT 500').all()).results.map(r=>{const d=JSON.parse(r.data);return {...r,data:undefined,customer:d.customer,date:d.date,currency:d.currency||'IDR'};})});
 if(path===api&&method==='POST'){
  const b=await payload(req),v=invoiceInput(b),n=invoiceNumber(b.number,v.year);if(n.code!==v.data.customer_code)fail(400,'Kode pelanggan tidak sesuai nomor invoice.');
  if(!/^[a-f0-9-]{36}$/.test(b.request_id||''))fail(400,'Identitas penyimpanan tidak valid.');const hash=await sha(JSON.stringify({number:n.number,...v})),old=await q(e,'SELECT id,creator,creation_hash FROM yg_invoices WHERE id=?',b.request_id).first();
  if(old){if(old.creator!==u.email||old.creation_hash!==hash)fail(409,'Identitas draf telah digunakan.');return Response.json(await detail(e,old.id));}
  const id=b.request_id,key=uuid(),at=now();await batch(e,[q(e,"INSERT INTO yg_invoices(id,year,seq,number,data,amount,total,creation_hash,creator,created_at,updated_at,last_event) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",id,v.year,n.seq,n.number,JSON.stringify(v.data),v.amount,v.total,hash,u.email,at,at,key),event(e,id,key,u,'created',{number:n.number,...v})]);return Response.json(await detail(e,id),{status:201});
 }
 const m=path.match(/^\/finance\/invoices\/(api|pdf|print)\/([a-f0-9-]{36})(?:\/(files|issue|cancel|drive)(?:\/([a-f0-9-]{36}))?)?$/);if(!m)fail(404,'Halaman invoice tidak ditemukan.');
 const [,area,id,action,fileId]=m,r=await read(e,id);
 const signatureMode=url.searchParams.get('signature')||(r.status==='draft'&&financeOwner(u)?'with':'original');if(!['original','with','without'].includes(signatureMode))fail(400,'Pilihan tanda tangan tidak valid.');
 if(area==='print'&&method==='GET'&&!action){
  if(r.status==='cancelled')fail(409,'Invoice dibatalkan; dokumen tidak berlaku.');
  if(r.status==='issued'){
   if(url.searchParams.get('choose')==='1')return new Response(invoicePrintChoices(r,await invoiceArchiveOptions(e,r)),{headers:{'Content-Type':'text/html; charset=utf-8'}});
   return new Response(null,{status:302,headers:{Location:root+'/pdf/'+id+(signatureMode==='original'?'':'?signature='+signatureMode)}});
  }
  const signature=signatureMode==='with'?await previewDocumentSignature(e,u):null,preview={...r,invoice_preview:true,signature_preview:!!signature,allow_signature_preview:financeOwner(u)};
  return new Response(invoicePrint(preview,signatureDataUrl(signature)),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 }
 if(area==='pdf'&&method==='GET'&&!action){
  if(r.status==='cancelled')fail(409,'Invoice dibatalkan; PDF final tidak berlaku.');
  const signature=r.status==='draft'&&signatureMode==='with'?await previewDocumentSignature(e,u):null;
  const bytes=r.status==='issued'?await (url.searchParams.get('layout')==='compact'?invoicePrintRendition(e,r,signatureMode):readInvoiceArchive(e,r,signatureMode)):await draftInvoicePdf(e,{...r,invoice_preview:true,signature_preview:!!signature},signature);
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Invoice-'+r.number.replaceAll('/','-')+(r.status==='draft'?'-DRAFT':signatureMode==='without'?'-TANPA-TTD':signatureMode==='with'?'-TTD':'')+'.pdf"','Cache-Control':'no-store'}});
 }

 if(area!=='api')fail(405,'Metode tidak didukung.');
 if(!action&&method==='GET')return Response.json(await detail(e,id));
 if(!action&&method==='PUT'){editable(r);const b=await payload(req);version(r,b);const v=invoiceInput(b);if(v.year!==r.year||v.data.customer_code!==r.data.customer_code||b.number&&invoiceNumber(b.number,v.year).number!==r.number)fail(409,'Nomor, tahun, dan kode pelanggan tidak dapat diganti setelah dialokasikan.');const key=uuid();await batch(e,[q(e,"UPDATE yg_invoices SET data=?,amount=?,total=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status='draft'",JSON.stringify(v.data),v.amount,v.total,key,now(),id,r.version),event(e,id,key,u,'updated',v)]);return Response.json(await detail(e,id));}
 if(action==='drive'&&method==='POST'&&!fileId){await archiveInvoiceDrive(e,r);return Response.json(await detail(e,id));}
 if(action==='files'&&method==='GET'&&fileId){const f=await q(e,'SELECT * FROM yg_invoice_files WHERE invoice_id=? AND id=?',id,fileId).first();if(!f)fail(404,'Lampiran tidak ditemukan.');const obj=await e.MEDIA.get('invoice-private/files/'+f.id);if(!obj)fail(404,'Berkas belum dapat dibaca.');return new Response(obj.body,{headers:{'Content-Type':f.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(f.filename),'Cache-Control':'no-store'}});}
 if(action==='files'&&method==='POST'&&!fileId){editable(r);if(!e.MEDIA)fail(503,'Arsip berkas belum tersedia.');const v=Number(req.headers.get('X-Version'));version(r,{version:v});const purpose=req.headers.get('X-Purpose');if(!['contract','tax','other'].includes(purpose))fail(400,'Pilih jenis lampiran.');const count=await q(e,'SELECT COUNT(*) n FROM yg_invoice_files WHERE invoice_id=?',id).first();if(count.n>=20)fail(400,'Maksimal 20 lampiran per invoice.');const bytes=await readLimited(req,5*1024*1024);if(!bytes.length)fail(400,'Pilih berkas.');let name;try{name=decodeURIComponent(req.headers.get('X-Filename')||'Lampiran').replace(/[\r\n"\\/]/g,'_').slice(0,180);}catch{fail(400,'Nama berkas tidak valid.');}const mime=invoiceAttachmentType(bytes,name);if(!mime)fail(400,'Lampiran harus PDF, Word (.doc/.docx), JPEG, PNG atau WebP yang valid.');const fid=uuid(),key=uuid(),at=now();await e.MEDIA.put('invoice-private/files/'+fid,bytes,{httpMetadata:{contentType:mime}});try{await batch(e,[q(e,"UPDATE yg_invoices SET version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status='draft'",key,at,id,v),q(e,'INSERT INTO yg_invoice_files SELECT ?,id,?,?,?,?,?,? FROM yg_invoices WHERE id=? AND last_event=?',fid,purpose,name,mime,bytes.length,u.email,at,id,key),event(e,id,key,u,'attached',{filename:name,purpose})]);}catch(err){await e.MEDIA.delete('invoice-private/files/'+fid);throw err;}return Response.json(await detail(e,id));}
 if(['issue','cancel'].includes(action)&&method==='POST'&&!fileId){const b=await payload(req);version(r,b);editable(r);const key=uuid(),at=now();
  if(action==='cancel'){const reason=String(b.reason||'').trim();if(!reason||reason.length>1000)fail(400,'Isi alasan pembatalan.');await batch(e,[q(e,"UPDATE yg_invoices SET status='cancelled',version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status='draft'",key,at,id,r.version),event(e,id,key,u,'cancelled',{...r,reason})]);}
  else{if(!financeOwner(u))fail(403,'Penerbitan final dilakukan Direktur.');const view=await detail(e,id);if(view.issues.length)fail(400,view.issues.join(' '));if(b.reviewed_version!==r.version)fail(409,'Tinjau PDF dan versi invoice yang sama sebelum final.');const mode=b.signature_mode??'with';if(!['with','without'].includes(mode))fail(400,'Pilih dengan atau tanpa tanda tangan.');if(b.signature_mode&&b.reviewed_signature_mode!==mode)fail(409,'Periksa pratinjau dengan pilihan tanda tangan yang sama sebelum final.');const finalData={...r.data,...(b.signature_mode?{signature_mode:mode}:{})};const object='invoice-private/final/'+id+'/'+key+'.pdf',{hash}=await saveInvoiceArchive(e,{...r,data:finalData,status:'issued',issued_at:at,issued_by:u.email},object);await batch(e,[q(e,"UPDATE yg_invoices SET data=?,status='issued',issued_at=?,issued_by=?,pdf_key=?,pdf_hash=?,version=version+1,last_event=?,updated_at=? WHERE id=? AND version=? AND status='draft'",JSON.stringify(finalData),at,u.email,object,hash,key,at,id,r.version),event(e,id,key,u,'issued',{...r,data:finalData,pdf_hash:hash,checks:[]})]);}
  if(action==='issue'&&invoiceDriveEnabled(e)){try{await archiveInvoiceDrive(e,await read(e,id));}catch{}}
  return Response.json(await detail(e,id));
 }
 fail(405,'Metode tidak didukung.');
}
