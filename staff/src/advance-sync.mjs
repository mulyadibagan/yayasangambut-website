// Merge live email reservations with dossier ceilings. Never write bank entries.
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const number=r=>norm(r.umNumber||r.documentNumber||'').replace(/\s/g,'');
const amount=r=>Number(r.advanceAmount??r.amount??0);
const paid=r=>r.status==='Dicairkan'||r.bankStatus==='Cocok'&&Number(r.bankAmount)===amount(r);
const inactive=r=>['Ditolak','Dibatalkan','Draf'].includes(r.status);
export function archiveIdentity(r){
 const n=number(r);if(n)return 'number:'+n;
 if(r.documentName)return 'file:'+norm(r.documentName);
 return 'email:'+norm(r.title).replace(/^(?:(?:re|fw|fwd):\s*)+/,'')+'|'+amount(r)+'|'+String(r.submittedAt||'').split(',')[0];
}
export function archiveAllocations(source,r){
 const explicit=r.allocations||[];
 if(explicit.length&&explicit.every(x=>source.activities.some(a=>a.code===x.code))&&explicit.reduce((n,x)=>n+x.amount,0)===amount(r))return explicit;
 const exact=source.activities.find(a=>a.code===r.code);
 if(exact)return [{code:exact.code,amount:amount(r)}];
 const candidates=source.activities.filter(a=>norm(r.title).includes(norm(a.name)));
 if(candidates.length===1)return [{code:candidates[0].code,amount:amount(r)}];
 // Reviewed multi-activity YG form: resolve codes only, amounts must reconcile
 // exactly to the remaining approved ceilings. Partial allocations stay unknown.
 if(source.id==='SPMCLS'&&/UMSPMCLS_Agroforestry_Video\.xlsx$/i.test(r.documentName||'')){
  const activities=['1.1.3','2.1.1'].map(code=>source.activities.find(a=>a.code===code));
  if(activities.every(a=>a&&a.budget!==null)){
   const allocations=activities.map(a=>({code:a.code,amount:Math.max(0,a.budget-a.legacyCommitted)}));
   if(allocations.reduce((n,a)=>n+a.amount,0)===amount(r))return allocations;
  }
 }
 return [];
}
function sameProject(source,r){
 const key=norm(r.projectCode||r.project).replace(/^yg[_-]/,'').replace(/[^a-z0-9]/g,'');
 const aliases={SPMCLS:['spmclsriau'],CORE26:['akcf26'],MAEARTH:['maearth']};
 return [source.id,source.name,...(aliases[source.id]||[])].some(x=>norm(x).replace(/[^a-z0-9]/g,'')===key);
}
export function syncArchive(source,records){
 const groups=new Map();
 for(const r of records){if(r.type!=='UM'||inactive(r)||!sameProject(source,r)||amount(r)<=0)continue;
  const key=archiveIdentity(r),old=groups.get(key);
  if(!old||paid(r)&&!paid(old)||!/^re:/i.test(r.title)&&/^re:/i.test(old.title))groups.set(key,r);
 }
 const archive=[...groups.values()].map(r=>{
  const reports=records.filter(p=>p.type==='PJUM'&&p.parentUmId===r.id&&!['Ditolak','Dibatalkan','Draf'].includes(p.status));
  const verified=reports.filter(p=>p.submissionVerified===true||['Menunggu Persetujuan','Dilaporkan ke Riena','Disetujui','Selesai','Perlu Revisi'].includes(p.status));
  return {id:r.id,identity:archiveIdentity(r),number:number(r),paid:paid(r),allocations:archiveAllocations(source,r),reported:verified.reduce((n,p)=>n+Number(p.actualAmount??p.amount??0),0),returned:verified.filter(p=>p.bankStatus==='Cocok'&&Number(p.bankAmount)===Number(p.balance)).reduce((n,p)=>n+Number(p.balance||0),0)};
 });
 const unallocated=archive.filter(r=>!r.paid&&!r.allocations.length).length;
 return {...source,archive,unallocated,activities:source.activities.map(a=>{
  const paidRows=archive.filter(r=>r.paid),legacyUm=paidRows.reduce((n,r)=>n+(r.allocations.find(x=>x.code===a.code)?.amount||0),0),legacyRealized=paidRows.filter(r=>r.allocations.length===1&&r.allocations[0].code===a.code).reduce((n,r)=>n+r.reported,0);
  return {...a,...(source.liveBudget?{legacyUm,legacyRealized,legacyCommitted:Math.max(legacyUm,legacyRealized)}:{}),archivePending:archive.filter(r=>!r.paid).reduce((n,r)=>n+(r.allocations.find(x=>x.code===a.code)?.amount||0),0),archiveOutstanding:paidRows.filter(r=>r.allocations.length===1&&r.allocations[0].code===a.code).reduce((n,r)=>n+Math.max(0,r.allocations[0].amount-r.reported-r.returned),0)};
 })};
}
