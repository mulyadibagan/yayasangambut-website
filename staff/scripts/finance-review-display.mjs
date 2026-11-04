import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const replace=(source,from,to)=>{if(source.includes(to))return source;if(source.split(from).length!==2)throw Error('Finance review display source drift');return source.replace(from,()=>to);};
export async function applyReviewDisplay(root){
 const read=async file=>(await readFile(resolve(root,file),'utf8')).replace(/\r\n/g,'\n');
 let receipt=await read('app/project-receipt-cluster-panel.tsx');
 receipt=replace(receipt,'import source from',`import {receiptStatement} from './finance-review-display.js';\nimport source from`);
 receipt=replace(receipt,'evidenceUrl: row.evidence?.[0]?.url,','evidenceUrl: receiptStatement(row),');
 receipt=replace(receipt,'Bukti ↗','Mutasi bank ↗');
 receipt=replace(receipt,'<small>{receipt.reference}</small>','<small>Mutasi bank belum tertaut · {receipt.reference}</small>');
 let dossier=await read('app/project-dossier.tsx');
 dossier=replace(dossier,"import {useState}","import {reportSummary} from './finance-review-display.js';\nimport {useState}");
 const summary="{unverifiedPjumCount?`${unverifiedPjumCount} PJUM belum terverifikasi`:'Semua laporan terverifikasi'}";
 // Both the PPCF footer and general project footer must account for UM without PJUM.
 if(dossier.includes(summary))dossier=dossier.split(summary).join('{reportSummary(activities,unverifiedPjumCount)}');
 else if(!dossier.includes('reportSummary(activities,unverifiedPjumCount)'))throw Error('Report footer source drift');
 let timeline=await read('app/spm-cls-activity-review.tsx');
 timeline=replace(timeline,"import {financeAsOfUpper}","import {timelineMonth} from './finance-review-display.js';\nimport {financeAsOfIso,financeAsOfLong,financeAsOfUpper}");
 timeline=replace(timeline,"type TimelineTone=","const currentMonthIndex=timelineMonth(financeAsOfIso);\nconst currentMonthLabel=new Intl.DateTimeFormat('id-ID',{month:'long',timeZone:'UTC'}).format(new Date(financeAsOfIso+'T00:00:00Z'));\ntype TimelineTone=");
 timeline=replace(timeline,'monthIndex<=4&&endMonthIndex>=4','monthIndex<=currentMonthIndex&&endMonthIndex>=currentMonthIndex');
 timeline=replace(timeline,'if(monthIndex<4)','if(monthIndex<currentMonthIndex)');
 timeline=replace(timeline,'if(monthIndex===4)','if(monthIndex===currentMonthIndex)');
 timeline=replace(timeline,'<small>September</small>','<small>{currentMonthLabel} · posisi {financeAsOfLong}</small>');
 await copyFile(new URL('./finance-review-policy.mjs',import.meta.url),resolve(root,'app/finance-review-display.js'));
 for(const [file,source] of [['project-receipt-cluster-panel.tsx',receipt],['project-dossier.tsx',dossier],['spm-cls-activity-review.tsx',timeline]])await writeFile(resolve(root,'app',file),source);
 console.log('Finance receipt evidence, report status and workplan display prepared; ledger unchanged.');
}
