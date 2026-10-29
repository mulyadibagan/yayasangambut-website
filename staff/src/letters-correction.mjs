import {fail,now} from './core.mjs';
import {layoutFor} from './letters-statement.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export async function correctLetterNumber(e,u,r,b,documents){
 const target=b.sequence;
 if(r.status!=='issued'||!r.number||!Number.isSafeInteger(target)||target<1||target>=r.sequence||b.confirmCorrection!==true||typeof b.reason!=='string'||b.reason.trim().length<15||b.reason.length>1000)fail(400,'Periksa nomor tujuan dan alasan koreksi.');
 const policy=await q(e,'SELECT * FROM surat_numbering_policy WHERE id=1').first();
 if(policy&&((r.number_year===policy.first_year&&target<=policy.first_number)||r.id===policy.first_letter_id))fail(409,'Nomor awal penomoran tidak dapat dikoreksi melalui tindakan ini.');
 const raw=(await q(e,'SELECT * FROM surat_annual WHERE number_year=? AND (sequence>=? OR reserved_sequence>=?) ORDER BY sequence',r.number_year,target,target).all()).results;
 if(raw.some(x=>x.id!==r.id&&(x.status!=='cancelled'||x.sequence>r.sequence||x.reserved_sequence>r.sequence))||!raw.some(x=>x.id===r.id&&x.version===r.version))fail(409,'Koreksi hanya untuk surat terbit terakhir dan nomor sebelumnya yang sudah dibatalkan. Muat ulang register.');
 if(await q(e,'SELECT sequence FROM surat_annual_register WHERE number_year=? AND sequence>=?',r.number_year,target).first())fail(409,'Nomor berbenturan dengan register historis.');
 const batchId=crypto.randomUUID(),t=now(),base='surat/'+r.id+'/number-correction-'+batchId;
 const number=target+r.number.slice(String(r.sequence).length),docs=await documents(e,{...r,sequence:target,number});
 // Store both corrected files before changing the register. Old objects are never overwritten.
 for(const ext of ['docx','pdf'])await e.MEDIA.put(base+'.'+ext,docs[ext],{httpMetadata:{contentType:ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},onlyIf:{etagDoesNotMatch:'*'}});
 for(const ext of ['docx','pdf'])if(!await e.MEDIA.get(base+'.'+ext))fail(503,'Arsip koreksi belum lengkap. Register belum berubah.');
 const statements=[],corrections=[];
 for(const old of raw.filter(x=>x.id!==r.id).concat(raw.filter(x=>x.id===r.id))){
  const isTarget=old.id===r.id;
  const snapshot={row:old,renditions:(await q(e,'SELECT * FROM surat_renditions WHERE surat_id=?',old.id).all()).results,drive:(await q(e,'SELECT * FROM surat_annual_drive WHERE surat_id=?',old.id).all()).results,renditionDrive:(await q(e,'SELECT * FROM surat_rendition_drive WHERE surat_id=?',old.id).all()).results};
  const correctionId=crypto.randomUUID(),seq=isTarget?target:null,num=isTarget?number:null,docx=isTarget?base+'.docx':old.docx_key,pdf=isTarget?base+'.pdf':old.pdf_key;
  corrections.push(correctionId);
  statements.push(q(e,'INSERT INTO surat_number_corrections(id,batch_id,surat_id,old_version,old_number,snapshot,new_sequence,new_number,new_docx_key,new_pdf_key,reason,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',correctionId,batchId,old.id,old.version,old.number,JSON.stringify(snapshot),seq,num,docx,pdf,b.reason.trim(),u.id,t));
  statements.push(q(e,'UPDATE surat_annual SET sequence=?,number=?,reserved_sequence=NULL,docx_key=?,pdf_key=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status=? AND number IS ?',seq,num,docx,pdf,t,old.id,old.version,old.status,old.number));
  statements.push(q(e,'INSERT INTO surat_annual_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),old.id,u.id,'number_correction:'+String(old.number)+'->'+(num||'released_cancelled')+':'+batchId,old.version+1,t));
 }
 // Active Drive links and rendition metadata refer to the old number; their full snapshots remain above.
 statements.push(q(e,'DELETE FROM surat_rendition_drive WHERE surat_id=?',r.id));
 statements.push(q(e,'DELETE FROM surat_annual_drive WHERE surat_id=?',r.id));
 statements.push(q(e,'DELETE FROM surat_renditions WHERE surat_id=?',r.id));
 statements.push(q(e,'INSERT INTO surat_renditions VALUES(?,?,?,?,?,?)',r.id,layoutFor(r),base+'.docx',base+'.pdf',u.id,t));
 // Each completion validates the expected row version and resulting fields inside the same transaction.
 for(const id of corrections)statements.push(q(e,'UPDATE surat_number_corrections SET completed=1 WHERE id=?',id));
 await e.DB.batch(statements);
 return {id:r.id,number};
}
