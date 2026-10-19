import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const replace=(s,a,b)=>{if(s.includes(b))return s;if(s.split(a).length!==2)throw Error('Advance display source drift');return s.replace(a,()=>b);};
export async function applyAdvanceBreakdown(root,config={staffAllocations:[]}){
 const read=async f=>(await readFile(resolve(root,f),'utf8')).replace(/\r\n/g,'\n');
 const helper=await readFile(new URL('./finance-advance-breakdown.mjs',import.meta.url),'utf8');
 const component=`import {reconciliation as ledger} from './finance-reconciliation';
import {advanceBreakdown} from './advance-breakdown.js';
import allocations from './advance-allocations.json';
const money=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:2}).format(v);
const labels:Record<string,string>={ARC3:'Aramco Phase 3',SPM25:'SPM 2025',SPMCLS:'SPM-CLS',PPCF:'PPCF',CORE25:'Core Fund 2025',CORE26:'Core Fund 2026',RESTO:'Restorasi Imbo Putui',PENABULU:'Penabulu',MAEARTH:'MaEarth',BPDPKS:'BPDPKS'};
export default function AdvanceBreakdown(){
 const report=advanceBreakdown(ledger,allocations),active=report.rows.filter(r=>r.used>0),zero=report.rows.filter(r=>r.used===0);
 return <section id="rincian-talangan" className="fund-detail-panel" aria-label="Rincian talangan saving umum"><h3>Rincian talangan saving umum</h3><p>Pemakaian tercakup = pemulihan tercatat + sisa yang harus diganti. Basis neto jurnal tersedia; bukan seluruh perputaran talangan harian. Talangan ini sudah mengurangi saving umum tersedia, tidak dikurangi lagi.</p><div className="saving-table-scroll"><table className="saving-summary-table"><thead><tr><th>Proyek / staf</th><th>Pemakaian tercakup</th><th>Sudah dipulihkan</th><th>Masih harus diganti</th><th>Dasar pencatatan</th></tr></thead><tbody>{active.map(r=><tr key={r.kind+r.id}><th>{r.kind} · {labels[r.id]||r.label}</th><td>{money(r.used)}</td><td>{money(r.recovered)}</td><td><b>{money(r.outstanding)}</b></td><td><details><summary>{r.outstanding?'Masih berjalan':'Lunas'} · rincian</summary><p>Sisa berasal dari posisi {r.kind==='Proyek'?'proyek':'saving staf'} saat ini.</p>{r.evidence.length?r.evidence.map((note,i)=><p key={i}>{note}</p>):<p>Belum ada pemulihan terpisah yang tercatat pada jurnal yang ditampilkan.</p>}<a href={r.kind==='Proyek'?'/finance/closing-2026#rincian-project':'/finance/closing-2026#rincian-staff'}>Lihat jurnal dan bukti ↗</a></details></td></tr>)}</tbody><tfoot><tr><th>Total</th><td>{money(report.totals.used)}</td><td>{money(report.totals.recovered)}</td><td><b>{money(report.totals.outstanding)}</b></td><td>Tidak ditambahkan ke kas</td></tr></tfoot></table></div><p>"Sudah dipulihkan" mencakup alokasi pengganti yang sudah tercatat, bukan hanya transfer tunai kembali. Surplus proyek tidak dihitung sebagai pengembalian talangan. Penerimaan proyek yang sudah diposting dari mutasi otomatis memulihkan talangan proyek terkait terlebih dahulu; hanya sisanya menjadi dana proyek tersedia. Dana pengganti gaji yang sudah cocok mutasi dan dialokasikan kepada staf otomatis memulihkan talangan staf tersebut ke saving umum terlebih dahulu; hanya kelebihannya menambah saving staf. Saldo per staf dan rincian pemulihan mengikuti identitas mutasi agar tidak dihitung dua kali. Penerimaan yang belum tercatat tidak menambah saving umum.</p><details><summary>Proyek dan staf tanpa talangan tercatat ({zero.length})</summary><p>{zero.map(r=>(labels[r.id]||r.label)).join(', ')}.</p></details></section>;
}
`;
 let summary=await read('app/closing-august-panel.tsx');
 summary=replace(summary,'import PendingStaffAllocation',"import AdvanceBreakdown from './advance-breakdown-panel';\nimport PendingStaffAllocation");
 summary=replace(summary,' <details><summary>Talangan dan catatan pemeriksaan',' {!full&&<AdvanceBreakdown />}\n <details><summary>Talangan dan catatan pemeriksaan');
 let details=await read('app/fund-balance-details.tsx');
 details=replace(details,'import PendingStaffAllocation',"import AdvanceBreakdown from './advance-breakdown-panel';\nimport PendingStaffAllocation");
 if(!details.includes(' <AdvanceBreakdown />')){
  const start=details.indexOf(' <div id="rincian-talangan"'),end=details.indexOf(' <details className="saving-ledger-details"',start);
  if(start<0||end<0)throw Error('Advance detail anchors missing');
  details=details.slice(0,start)+' <AdvanceBreakdown />\n'+details.slice(end);
 }
 for(const [file,data] of Object.entries({'app/advance-breakdown.js':helper,'app/advance-allocations.json':JSON.stringify(config.staffAllocations),'app/advance-breakdown-panel.tsx':component,'app/closing-august-panel.tsx':summary,'app/fund-balance-details.tsx':details}))await writeFile(resolve(root,file),data);
}

