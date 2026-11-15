import {writeFile,copyFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export function aprilCashEntry(source){
 if(source.includes('/* april-cash-entry */'))return source;
 const anchor='<section className="project-dossier">',start=source.indexOf(anchor);if(start<0)throw Error('Project dossier anchor missing');
 const openEnd=start+anchor.length;let depth=1,end=-1;const tags=/<\/?section\b[^>]*>/g;tags.lastIndex=openEnd;
 for(let m;(m=tags.exec(source));){if(m[0].startsWith('</'))depth--;else if(!m[0].endsWith('/>'))depth++;if(!depth){end=m.index;break;}}
 if(end<0)throw Error('Project dossier closing tag missing');
 source=source.slice(0,start)+'<AprilProjectShell>'+source.slice(openEnd,end)+'</AprilProjectShell>'+source.slice(end+'</section>'.length);
 const directive=source.match(/^\s*(['"])use client\1;?/),at=directive?directive[0].length:0;
 return source.slice(0,at)+"\nimport {AprilProjectShell} from './april-cashflow';\n"+source.slice(at)+'\n/* april-cash-entry */\n';
}
export async function prepareAprilCash(root,source){
 for(const file of ['april-cashflow.tsx','april-cash-policy.js'])await copyFile(new URL('../finance-ui/'+file,import.meta.url),resolve(root,'app',file));
 if(source.includes('<section className="project-dossier">')||source.includes('/* april-cash-entry */'))return aprilCashEntry(source);
 const candidates=[];for(const file of await readdir(resolve(root,'app'))){if(!file.endsWith('.tsx')||file==='april-cashflow.tsx')continue;const body=await readFile(resolve(root,'app',file),'utf8');if(body.includes('<section className="project-dossier">')||body.includes('/* april-cash-entry */'))candidates.push({file,body});}
 if(candidates.length!==1)throw Error('APRIL dossier anchor missing or ambiguous: '+candidates.map(x=>x.file).join(','));
 await writeFile(resolve(root,'app',candidates[0].file),aprilCashEntry(candidates[0].body));return source;
}
