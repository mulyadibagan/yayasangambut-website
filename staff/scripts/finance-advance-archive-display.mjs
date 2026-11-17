import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export async function applyAdvanceArchiveDisplay(root,rows){
 const additions=[],completed=[],marker='\n// Completed PJUM workflow archive.\n';
 for(const year of [2025,2026]){
  const path=resolve(root,'app/gmail-'+year+'-records.ts'),name='gmail'+year+'Records';
  const original=(await readFile(path,'utf8')).split(marker)[0];
  const baseline=(await import(pathToFileURL(path).href))[name];
  const defaults=Object.fromEntries([...new Set(baseline.flatMap(record=>Object.keys(record)))].map(key=>[key,null]));
  const patches=rows.filter(row=>String(row.submitted_at||'').match(/20\d{2}/)?.[0]===String(year)).map(row=>{
   const report=row.type==='PJUM';
   if(!row.id||!Number.isFinite(row.amount)||!row.title)throw Error('Completed PJUM archive invalid.');
   const patch={id:row.id,type:row.type,code:row.code||'',title:row.title,project:row.project,
    submitter:row.submitter,submittedAt:report&&/^\d{4}-\d{2}-\d{2}$/.test(row.submitted_at)?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(row.submitted_at+'T00:00:00Z')):row.submitted_at,amount:row.amount,status:row.status,notes:row.notes||'',
    ...(report?{parentUmId:row.parent_um_id,advanceAmount:row.advance_amount,actualAmount:row.actual_amount,balance:row.balance,
     pjumNumber:row.document_number,documentNumber:row.document_number,documentUrl:row.document_url,
     documentName:row.document_name,archiveFolderUrl:row.archive_folder_url,submissionVerified:true,
     evidenceFiles:JSON.parse(row.evidence_files||'[]')}:{})};
   if(baseline.some(item=>item.id===row.id))return patch;
   additions.push({id:row.id,type:row.type,amount:row.amount});
   // The seed importer binds the complete source-record shape to D1.
   // Absent source metadata must remain explicit nullable fields.
   return {...defaults,...patch,sourceEmailId:row.source_email_id||''};
  });
  completed.push(...patches.filter(record=>record.type==='PJUM'));
  if(!patches.length)continue;
  const appended=marker+'for(const patch of '+JSON.stringify(patches)+'){const record='+name+'.find(r=>r.id===patch.id);if(record)Object.assign(record,patch);else '+name+'.push(patch as any);}\n';
  await writeFile(path,original+appended);
 }
 await writeFile(resolve(root,'app/completed-pjum-workflow.json'),JSON.stringify(completed));
 await copyFile(new URL('./finance-completed-pjum.mjs',import.meta.url),resolve(root,'app/completed-pjum-workflow.js'));
 const reportsPath=resolve(root,'app/verified-pjum-reports.js');
 let reports=await readFile(reportsPath,'utf8');
 if(!reports.includes("import {mergeCompletedPjumReports}")){
  const start='return projectUmReturnMetadata([...result.values()].map(record => {',end='\n  }), umReturns);\n}';
  if(reports.split(start).length!==2||reports.split(end).length!==2)throw Error('Completed PJUM policy source drift.');
  reports="import {mergeCompletedPjumReports} from './completed-pjum-workflow.js';\nimport completedPjumWorkflow from './completed-pjum-workflow.json' with {type:'json'};\n"+reports;
  reports=reports.replace(start,'return mergeCompletedPjumReports(projectUmReturnMetadata([...result.values()].map(record => {').replace(end,'\n  }), umReturns),completedPjumWorkflow);\n}');
  await writeFile(reportsPath,reports);
 }
 return additions;
}
