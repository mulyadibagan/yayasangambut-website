export function pjumChoices(rows,legacy,me){
 const states=new Set(['disbursed','pjum_draft','pjum_returned']);
 const own=rows.filter(r=>r.creator===me.id&&states.has(r.status));
 const result=own.map(r=>({key:'app:'+r.id,id:r.id,number:r.number,title:r.payload.activity,amount:r.total,project:r.payload.project,status:r.status}));
 for(const r of legacy){
  if(r.reported>0||r.linked||rows.some(n=>n.legacy_id===r.id))continue;
  const owner=/mulyadi/i.test(r.applicant)?'mulyadi@yayasangambut.org':/riena/i.test(r.applicant)?'rienaprasiddha@yayasangambut.org':/zamhar|ariel/i.test(r.applicant)?'zamharier@yayasangambut.org':'';
  if(owner!==me.email.toLowerCase())continue;
  result.push({key:'archive:'+r.id,number:r.number,title:r.title,amount:r.amount,project:r.project,status:'archive',requiresResolve:true,needsReview:r.bank_status!=='Cocok'||r.bank_amount!==r.amount||!r.paid_date});
 }
 return result;
}

export function pjumReadiness(row,today){
 const report=row?.report,checks=row?.checks,total=report?.items?.length||0;
 const complete=!!total&&checks?.complete===true;
 const missing=checks?.rows?.filter(r=>r.issues.length)||[];
 const unread=checks?.rows?.filter(r=>!r.read&&!r.resolved)||[];
 const blocked=!complete||report?.report_date>today;
 return {total,complete,missing,unread,blocked,read:checks?.rows?.filter(r=>r.read&&!r.result?.error).length||0};
}

export function pjumEmailDraft(row,reporterEmail){
 if(!row?.id||!reporterEmail||reporterEmail.toLowerCase()!==row.creator_email?.toLowerCase())return null;
 const url=new URL('https://mail.google.com/mail/');
 url.search=new URLSearchParams({authuser:reporterEmail,view:'cm',fs:'1',to:'rienaprasiddha@yayasangambut.org',su:'PJUM untuk pemeriksaan — '+(row.number||row.id),body:['Yth. Bu Riena,','','Mohon pemeriksaan laporan PJUM '+(row.number||row.id)+'.','Kegiatan: '+(row.payload?.activity||''),'','Laporan, Excel, kuitansi, dan catatan pemeriksaan tersedia di:','https://staff.yayasangambut.org/finance/advances?id='+encodeURIComponent(row.id),'','Terima kasih,',row.creator_name||reporterEmail].join('\n')});
 return url.href;
}
