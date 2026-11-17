// A native workflow can also be present in the built Finance dossier. Remove
// its snapshot contribution before live projectCommitments adds it once.
export function stripWorkflowArchive(source,records,workflows){
 const native=new Map(workflows.filter(r=>!r.legacy_id).map(r=>[r.id,r]));
 const included=records.filter(r=>r.type==='UM'&&r.id?.startsWith('UM-WORKFLOW-')&&native.has(r.id.slice(12)));
 const ids=new Set(included.map(r=>r.id));
 const removedUm=new Map(),removedActual=new Map();
 for(const old of included){
  const row=native.get(old.id.slice(12)),payload=typeof row.payload==='string'?JSON.parse(row.payload):row.payload;
  if(payload.project_id!==source.id)continue;
  for(const a of payload.allocations||[])removedUm.set(a.code,(removedUm.get(a.code)||0)+a.amount);
  for(const report of records.filter(r=>r.type==='PJUM'&&r.parentUmId===old.id&&['Disetujui','Selesai'].includes(r.status))){
   const data=typeof row.report==='string'?JSON.parse(row.report):row.report;
   if((payload.allocations||[]).length===1){const code=payload.allocations[0].code;removedActual.set(code,(removedActual.get(code)||0)+Number(report.actualAmount??report.amount??0));}
   else for(const item of data?.items||[])removedActual.set(item.activity_code,(removedActual.get(item.activity_code)||0)+item.subtotal);
  }
 }
 return {records:records.filter(r=>!ids.has(r.id)&&!ids.has(r.parentUmId)),source:{...source,activities:source.activities.map(a=>{
  if(source.liveBudget)return a;
  const legacyUm=Math.max(0,(a.legacyUm||0)-(removedUm.get(a.code)||0)),legacyRealized=Math.max(0,(a.legacyRealized||0)-(removedActual.get(a.code)||0));
  return {...a,legacyUm,legacyRealized,legacyCommitted:Math.max(legacyUm,legacyRealized)};
 })}};
}
