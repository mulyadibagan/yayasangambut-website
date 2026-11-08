import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateStatements} from './finance-bank-source-policy.mjs';

const replace=(source,from,to)=>{if(source.includes(to))return source;if(source.split(from).length!==2)throw Error('Finance review display source drift');return source.replace(from,()=>to);};
export async function applyReviewDisplay(root,documents={receipts:[],records:[]}){
 validateStatements(documents.statements);
 for(const entry of [...(documents.receipts||[]),...(documents.records||[])]){
  if(!entry||typeof entry!=='object')throw Error('Invalid document metadata');
  for(const file of entry.files||[])if(!/^https:\/\/(?:drive|docs)\.google\.com\//.test(file.url)||typeof file.name!=='string')throw Error('Invalid document link');
 }
 await writeFile(resolve(root,'app/finance-document-links.json'),JSON.stringify(documents));
 await copyFile(new URL('./finance-bank-source-policy.mjs',import.meta.url),resolve(root,'app/finance-bank-source-policy.js'));
 const bankPath=resolve(root,'app/bank-statement-2026.ts');
 let bank=await readFile(bankPath,'utf8');
 const sourceMarker='// Period-specific original statement links; financial fields unchanged.';
 if(!bank.includes(sourceMarker))bank+=`\n${sourceMarker}\nimport statementDocuments from './finance-document-links.json' with {type:'json'};\nimport {attachStatementSources} from './finance-bank-source-policy.js';\nObject.assign(bankStatement2026,attachStatementSources(bankStatement2026,statementDocuments.statements));\n`;
 await writeFile(bankPath,bank);
 const read=async file=>(await readFile(resolve(root,file),'utf8')).replace(/\r\n/g,'\n');
 let receiptCss=await read('app/project-receipt-cluster.css');
 receiptCss=replace(receiptCss,'grid-template-columns: 105px minmax(0, 1fr) auto;','grid-template-columns: minmax(0, 1fr);');
 receiptCss=receiptCss.replace('text-align: right;','text-align: left;').replace('grid-column: 2 / -1;','grid-column: auto;');
 await writeFile(resolve(root,'app/project-receipt-cluster.css'),receiptCss);
 let receipt=await read('app/project-receipt-cluster-panel.tsx');
 receipt=replace(receipt,'import source from',`import documentLinks from './finance-document-links.json';\nimport {receiptStatement} from './finance-review-display.js';\nimport source from`);
 receipt=replace(receipt,'evidenceUrl: row.evidence?.[0]?.url,','evidenceUrl: receiptStatement(row),');
 receipt=receipt.replace('receiptStatement(row),','receiptStatement(row,documentLinks.receipts),');
 receipt=replace(receipt,'Bukti ↗',"{documentLinks.receipts.some(link=>link.reference===receipt.reference&&link.date===receipt.date&&link.amount===receipt.amount)?'Bukti transfer ↗':'Mutasi bank ↗'}");
 receipt=replace(receipt,'<small>{receipt.reference}</small>','<small>Mutasi bank belum tertaut · {receipt.reference}</small>');
 let dossier=await read('app/project-dossier.tsx');
 let dashboard=await read('app/finance-archive-dashboard.tsx');
 if(!dashboard.includes("import statementDocuments from './finance-document-links.json';"))dashboard="import statementDocuments from './finance-document-links.json';\n"+dashboard;
 dashboard=replace(dashboard,'<a href={bankStatement2026.sourceUrl} target="_blank" rel="noopener noreferrer">Buka sumber mutasi rekening ↗</a>',`{(statementDocuments.statements||[]).map(statement=><a key={statement.url} href={statement.url} target="_blank" rel="noopener noreferrer" style={{marginRight:12}}>{statement.name} ↗</a>)}`);
 dashboard=replace(dashboard,'const sourceUrl = statementUrl || bankStatement2026.sourceUrl;','const sourceUrl = statementUrl;');
 dashboard=replace(dashboard,'{evidenceReview && <p>{evidenceReview}</p>}','{evidenceReview && <p>{sourceUrl ? evidenceReview.replace(/rekening koran lengkap periode [^.]+ belum ditautkan\\./gi,"Rekening koran asli periode transaksi telah ditautkan.") : evidenceReview}</p>}');
 dashboard=replace(dashboard,'if (!links.length) return <div className="bank-source-evidence">','if (!links.length && !sourceUrl) return <div className="bank-source-evidence"><small>Rekening koran asli periode transaksi belum tertaut</small></div>;\n  if (!links.length) return <div className="bank-source-evidence">');
 await writeFile(resolve(root,'app/finance-archive-dashboard.tsx'),dashboard);
 dossier=replace(dossier,"import {useState}","import {reportSummary} from './finance-review-display.js';\nimport {useState}");
 dossier=replace(dossier,"import {reportSummary}","import documentLinks from './finance-document-links.json';\nimport {reportSummary}");
 dossier=replace(dossier,'return [...(record.evidenceFiles||[]),...(email?.files||[])]',"return [...(documentLinks.records.find(item=>item.id===record.id)?.files||[]),...(record.evidenceFiles||[]),...(email?.files||[])]");
 const packageStart=dossier.indexOf('function PpcfDocumentPackage('),packageEnd=dossier.indexOf('const restorationEvidence=',packageStart);
 let generic=dossier.slice(packageStart,packageEnd).replace('PpcfDocumentPackage','MaEarthDocumentPackage').replace('const fallbackReceipt=ppcfReceiptByCode[row.code];','const fallbackReceipt=undefined;');
 generic=generic.replace('<div className="aramco-document-panel ppcf-document-panel">','<div className="aramco-document-panel ppcf-document-panel" style={{minWidth:420}}>');
 generic=generic.replace('<h4>UM</h4>','<h4>UM</h4>{umFiles.filter(file=>!/\\.xls[xm]?$/i.test(file.name)).map(file=><a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer">{file.name} ↗</a>)}');
 dossier=dossier.slice(0,packageEnd)+generic+dossier.slice(packageEnd);
 dossier=replace(dossier,"const showActivityDocuments=p.key==='PPCF'||p.key==='PENABULU'||isRestoration;","const showActivityDocuments=p.key==='PPCF'||p.key==='PENABULU'||p.key==='MAEARTH'||isRestoration;");
 dossier=replace(dossier,"p.key==='PPCF'?<PpcfDocumentPackage row={row}/>:<RestorationDocumentPackage row={row}/>","p.key==='PPCF'?<PpcfDocumentPackage row={row}/>:p.key==='MAEARTH'?<MaEarthDocumentPackage row={row}/>:<RestorationDocumentPackage row={row}/>");
 dossier=replace(dossier,"...(email?.files||[]).map(f=>({url:f.url,label:f.name}))","...auditFiles(r).map(f=>({url:f.url,label:f.name}))");
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
