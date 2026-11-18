import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

// Change the existing summary sections, never append another dashboard.
export function replaceSummarySection(source,className,replacement){
 const start=new RegExp('<section\\b[^>]*className="'+className+'"[^>]*>','g');
 const matches=[...source.matchAll(start)];
 if(matches.length!==1)throw Error('Finance summary section missing or ambiguous: '+className);
 const at=matches[0].index,tags=/<\/?section\b[^>]*>/g;tags.lastIndex=at;let depth=0,end;
 for(let token;(token=tags.exec(source));){depth+=token[0].startsWith('</')?-1:1;if(depth===0){end=tags.lastIndex;break;}}
 if(!end)throw Error('Unclosed Finance summary section: '+className);
 const original=source.slice(at,end);
 return source.slice(0,at)+replacement(original)+source.slice(end);
}
export function compactFinanceDashboard(source){
 if(source.includes('/* paired-summary-v1 */'))return source;
 source=replaceSummarySection(source,'review-attention',()=>'<FinanceReportingSummary />');
 for(const [name,title]of [['project-review','Posisi dana per proyek'],['recent-finance','Aktivitas keuangan terbaru']]){
  source=replaceSummarySection(source,name,section=>'<details className="yg-summary-details"><summary>'+title+'</summary>'+section+'</details>');
 }
 const statement="import FinanceReportingSummary from './finance-reporting-summary';\n";
 source=/^\s*['"]use client['"];?/.test(source)?source.replace(/^(\s*['"]use client['"];?)/,'$1\n'+statement):statement+source;
 return source+'\n/* paired-summary-v1 */\n';
}
export async function applyCompactFinanceSummary(root){
 const path=resolve(root,'app/finance-archive-dashboard.tsx');
 await writeFile(path,compactFinanceDashboard(await readFile(path,'utf8')));
 const closingPath=resolve(root,'app/closing-august-panel.tsx');let closing=await readFile(closingPath,'utf8');
 if(!closing.includes('/* compact-advance-details */')){
  if(!closing.includes('<AdvanceBreakdown />'))throw Error('Finance advance breakdown missing.');
  closing=closing.replace('<AdvanceBreakdown />','<details className="yg-summary-details"><summary>Rincian talangan</summary><AdvanceBreakdown /></details>')+'\n/* compact-advance-details */\n';
  await writeFile(closingPath,closing);
 }
 await copyFile(new URL('../finance-ui/finance-reporting-summary.tsx',import.meta.url),resolve(root,'app/finance-reporting-summary.tsx'));
 await mkdir(resolve(root,'app/um-pjum'),{recursive:true});
 await writeFile(resolve(root,'app/um-pjum/page.tsx'),"import IntegratedFinance from '../integrated-finance';\nexport default function UmPjumPage(){return <main style={{padding:'24px',maxWidth:1440,margin:'auto'}}><a href='/finance'>← Ringkasan keuangan</a><IntegratedFinance /></main>;}\n");
}
