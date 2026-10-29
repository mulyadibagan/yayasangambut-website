import {cleanDocument,documentText} from '../public/letter-content.js';
import {letterTemplates} from './letter-templates.mjs';
import {fail,now} from './core.mjs';
import {letterDocuments,registerXlsx,SIGNATURE_KEY} from './letters-documents.mjs';
import {layoutFor,statementData,STATEMENT_LAYOUT} from './letters-statement.mjs';
import {letterDrive} from './letters-drive.mjs';
import {letterTypes,isLetterKind} from './letters-types.mjs';
import {correctLetterNumber} from './letters-correction.mjs';
import {activateNumbering,numberingState} from './letters-numbering.mjs';
const accounts=new Set(['mulyadi@yayasangambut.org','rienaprasiddha@yayasangambut.org','zamharier@yayasangambut.org','rajaalpian@yayasangambut.org','utara@yayasangambut.org']);
export const letterAccess=u=>!!u&&!u.disabled&&accounts.has(u.email);
export const letterDirector=u=>letterAccess(u)&&u.email==='mulyadi@yayasangambut.org'&&u.role==='admin';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
const json=x=>Response.json(x);
export const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
export function letterInput(v){
 const data={};let rich=null;if(v.bodyFormat!==undefined&&v.bodyFormat!=='rich-v1')fail(400,'Format isi tidak didukung.');if(v.bodyDoc!==undefined&&v.bodyFormat!=='rich-v1')fail(400,'Dokumen terstruktur harus memakai penanda format.');if(v.bodyFormat==='rich-v1'){try{rich=cleanDocument(v.bodyDoc);v={...v,body:documentText(rich)};}catch(error){fail(400,error.message);}}for(const [key,max] of Object.entries({date:10,kind:12,subject:240,recipient:200,institution:240,address:1000,body:18000,attachments:1000,signer:100,notes:2000})){
  if(typeof v[key]!=='string'||v[key].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v[key]))fail(400,'Isian surat tidak valid: '+key);data[key]=v[key].trim();
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||!Number.isFinite(Date.parse(data.date))||new Date(data.date).toISOString().slice(0,10)!==data.date||!isLetterKind(data.kind)||!data.subject||!data.body||data.signer!=='Mulyadi, Direktur Yayasan Gambut')fail(400,'Periksa tanggal, jenis, perihal, isi, dan penandatangan.');
 if(rich){data.bodyFormat='rich-v1';data.bodyDoc=rich;}if(data.kind==='PNY'){if(v.statementPlace!==undefined&&(typeof v.statementPlace!=='string'||v.statementPlace.length>120||/[\u0000-\u001f]/.test(v.statementPlace)))fail(400,'Tempat penandatanganan tidak valid.');data.statementPlace=v.statementPlace?.trim()||'Pekanbaru';}
 return data;
}
const decode=r=>({...r,data:JSON.parse(r.data)});
const history=(e,id,u,action,version)=>q(e,'INSERT INTO surat_annual_history VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,u.id,action,version,now());
async function row(e,id,u){const r=await q(e,'SELECT * FROM surat_annual WHERE id=?',id).first();if(!r)fail(404,'Surat tidak ditemukan.');if(r.owner!==u.id&&!letterDirector(u))fail(403,'Surat bukan milik Anda.');return (await withArchives(e,[decode(r)]))[0];}
async function withArchives(e,records){
 const layouts=(await q(e,'SELECT * FROM surat_renditions ORDER BY created_at DESC').all()).results;
 const original=(await q(e,'SELECT * FROM surat_annual_drive').all()).results;
 const formatted=(await q(e,'SELECT * FROM surat_rendition_drive').all()).results;
 return records.map(r=>{const layout=layouts.find(l=>l.surat_id===r.id&&l.layout===layoutFor(r))||layouts.find(l=>l.surat_id===r.id);return {...r,...(layout?{layout:layout.layout,docx_key:layout.docx_key,pdf_key:layout.pdf_key,...(layout.layout===STATEMENT_LAYOUT?{renditionData:statementData(r.data)}:{})}:{}),formatAvailable:r.status==='issued'&&layout?.layout!==layoutFor(r),archives:(layout?formatted:original).filter(f=>f.surat_id===r.id&&f.web_url&&(!layout||f.layout===layout.layout)),previousArchives:layout?[...original,...formatted.filter(f=>f.layout!==layout.layout)].filter(f=>f.surat_id===r.id&&f.web_url):[]};});
}
async function change(e,r,u,action,sql,args){const result=await e.DB.batch([q(e,sql,...args),q(e,'INSERT INTO surat_annual_history SELECT ?,id,?,?,version,? FROM surat_annual WHERE id=? AND version=? AND changes()>0',crypto.randomUUID(),u.id,action,now(),r.id,r.version+1)]);if(!result[0].meta.changes)fail(409,'Surat telah berubah. Muat ulang.');return row(e,r.id,u);}
export async function lettersApi(...args){try{return await handleLetters(...args);}catch(e){if(/UNIQUE constraint failed/.test(String(e?.message)))fail(409,'Nomor atau reservasi sudah tercatat. Muat ulang register.');throw e;}}
async function handleLetters(req,e,url,u,{payload}){
 if(!letterAccess(u))fail(403,'Administrasi surat hanya untuk akun berwenang.');
 const p=url.pathname,m=req.method,director=letterDirector(u);
 if(p==='/api/surat/settings'&&m==='GET')return json({...(await q(e,'SELECT * FROM surat_settings WHERE id=1').first()),numbering:await numberingState(e,Number(new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'}).slice(0,4))),director,types:letterTypes,templates:letterTemplates.map(({id,name})=>({id,name})),references:(await q(e,'SELECT * FROM surat_references').all()).results});
 if(p==='/api/surat/numbering/start'&&m==='POST'){if(!director)fail(403,'Hanya Direktur dapat menetapkan titik awal.');return json(await activateNumbering(e,u,await payload(req)));}
 if(p.startsWith('/api/surat/templates/')&&m==='GET'){const template=letterTemplates.find(t=>p==='/api/surat/templates/'+t.id);if(!template)fail(404,'Template tidak ditemukan.');return json({...template,bodyDoc:cleanDocument(template.bodyDoc)});}
 if(p==='/api/surat/register'&&m==='GET'){
  const rows=(await q(e,'SELECT * FROM surat_annual '+(director?'':'WHERE owner=? ')+'ORDER BY created_at DESC',...(director?[]:[u.id])).all()).results.map(decode);
  const historical=director?(await q(e,'SELECT * FROM surat_annual_register ORDER BY sequence').all()).results.map(decode):[];
  if(url.searchParams.get('format')==='xlsx')return download(registerXlsx([...(await withArchives(e,rows)),...historical]),'register-surat.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return json({rows:await withArchives(e,rows),historical});
 }
 if(p==='/api/surat/import'&&m==='POST'){
  if(!director)fail(403,'Hanya Direktur dapat memverifikasi register.');const b=await payload(req);
  if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>1000||typeof b.evidence!=='string'||b.evidence.trim().length<15)fail(400,'Lampirkan register dan sumber verifikasi.');
  const statements=[];for(const r of b.rows){if(!Number.isSafeInteger(r.sequence)||r.sequence<1||!new RegExp('^'+r.sequence+'/YG/[A-Z]{2,12}/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/[0-9]{4}$').test(r.number)||!r.subject||!r.date||!r.status||!['issued','cancelled'].includes(r.status))fail(400,'Register historis tidak valid.');
   const year=Number(r.number.slice(-4));if(await q(e,'SELECT id FROM surat_annual WHERE number_year=? AND (sequence=? OR number=?)',year,r.sequence,r.number).first())fail(409,'Nomor sudah terdapat pada modul surat.');
   statements.push(q(e,'INSERT INTO surat_annual_register VALUES(?,?,?,?,?,?,?)',year,r.sequence,r.number,JSON.stringify(r),b.evidence.trim().slice(0,2000),u.id,now()));
  }
  statements.push(q(e,'UPDATE surat_settings SET verified=0,evidence=?,verified_by=?,verified_at=NULL WHERE id=1',b.evidence.trim().slice(0,2000),u.id));await e.DB.batch(statements);return json({ok:true});
 }
 if(p==='/api/surat/verify'&&m==='POST'){
  if(!director)fail(403,'Hanya Direktur.');const b=await payload(req),s=await q(e,'SELECT * FROM surat_settings WHERE id=1').first();
  const rows=(await q(e,'SELECT sequence FROM surat_annual_register WHERE number_year=2026 ORDER BY sequence').all()).results;
  if(b.complete!==true||!s.evidence||!rows.length||rows.some((r,i)=>r.sequence!==i+1)||rows.at(-1).sequence<64)fail(409,'Impor register lengkap sejak nomor 1, termasuk nomor batal. Verifikasi tidak dapat memakai dua referensi saja.');
  const r64=await q(e,'SELECT * FROM surat_annual_register WHERE number_year=2026 AND sequence=64').first();if(r64.number!=='64/YG/SPT/X/2026')fail(409,'Referensi nomor 64 tidak cocok.');
  const r65=await q(e,'SELECT * FROM surat_annual_register WHERE number_year=2026 AND sequence=65').first();if(r65&&r65.number!=='65/YG/SKR/X/2026')fail(409,'Referensi nomor 65 tidak cocok.');
  await q(e,'UPDATE surat_settings SET verified=1,verified_by=?,verified_at=? WHERE id=1',u.id,now()).run();return json({ok:true});
 }
 if(p==='/api/surat'&&m==='POST'){
  const data=letterInput(await payload(req)),id=crypto.randomUUID(),t=now();await e.DB.batch([q(e,'INSERT INTO surat_annual(id,owner,data,number_year,created_at,updated_at) VALUES(?,?,?,?,?,?)',id,u.id,JSON.stringify(data),Number(data.date.slice(0,4)),t,t),history(e,id,u,'create',1)]);return Response.json(await row(e,id,u),{status:201});
 }
 const match=p.match(/^\/api\/surat\/([a-f0-9-]+)(?:\/(submit|approve|return|cancel|issue|history|docx|pdf|reserve-rapp|revise|drive|format|renumber))?$/);if(!match)fail(404,'Rute surat tidak ditemukan.');
 const [,id,a]=match,r=await row(e,id,u);
 if(m==='GET'&&!a)return json(r);
 if(m==='GET'&&a==='history')return json((await q(e,'SELECT * FROM surat_annual_history WHERE surat_id=? ORDER BY created_at,id',id).all()).results);
 if(m==='GET'&&['docx','pdf'].includes(a)){
  if(r.status==='issued'||(r.number&&r.status==='cancelled')){const object=await e.MEDIA.get(r[a+'_key']);if(!object)fail(503,'Arsip belum tersedia.');return download(object.body,'Surat_'+r.sequence+'.'+a,mime(a));}
  const docs=await documents(e,r);return download(docs[a],'DRAFT_'+id+'.'+a,mime(a));
 }
 if(!['POST','PUT'].includes(m))fail(405,'Metode tidak didukung.');const b=await payload(req);if(b.version!==r.version)fail(409,'Versi surat telah berubah.');
 if(a==='renumber'){if(!director)fail(403,'Hanya Direktur dapat mengoreksi penomoran.');const corrected=await correctLetterNumber(e,u,r,b,documents);return json(await row(e,corrected.id,u));}
 if(a==='format'){
  if(!director)fail(403,'Hanya Direktur dapat memperbarui format arsip.');
  if(r.status!=='issued')fail(409,'Hanya arsip surat terbit dapat diperbarui formatnya.');
  const targetLayout=layoutFor(r);if(r.layout===targetLayout)return json(r);
  const docs=await documents(e,r),base='surat/'+id+'/'+targetLayout;
  for(const ext of ['docx','pdf'])await e.MEDIA.put(base+'.'+ext,docs[ext],{httpMetadata:{contentType:mime(ext)},onlyIf:{etagDoesNotMatch:'*'}});
  for(const ext of ['docx','pdf'])if(!await e.MEDIA.get(base+'.'+ext))fail(503,'Arsip format baru belum lengkap. Coba kembali.');
  const result=await e.DB.batch([
   q(e,"INSERT OR IGNORE INTO surat_renditions SELECT id,?,?,?,?,? FROM surat_annual WHERE id=? AND version=? AND status='issued'",targetLayout,base+'.docx',base+'.pdf',u.id,now(),id,r.version),
   q(e,'INSERT INTO surat_annual_history SELECT ?,id,?,?,version,? FROM surat_annual WHERE id=? AND changes()>0',crypto.randomUUID(),u.id,'format_'+targetLayout,now(),id)
  ]);
  if(!result[0].meta.changes){const current=await row(e,id,u);if(current.layout!==targetLayout)fail(409,'Surat telah berubah. Muat ulang.');return json(current);}
  return json(await row(e,id,u));
 }
 if(a==='drive'){if(!director)fail(403,'Hanya Direktur dapat menyalin arsip ke Drive.');return json(await letterDrive(e,r,u));}
 if(m==='PUT'&&!a){if(r.status!=='draft'||r.number)fail(409,'Kembalikan ke draf sebelum menyunting.');if(r.data.bodyFormat==='rich-v1'&&b.bodyFormat!=='rich-v1')fail(409,'Surat memakai editor berformat. Muat ulang sebelum menyunting agar format tidak hilang.');const data=letterInput(b);return json(await change(e,r,u,'edit','UPDATE surat_annual SET data=?,number_year=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status=\'draft\' AND number IS NULL',[JSON.stringify(data),Number(data.date.slice(0,4)),now(),id,r.version]));}
 if(a==='revise'&&r.number){const newId=crypto.randomUUID();await e.DB.batch([q(e,'INSERT INTO surat_annual(id,owner,data,number_year,created_at,updated_at) VALUES(?,?,?,?,?,?)',newId,u.id,JSON.stringify({...r.data,notes:('Revisi atas '+r.number+'\n'+r.data.notes).slice(0,2000)}),r.number_year,now(),now()),history(e,newId,u,'revision_of:'+id,1)]);return json(await row(e,newId,u));}
 if(a==='reserve-rapp'){
  if(!director)fail(403,'Hanya Direktur.');if(r.number||r.data.kind!=='SKR'||r.data.date!=='2026-10-21'||r.data.institution!=='PT Riau Andalan Pulp and Paper'||r.status!=='approved'||b.referenceVerified!==true)fail(409,'Periksa dokumen RAPP asli dan persetujuannya sebelum reservasi.');
  if(await q(e,'SELECT sequence FROM surat_annual_register WHERE number_year=2026 AND sequence=65').first())fail(409,'Nomor 65 sudah diimpor; jangan terbitkan lagi.');
  const policy=await q(e,'SELECT first_letter_id FROM surat_numbering_policy WHERE id=1').first();if(policy&&policy.first_letter_id!==id)fail(409,'Nomor 65 diperuntukkan bagi draft RAPP pertama yang ditetapkan Direktur.');
  return json(await change(e,r,u,'reserve_approved_65','UPDATE surat_annual SET reserved_sequence=65,version=version+1,updated_at=? WHERE id=? AND version=? AND number IS NULL',[now(),id,r.version]));
 }
 if(a==='issue'){
  if(!director)fail(403,'Hanya Direktur dapat menerbitkan.');if(r.status==='issued')return json(r);if(r.status!=='approved')fail(409,'Surat belum disetujui.');
  const state=await numberingState(e,r.number_year),policy=state.policy;
  if(!state.enabled)fail(409,'Tetapkan titik awal penomoran atau verifikasi register terlebih dahulu.');
  if(policy&&r.number_year===policy.first_year&&id!==policy.first_letter_id&&!await q(e,"SELECT id FROM surat_annual WHERE id=? AND sequence=? AND status IN ('issued','cancelled')",policy.first_letter_id,policy.first_number).first())fail(409,'Terbitkan surat RAPP pertama nomor 65 terlebih dahulu.');
  if(!r.number){
   if(!policy&&!r.reserved_sequence&&!await q(e,"SELECT id FROM surat_annual WHERE number_year=2026 AND sequence=65 AND status IN ('issued','cancelled') UNION ALL SELECT number AS id FROM surat_annual_register WHERE number_year=2026 AND sequence=65").first())fail(409,'Nomor 65 belum diterbitkan atau diverifikasi dalam register.');
   const suffix='/YG/'+r.data.kind+'/'+roman[Number(r.data.date.slice(5,7))-1]+'/'+r.data.date.slice(0,4);
   // D1 batch is one serializable transaction. Allocation and UNIQUE checks occur inside SQL.
   const year=r.number_year,first=policy?(year===policy.first_year?policy.first_number:1):66;
   const next=`COALESCE(reserved_sequence,(SELECT MAX(n)+1 FROM (SELECT COALESCE(MAX(sequence),0) AS n FROM surat_annual WHERE number_year=${year} UNION ALL SELECT COALESCE(MAX(sequence),0) FROM surat_annual_register WHERE number_year=${year} UNION ALL SELECT ${first-1})))`;
   const ready="(EXISTS(SELECT 1 FROM surat_settings WHERE id=1 AND verified=1) OR EXISTS(SELECT 1 FROM surat_numbering_policy WHERE id=1 AND first_year<=surat_annual.number_year))";
   const firstLetter="NOT EXISTS(SELECT 1 FROM surat_numbering_policy p WHERE p.first_year=surat_annual.number_year AND p.first_letter_id!=surat_annual.id AND NOT EXISTS(SELECT 1 FROM surat_annual initial WHERE initial.id=p.first_letter_id AND initial.sequence=p.first_number AND initial.status IN ('issued','cancelled')))";
   await change(e,r,u,'allocate','UPDATE surat_annual SET sequence='+next+',number=('+next+")||?,docx_key=?,pdf_key=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status='approved' AND number IS NULL AND "+ready+' AND '+firstLetter+' AND NOT EXISTS(SELECT 1 FROM surat_annual_register h WHERE h.number_year=surat_annual.number_year AND h.sequence=surat_annual.reserved_sequence)',[suffix,'surat/'+id+'/final.docx','surat/'+id+'/final.pdf',now(),id,r.version]);
  }
  const allocated=await row(e,id,u),docs=await documents(e,{...allocated,status:'issued'});
  // Create-only objects: overlapping retries must never replace an archived rendition.
  await e.MEDIA.put(allocated.docx_key,docs.docx,{httpMetadata:{contentType:mime('docx')},onlyIf:{etagDoesNotMatch:'*'}});await e.MEDIA.put(allocated.pdf_key,docs.pdf,{httpMetadata:{contentType:mime('pdf')},onlyIf:{etagDoesNotMatch:'*'}});
  if(!await e.MEDIA.get(allocated.docx_key)||!await e.MEDIA.get(allocated.pdf_key))fail(503,'Arsip belum lengkap. Muat ulang lalu lanjutkan penerbitan.');
  const issued=await change(e,allocated,u,'issue',"UPDATE surat_annual SET status='issued',issued_at=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND status='approved'",[now(),now(),id,allocated.version]);
  await q(e,'INSERT OR IGNORE INTO surat_renditions VALUES(?,?,?,?,?,?)',id,layoutFor(issued),issued.docx_key,issued.pdf_key,u.id,now()).run();
  return json(await row(e,id,u));
 }
 const transitions={submit:['draft','review'],approve:['review','approved'],return:[r.status==='approved'?'approved':'review','draft'],cancel:[r.status,'cancelled']};const t=transitions[a];
 if(!t||r.status!==t[0]||r.status==='cancelled'||(r.number&&a!=='cancel'))fail(409,'Perubahan status tidak diizinkan.');if(['approve','return','cancel'].includes(a)&&!director)fail(403,'Hanya Direktur.');
 return json(await change(e,r,u,a,'UPDATE surat_annual SET status=?,approved_by=?,version=version+1,updated_at=? WHERE id=? AND version=? AND status=?',[t[1],a==='approve'?u.id:r.approved_by,now(),id,r.version,r.status]));
}
function mime(a){return a==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
function download(body,name,type){return new Response(body,{headers:{'Content-Type':type,'Content-Disposition':'attachment; filename="'+name+'"','Cache-Control':'private, no-store'}});}
async function documents(e,r){r={...r,data:statementData(r.data)};const logo=await e.ASSETS.fetch(new Request(e.APP_ORIGIN+'/brand/yayasan-gambut-logo.png'));if(!logo.ok)fail(503,'Logo asli belum tersedia.');const head=await e.ASSETS.fetch(new Request(e.APP_ORIGIN+'/brand/surat-letterhead.png'));if(!head.ok)fail(503,'Kop surat belum tersedia.');const signature=r.status==='issued'?await e.MEDIA.get(SIGNATURE_KEY):null;if(r.status==='issued'&&!signature)fail(503,'Tanda tangan dan stempel elektronik belum tersedia.');return letterDocuments(r,new Uint8Array(await logo.arrayBuffer()),new Uint8Array(await head.arrayBuffer()),signature?new Uint8Array(await signature.arrayBuffer()):undefined);}
