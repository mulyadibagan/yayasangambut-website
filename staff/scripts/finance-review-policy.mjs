export function reportSummary(activities,unverifiedCount){
 const pending=activities.filter(row=>row.advance>0&&!['Sudah dilaporkan','PJUM terverifikasi'].includes(row.status)).length;
 if(pending)return `${pending} aktivitas belum selesai dilaporkan`;
 if(unverifiedCount)return `${unverifiedCount} PJUM belum terverifikasi`;
 return activities.length?'Semua laporan terverifikasi':'Belum ada aktivitas untuk diverifikasi';
}
export function timelineMonth(iso){const [year,month]=iso.split('-').map(Number);return (year-2026)*12+month-5;}
export function receiptStatement(row,links=[]){
 const matched=links.filter(link=>link.reference===row.reference&&link.date===row.postedAt&&link.amount===row.credit);
 if(matched.length>1)throw Error('Ambiguous receipt evidence');
 const url=matched[0]?.files?.[0]?.url||row.statementUrl;
 return typeof url==='string'&&/^https:\/\/(?:drive|docs)\.google\.com\//.test(url)?url:undefined;
}
