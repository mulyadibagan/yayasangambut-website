import {createHash} from 'node:crypto';

// Read only. Keep financial values out of deployment logs and generated files.
export async function financeCheckpoint({base,token,database}){
 const query=async sql=>{
  const response=await fetch(`${base}/d1/database/${database}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[]})});
  const body=await response.json();if(!response.ok||!body.success||!body.result?.[0]?.success)throw Error('Cannot verify existing finance data; deployment stopped.');
  return body.result[0].results;
 };
 const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'finance_*' ORDER BY name");
 const result=[];
 for(const {name} of tables){
  if(!/^finance_[a-z_0-9]+$/.test(name))throw Error('Unexpected finance table name.');
  const rows=await query(`SELECT * FROM "${name}"`);
  const normalized=rows.map(row=>JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(k=>[k,row[k]])))).sort();
  result.push({name,count:rows.length,digest:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')});
 }
 return result;
}
export function verifyFinanceUnchanged(before,after){
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Finance data changed during migration. Check for concurrent edits before deployment.');
 console.log(`Finance integrity verified: ${after.length} existing tables and ${after.reduce((sum,t)=>sum+t.count,0)} rows unchanged after database migrations.`);
}
