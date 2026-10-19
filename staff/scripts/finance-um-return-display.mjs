import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {reconcileUmReturns} from './finance-um-returns.mjs';
const replace=(s,a,b)=>{if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('UM return source drift');return s.replace(a,()=>b);};
export async function applyUmReturnIntegration(root,config={}){
 const links=config.umReturns??[],read=async f=>(await readFile(resolve(root,f),'utf8')).replace(/\r\n/g,'\n');
 const ledger=JSON.parse(await read('app/closing-august-2026.json'));
 const sources=[];
 for(const year of [2025,2026])sources.push(...(await import(pathToFileURL(resolve(root,`app/gmail-${year}-records.ts`)).href))[`gmail${year}Records`]);
 const updated=reconcileUmReturns(sources,ledger,links),ids=new Set(links.map(l=>l.pjumId));
 for(const year of [2025,2026]){
  const file=`app/gmail-${year}-records.ts`,source=await read(file),marker='\n// Canonical UM return metadata.\n';
  const patches=updated.filter(r=>ids.has(r.id)).map(({id,bankAmount,bankDate,bankStatus,bankNote})=>({id,bankAmount,bankDate,bankStatus,bankNote}));
  if(!patches.length)continue;
  await writeFile(resolve(root,file),source.split(marker)[0]+marker+`for(const patch of ${JSON.stringify(patches)}){const record=gmail${year}Records.find(r=>r.id===patch.id);if(record)Object.assign(record,patch);}\n`);
 }
 await writeFile(resolve(root,'app/um-return-links.json'),JSON.stringify(links));
 await writeFile(resolve(root,'app/um-return-reconciliation.js'),await readFile(new URL('./finance-um-returns.mjs',import.meta.url),'utf8'));
 let reports=await read('app/verified-pjum-reports.js');
 if(!reports.includes("import {projectUmReturnMetadata}")){
  reports="import {projectUmReturnMetadata} from './um-return-reconciliation.js';\nimport umReturns from './um-return-links.json' with {type:'json'};\n"+reports;
  reports=replace(reports,'return [...result.values()].map(record => {','return projectUmReturnMetadata([...result.values()].map(record => {');
  reports=replace(reports,'\n  });\n}','\n  }), umReturns);\n}');
 }
 await writeFile(resolve(root,'app/verified-pjum-reports.js'),reports);
 let register=await read('app/verified-um-returns.ts');
 if(!register.includes('mergeUmReturnRegister')){
  register="import {mergeUmReturnRegister} from './um-return-reconciliation.js';\nimport umReturns from './um-return-links.json';\n"+register;
  register=replace(register,'export const verifiedUmReturns = [','const historicalUmReturns = [');
  register+='\nexport const verifiedUmReturns = mergeUmReturnRegister(historicalUmReturns,umReturns);\n';
  await writeFile(resolve(root,'app/verified-um-returns.ts'),register);
 }
 let panel=await read('app/return-reconciliation-panel.tsx');
 panel=replace(panel,'const idr =','Object.assign(names,{RESTO:"Restorasi Imbo Putui",CORE25:"Core Fund 2025",CORE26:"Core Fund 2026",BPDPKS:"BPDPKS"});\nconst idr =');
 panel=replace(panel,'Pembagian seluruh saldo bank ke saving bersih dan dana kegiatan belum final.','Pengembalian yang cocok mutasi memulihkan talangan proyek asal terlebih dahulu; hanya kelebihannya menjadi dana proyek tersedia. Rincian UM/PJUM mengikuti mutasi yang sama tanpa menambah kas kedua kali.');
 await writeFile(resolve(root,'app/return-reconciliation-panel.tsx'),panel);
 let monitor=await read('app/um-monitor-panel.tsx');
 monitor=replace(monitor,'<div className="um-summary"','<p>Pengembalian sisa UM yang cocok mutasi masuk ke proyek asal dan memulihkan talangan proyek terlebih dahulu. Sisa yang belum kembali tetap tercatat pada UM/PJUM; satu mutasi tidak dihitung dua kali. Pelunasan nominal tidak menggantikan pemeriksaan bukti dan persetujuan PJUM.</p><div className="um-summary"');
 await writeFile(resolve(root,'app/um-monitor-panel.tsx'),monitor);
 console.log('UM return links validated against bank allocations, project and parent report.');
}
