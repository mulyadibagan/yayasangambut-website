export function reportSummary(activities,unverifiedCount){
 const pending=activities.filter(row=>row.advance>0&&!['Sudah dilaporkan','PJUM terverifikasi'].includes(row.status)).length;
 if(pending)return `${pending} aktivitas belum selesai dilaporkan`;
 if(unverifiedCount)return `${unverifiedCount} PJUM belum terverifikasi`;
 return activities.length?'Semua laporan terverifikasi':'Belum ada aktivitas untuk diverifikasi';
}
export function timelineMonth(iso){const [year,month]=iso.split('-').map(Number);return (year-2026)*12+month-5;}
export function receiptEvidence(row,links=[]){
 const matched=links.filter(link=>link.date===row.postedAt&&link.amount===row.credit&&(
  link.bankReference?row.description?.split(/\s+/,1)[0]===link.bankReference:link.reference===row.reference
 ));
 if(matched.length>1)throw Error('Ambiguous receipt evidence');
 return matched[0]?.files??[];
}
export function attachReceiptEvidence(bank,links=[]){
 const targeted=links.filter(link=>link.bankReference);
 for(const link of targeted){
  if(bank.mutations.filter(row=>receiptEvidence(row,[link]).length).length!==1)throw Error('Bank receipt evidence must match one transaction');
 }
 return {...bank,mutations:bank.mutations.map(row=>{
  const files=receiptEvidence(row,targeted);
  if(!files.length)return row;
  const evidence=row.evidence??[];
  return {...row,evidence:[...evidence,...files.filter(file=>!evidence.some(old=>old.url===file.url)).map(file=>({label:file.name,url:file.url}))]};
 })};
}
export function receiptStatement(row,links=[]){
 const url=receiptEvidence(row,links)[0]?.url||row.statementUrl;
 return typeof url==='string'&&/^https:\/\/(?:drive|docs)\.google\.com\//.test(url)?url:undefined;
}
