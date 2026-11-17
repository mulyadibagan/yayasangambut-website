import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export async function applyAdvanceArchiveDisplay(root,rows){
 const additions=[],marker='\n// Completed PJUM workflow archive.\n';
 for(const year of [2025,2026]){
  const path=resolve(root,'app/gmail-'+year+'-records.ts'),name='gmail'+year+'Records';
  const original=(await readFile(path,'utf8')).split(marker)[0];
  const baseline=(await import(pathToFileURL(path).href))[name];
  const defaults=Object.fromEntries([...new Set(baseline.flatMap(record=>Object.keys(record)))].map(key=>[key,null]));
  const patches=rows.filter(row=>String(row.submitted_at||'').match(/20\d{2}/)?.[0]===String(year)).map(row=>{
   const report=row.type==='PJUM';
   if(!row.id||!Number.isFinite(row.amount)||!row.title)throw Error('Completed PJUM archive invalid.');
   const patch={id:row.id,type:row.type,code:row.code||'',title:row.title,project:row.project,
    submitter:row.submitter,submittedAt:row.submitted_at,amount:row.amount,status:row.status,notes:row.notes||'',
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
  if(!patches.length)continue;
  const appended=marker+'for(const patch of '+JSON.stringify(patches)+'){const record='+name+'.find(r=>r.id===patch.id);if(record)Object.assign(record,patch);else '+name+'.push(patch as any);}\n';
  await writeFile(path,original+appended);
 }
 return additions;
}
