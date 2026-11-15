import {mkdir,writeFile,copyFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
// Extend the React source, never mutate the browser's React-owned DOM or ledger.
function openingEnd(source,start){let depth=0,quote='';for(let i=start;i<source.length;i++){const c=source[i];if(quote){if(c===quote&&source[i-1]!=='\\')quote='';continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}')depth--;else if(c==='>'&&depth===0)return i;}throw Error('Project select opening tag is incomplete');}
export function aprilCashEntry(source){
 if(source.includes('/* april-cash-entry */'))return source;
 const label=source.indexOf('Pilih proyek');if(label<0)throw Error('Cashflow project selector label missing');
 const start=source.indexOf('<select',label),end=openingEnd(source,start);if(start<0||start-label>1500)throw Error('Cashflow project selector missing');
 const capture=` onChangeCapture={(event)=>{if((event.target as HTMLSelectElement).value==='__APRIL'){event.stopPropagation();window.dispatchEvent(new Event('yg-april-cash-open'));}}}`;
 source=source.slice(0,start+7)+capture+source.slice(start+7,end+1)+'<option value="__APRIL">APRIL Dayun</option>'+source.slice(end+1);
 const heading=/<h2\b[^>]*>\s*Proyek(?:(?!<\/h2>)[\s\S])*<\/h2>/g;
 const matches=[...source.matchAll(heading)];if(matches.length!==1)throw Error('Cashflow project heading missing or ambiguous');
 source=source.replace(heading,match=>match+'<AprilCashflow compact />');
 const directive=source.match(/^\s*(['"])use client\1;?/);
 const at=directive?directive[0].length:0;
 source=source.slice(0,at)+"\nimport AprilCashflow from './april-cashflow';\n"+source.slice(at);
 return source+'\n/* april-cash-entry */\n';
}
export async function prepareAprilCash(root,source){
 for(const [file,target] of [['april-cashflow.tsx','app/april-cashflow.tsx'],['april-cash-policy.js','app/april-cash-policy.js']])await copyFile(new URL('../finance-ui/'+file,import.meta.url),resolve(root,target));
 if(source.includes('Pilih proyek')&&/<h2\b[^>]*>\s*Proyek(?:(?!<\/h2>)[\s\S])*<\/h2>/.test(source))return aprilCashEntry(source);
 const candidates=[];
 for(const file of await readdir(resolve(root,'app'))){if(!file.endsWith('.tsx')||file==='april-cashflow.tsx')continue;const body=await readFile(resolve(root,'app',file),'utf8');if(body.includes('Pilih proyek')&&/<h2\b[^>]*>\s*Proyek(?:(?!<\/h2>)[\s\S])*<\/h2>/.test(body))candidates.push({file,body});}
 if(candidates.length!==1)throw Error('APRIL cashflow component anchor missing or ambiguous: '+candidates.map(x=>x.file).join(','));
 await writeFile(resolve(root,'app',candidates[0].file),aprilCashEntry(candidates[0].body));
 return source;
}
