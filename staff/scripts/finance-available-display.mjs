import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
function replace(source,from,to){if(source.includes(to))return source;if(source.split(from).length!==2)throw Error('Cash display source drift; private content not logged.');return source.replace(from,()=>to);}
export async function applyAvailableCashDisplay(root){
 const read=async file=>(await readFile(resolve(root,file),'utf8')).replace(/\r\n/g,'\n');
 const helper=await readFile(new URL('./finance-available-cash.mjs',import.meta.url),'utf8');
 let summary=await read('app/closing-august-panel.tsx');
 summary=replace(summary,"import PendingStaffAllocation", "import {availableCash} from './available-cash.js';\nimport PendingStaffAllocation");
 summary=replace(summary,' const rienaPosition=', ' const cash=availableCash(linked,a.projects);\n const rienaPosition=');
 summary=summary.replace(/\):-[\d_]+;/, "):(a.staff.find(s=>s.name==='Riena Rachmatillah')?.position??0);");
 summary=replace(summary,'<span>Saving umum YG</span><strong>{money(linked.generalSaving)}</strong><small>Dihitung dari jurnal Saving Umum</small>','<span>Saving umum YG tersedia</span><strong>{money(cash.generalAvailable)}</strong><small>Sudah dikurangi talangan proyek dan gaji</small>');
 summary=replace(summary,'<span>Kas proyek</span><strong>{money(linked.projectCash)}</strong><small>Rincian per proyek</small>','<span>Dana proyek tersedia</span><strong>{money(cash.projectAvailable)}</strong><small>Saldo positif yang masih menjadi dana proyek</small>');
 summary=replace(summary,'<span>Talangan gaji aktif</span><strong>{money(linked.ygAdvance)}</strong><small>Piutang Saving Umum · bukan kas staf</small>','<span>Talangan yang belum kembali</span><strong>{money(cash.projectAdvance+linked.ygAdvance)}</strong><small>Proyek {money(cash.projectAdvance)} · gaji {money(linked.ygAdvance)}. Informasi piutang, tidak ditambahkan ke kas.</small>');
 const start=summary.indexOf(' <div className="closing-total-saving">'),end=summary.indexOf(' <details><summary>Talangan dan catatan pemeriksaan',start);
 if(start<0||end<0)throw Error('Cash summary anchors missing');
 summary=summary.slice(0,start)+` <div className="closing-total-saving"><span>Total kas teralokasi <small>· saving umum + saving gaji + dana proyek{linked.pendingStaffCash ? " + alokasi tertunda" : ""}</small></span><strong>{money(cash.totalCash)}</strong></div>
 <details className="closing-calculation"><summary><span>Dasar pembagian saldo</span><span>Selisih {money(linked.bank-cash.totalCash)}</span></summary><p>Saving umum tersedia {money(cash.generalAvailable)} + saving gaji {money(linked.salaryReserve)} + dana proyek positif {money(cash.projectAvailable)}{linked.pendingStaffCash ? <> + alokasi tertunda {money(linked.pendingStaffCash)}</> : null} = {money(cash.totalCash)}.</p><p>Total saving tersedia (umum + gaji) {money(cash.savingAvailable)}. Talangan gaji sudah dikurangi dalam jurnal saving umum. Talangan proyek {money(cash.projectAdvance)} dikurangi satu kali untuk mendapatkan kas tersedia. Ketika penerimaan proyek sudah tercatat di mutasi dan dialokasikan ke proyek terkait, dana itu memulihkan talangannya terlebih dahulu; hanya sisanya menjadi dana proyek tersedia. Pengajuan atau janji pencairan belum menambah kas.</p></details>
`+summary.slice(end);
 let details=await read('app/fund-balance-details.tsx');
 details=replace(details,"import PendingStaffAllocation", "import {availableCash} from './available-cash.js';\nimport PendingStaffAllocation");
 details=replace(details,' const staffRows=', ' const cash=availableCash(connected,audit.projects);\n const staffRows=');
 details=replace(details,'<h2>Saving umum YG</h2></div><strong>{money(connected.generalSaving)}</strong>','<h2>Saving umum YG tersedia</h2></div><strong>{money(cash.generalAvailable)}</strong>');
 details=replace(details,'Nilai talangan dicatat sebagai piutang, bukan sebagai biaya YG.','Talangan tetap dicatat sebagai piutang, tetapi sudah mengurangi kas tersedia. Saldo jurnal {money(connected.generalSaving)} − talangan proyek {money(cash.projectAdvance)} = saving umum tersedia {money(cash.generalAvailable)}. Talangan gaji sudah tercermin di jurnal dan tidak dikurangi lagi.');
 details=details.replaceAll('<tr><th>Saldo akhir</th>','<tr><th>Saldo jurnal sebelum talangan proyek</th>');
 details=replace(details,'<h2>Dana proyek</h2><strong>{money(connected.projectCash)}</strong>','<h2>Dana proyek tersedia</h2><strong>{money(cash.projectAvailable)}</strong>');
 details=replace(details,'Setelah hak Penabulu Rp1.000.000 dan MaEarth Rp3.000.000; gaji September belum dirinci','Sudah memperhitungkan pembayaran dan pemulihan hak staf yang teralokasi');
 let salary=await read('app/salary-balance-enhancer.tsx');
 salary=replace(salary,'import { linkedSystemPosition }', 'import {availableCash} from "./available-cash.js";\nimport { linkedSystemPosition }');
 salary=replace(salary,'generalSaving: linked?.generalSaving ?? reconciliation.ygCash,','generalSaving: availableCash({generalSaving:linked?.generalSaving ?? reconciliation.ygCash,salaryReserve:0},reconciliation.projects).generalAvailable,');
 salary=replace(salary,'generalSavingAfterPlan: (linked?.generalSaving ?? reconciliation.ygCash) - targetGap,','generalSavingAfterPlan: availableCash({generalSaving:linked?.generalSaving ?? reconciliation.ygCash,salaryReserve:0},reconciliation.projects).generalAvailable - targetGap,');
 let workspace=await read('app/reconciliation-workspace.tsx');
 workspace=replace(workspace,"import PendingStaffAllocation", "import {availableCash} from './available-cash.js';\nimport PendingStaffAllocation");
 workspace=replace(workspace,' const linked=linkedSystemPosition(salaryRows);',' const linked=linkedSystemPosition(salaryRows);\n const cash=availableCash(linked,audit.projects);');
 workspace=replace(workspace,'<span>Saving umum YG</span><b>{money(linked.generalSaving)}</b>','<span>Saving umum YG tersedia</span><b>{money(cash.generalAvailable)}</b>');
 workspace=replace(workspace,'<span>Kas proyek</span><b>{money(linked.projectCash)}</b>','<span>Dana proyek tersedia</span><b>{money(cash.projectAvailable)}</b>');
 workspace=replace(workspace,'<span>{status}</span></summary><p>{next}</p>','<span>{name==="Riena"?`Talangan tercatat ${money(linked.ygAdvance)}`:status}</span></summary><p>{name==="Riena"?"Pembayaran dan pemulihan hak staf yang teralokasi sudah diperhitungkan. Talangan sudah mengurangi saving umum dan tidak dikurangi lagi.":next}</p>');
 for(const [file,value] of Object.entries({'app/available-cash.js':helper,'app/closing-august-panel.tsx':summary,'app/fund-balance-details.tsx':details,'app/salary-balance-enhancer.tsx':salary,'app/reconciliation-workspace.tsx':workspace}))await writeFile(resolve(root,file),value);
}

