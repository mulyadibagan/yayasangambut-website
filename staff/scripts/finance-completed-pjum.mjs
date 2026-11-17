export function mergeCompletedPjumReports(records,completed){
 const result=new Map(records.map(record=>[record.id,record]));
 for(const report of completed){
  if(report.type!=='PJUM'||report.status!=='Disetujui'||report.submissionVerified!==true)throw Error('Completed PJUM projection must be approved.');
  if(!result.has(report.id))continue;
  result.set(report.id,{...result.get(report.id),...report});
 }
 return [...result.values()];
}
