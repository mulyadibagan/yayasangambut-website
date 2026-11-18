import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {integrateFinance} from '../src/finance-integration.mjs';

export function workflowArchiveRows(archive,workflows){
 return integrateFinance(archive,workflows,null).records.filter(r=>r.workflowId&&(r.type==='UM'&&r.workflowPaid||r.type==='PJUM'&&r.status==='Disetujui')).map(r=>({
  ...r,submitted_at:r.submittedAt,parent_um_id:r.parentUmId,advance_amount:r.advanceAmount,actual_amount:r.actualAmount,
  document_number:r.documentNumber,document_url:r.documentUrl,document_name:r.documentName,archive_folder_url:r.archiveFolderUrl,
  source_email_id:r.sourceEmailId,evidence_files:JSON.stringify(r.evidenceFiles||[]),
 }));
}
export async function applyLiveFinanceIntegration(root,query){
 const history=JSON.parse(await readFile(resolve(root,'app/finance-history.json'),'utf8'));
 // Validate the same bank dataset shown in the historical reports before it is
 // made available to the live staff service. Never add cash from workflow data.
 const checked=integrateFinance([],[],history);
 if(!checked.coverage.length)throw Error('Register bank terintegrasi tidak tersedia.');
 const snapshot=JSON.stringify(history),hash=createHash('sha256').update(snapshot).digest('hex');
 await query("INSERT INTO finance_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",['finance_bank_history_v1',snapshot]);
 await query("INSERT INTO finance_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",['finance_bank_history_meta_v1',JSON.stringify({hash,asOf:history.to,preparedAt:new Date().toISOString()})]);
 // Preserve the reviewed bank/parent metadata used by the existing Finance
 // dossiers. Those fields are not all stored on the original D1 request rows.
 const sources=[];
 for(const year of [2025,2026]){
  const path=resolve(root,'app/gmail-'+year+'-records.ts');
  const rows=(await import(pathToFileURL(path).href+'?live-finance-source'))['gmail'+year+'Records'];
  if(!Array.isArray(rows)||rows.some(r=>!r.id))throw Error('Arsip sumber Finance tidak valid.');
  sources.push(...rows);
 }
 await query("INSERT INTO finance_settings(setting_key,setting_value) VALUES(?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value",['finance_archive_metadata_v1',JSON.stringify(sources)]);
 await copyFile(new URL('../finance-ui/integrated-finance.tsx',import.meta.url),resolve(root,'app/integrated-finance.tsx'));
 await copyFile(new URL('../finance-ui/paired-finance.js',import.meta.url),resolve(root,'app/paired-finance.js'));
 const layoutPath=resolve(root,'app/layout.tsx');let layout=await readFile(layoutPath,'utf8');
 // Remove the duplicate panel from the shared layout. The existing UM/PJUM
 // monitor is the single mount; cashflow and the main summary keep their own views.
 layout=layout.replace(/import IntegratedFinance from ['"]\.\/integrated-finance['"];?\s*/g,'').replace(/<IntegratedFinance\s*\/>/g,'');
 await writeFile(layoutPath,layout);
 const monitorPath=resolve(root,'app/um-monitor-panel.tsx');
 let monitor='';try{monitor=await readFile(monitorPath,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!monitor)throw Error('Existing UM/PJUM monitor missing.');
 const marker='// paired-finance-monitor';
 if(!monitor.includes(marker)){
  if(monitor&&!monitor.includes('// live-finance-monitor'))await writeFile(resolve(root,'app/um-monitor-archive.tsx'),monitor);
  let legacy=false;try{await readFile(resolve(root,'app/um-monitor-archive.tsx'));legacy=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(monitorPath,marker+'\n'+(legacy?"export * from './um-monitor-archive';\n":'')+"import IntegratedFinance from './integrated-finance';\nexport default function UmMonitorPanel(props:any){return <IntegratedFinance {...props} />;}\n");
 }
 console.log('Live UM/PJUM and project cashflow use one validated bank register; cash ledger unchanged.');
}
