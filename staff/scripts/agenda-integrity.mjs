import {createHash} from 'node:crypto';

// Read-only checkpoint: do not log agenda contents or credentials.
export async function agendaCheckpoint({base,token,database}) {
 const response=await fetch(`${base}/d1/database/${database}/query`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({sql:'SELECT * FROM team_agendas ORDER BY id',params:[]})
 });
 const body=await response.json();
 if(!response.ok||!body.success||!body.result?.[0]?.success)throw Error('Cannot verify existing agendas; deployment stopped.');
 const rows=body.result[0].results;
 const normalized=rows.map(row=>Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key]])));
 return {count:rows.length,digest:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')};
}

export function verifyAgendasUnchanged(before,after){
 if(before.count!==after.count||before.digest!==after.digest)throw Error('Agenda checkpoint changed during migration; inspect before deploying. Concurrent edits may also cause this check to stop.');
 console.log(`Agenda integrity verified: ${after.count} existing records unchanged after database migrations.`);
}
