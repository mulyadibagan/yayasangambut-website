import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {applyAdvanceArchiveDisplay} from '../scripts/finance-advance-archive-display.mjs';

test('the dashboard source receives completed reports and retains one original UM with bank metadata',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pjum-archive-display-'));
 try{
  await mkdir(join(root,'app'));
  await writeFile(join(root,'app/gmail-2025-records.ts'),'export const gmail2025Records=[];');
  await writeFile(join(root,'app/gmail-2026-records.ts'),"export const gmail2026Records=[{id:'um',type:'UM',bankStatus:'Cocok',amount:100,title:'Original'}];");
  const rows=[{id:'um',type:'UM',submitted_at:'2 Okt 2026',title:'Canonical UM',amount:100,status:'Dicairkan'},
   {id:'PJUM-WORKFLOW-r',type:'PJUM',submitted_at:'2026-11-16',title:'Report',amount:100,actual_amount:100,advance_amount:100,balance:0,parent_um_id:'um',status:'Disetujui',evidence_files:'[{"name":"Receipts.pdf","url":"https://drive.google.com/file/d/pdf/view"}]'}];
  const additions=await applyAdvanceArchiveDisplay(root,rows);
  assert.deepEqual(additions,[{id:'PJUM-WORKFLOW-r',type:'PJUM',amount:100}]);
  const file=join(root,'app/gmail-2026-records.ts'),once=await readFile(file,'utf8');
  await applyAdvanceArchiveDisplay(root,rows);
  assert.equal(await readFile(file,'utf8'),once);
  const records=(await import(pathToFileURL(file).href+'?verified')).gmail2026Records;
  assert.equal(records.length,2);assert.equal(records[0].bankStatus,'Cocok');
  assert.equal(records[0].title,'Canonical UM');
  assert.equal(records[1].parentUmId,'um');assert.equal(records[1].actualAmount,100);
  assert.equal(records[1].submissionVerified,true);assert.equal(records[1].evidenceFiles.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
