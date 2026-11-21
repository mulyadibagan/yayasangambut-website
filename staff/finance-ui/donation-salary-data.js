const current=(report,year)=>report&&Number(report.sourceAsOf?.slice(0,4))===year&&Array.isArray(report.staff)&&!report.issues?.length;
export function liveSalaryRows(rows,report,year,canonical=name=>name){
 if(!current(report,year))return rows;
 const out=rows.slice(),cents=n=>Math.round(Number(n||0)*100);
 for(const staff of report.staff){
  const name=canonical(staff.name),base=rows.filter(r=>canonical(r.staff)===name&&Number(r.year)===year);
  const delta={};
  for(const [key,value] of Object.entries({carryForward:staff.opening,claimAmount:staff.allocation,paidAmount:staff.paid,usageAmount:staff.usage}))delta[key]=(cents(value)-base.reduce((n,r)=>n+cents(r[key]),0))/100;
  if(!Object.values(delta).some(Boolean))continue;
  out.push({year,staff:name,project:'Donasi',projectGroup:'YG',savingId:'live:'+staff.id,expenseDate:report.sourceAsOf,monthKey:report.sourceAsOf.slice(0,7),...delta,amount:delta.claimAmount,balance:delta.carryForward+delta.claimAmount-delta.paidAmount-delta.usageAmount,currency:'IDR',status:'AVAILABLE',sourceType:'DONATION_CONFIRMED',sourceLabel:'Donasi dan pembayaran tercatat',sourceDescription:'Donasi dan pembayaran tercatat',sourceFileName:'Laporan tersimpan',sourceFileId:'',sourceRow:'',location:'',sourceUrl:'/finance/donations',notes:'Penyesuaian dari laporan donasi dan pembayaran tersimpan.'});
 }
 return out;
}
export function liveSalaryPosition(position,report,year){
 if(!current(report,year))return position;
 return {...position,bank:report.bookBalance,generalSaving:report.generalSaving,salaryReserve:report.salaryReserve,ygAdvance:report.staff.reduce((n,s)=>n+Math.max(0,-s.position),0)};
}
