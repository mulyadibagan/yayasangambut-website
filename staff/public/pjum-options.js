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
 const unread=checks?.rows?.filter(r=>!r.read)||[];
 const blocked=!complete||report?.report_date>today||!!(unread.length&&!report?.notes?.trim());
 return {total,complete,missing,unread,blocked,read:checks?.rows?.filter(r=>r.read&&!r.result?.error).length||0};
}
