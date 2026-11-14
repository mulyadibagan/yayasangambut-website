import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compileHistory} from './finance-history-policy.mjs';

// Only presentation modules are edited. Ledger and source data are fingerprinted.
const fingerprint=async root=>{const out={};for(const f of await readdir(resolve(root,'app')))if(/\.(?:json|ts|js)$/.test(f))out[f]=createHash('sha256').update(await readFile(resolve(root,'app',f))).digest('hex');return out;};
export function professionalCopy(source){
 source=source.replace(/<p><b>Satu register keuangan\.<\/b>[\s\S]*?<\/p>/g,'<p>Mutasi rekening dan alokasi dana menggunakan sumber transaksi yang sama. Bukti pendukung tersedia pada setiap transaksi.</p>');
 source=source.replaceAll('Satu register keuangan. Mutasi rekening, alokasi Cashflow Project, Saving Gaji, dan Saving Umum membaca baris transaksi yang sama. Dokumen tertaut membuka salinan di Drive kerja; email hanya menjadi jejak asal pengiriman.','Mutasi rekening dan alokasi dana menggunakan sumber transaksi yang sama. Bukti pendukung tersedia pada setiap transaksi.');
 const labels={
  'Cashflow Project':'Arus Kas Proyek','cashflow project':'arus kas proyek','Arsip & Cashflow':'Arsip & Arus Kas','REVIEW CASHFLOW':'ARUS KAS PROYEK','REVIEW PER PROYEK':'RINGKASAN PROYEK','Prioritas review':'Prioritas pemeriksaan','Saldo live diperbarui':'Saldo diperbarui','PENERIMAAN PROJECT':'PENERIMAAN PROYEK','Penerimaan project':'Penerimaan proyek','Semua project':'Semua proyek','Cari judul, kode, project, atau pengirim…':'Cari judul, kode, proyek, atau pengirim…','TIMELINE PROYEK & CASHFLOW · PALING BAWAH':'JADWAL DAN ARUS KAS PROYEK','Timeline workplan dan pekerjaan yang harus dikontrol':'Jadwal kegiatan dan tindak lanjut','Kontrol donor yang tidak boleh terlewat':'Kewajiban pelaporan donor','Timeline mutasi bank dan alokasi internal':'Riwayat mutasi dan alokasi dana','Satu register keuangan. Mutasi rekening, alokasi Cashflow Project, Saving Gaji, dan Saving Umum membaca baris transaksi yang sama. Dokumen tertaut membuka salinan di Drive kerja; email hanya menjadi jejak asal pengiriman.':'Mutasi rekening dan alokasi dana menggunakan sumber transaksi yang sama. Bukti pendukung tersedia pada setiap transaksi.',
 };
 // Exact phrases only: do not rename data fields, identifiers, statuses or arithmetic.
 for(const [from,to] of Object.entries(labels))source=source.replaceAll(from,to);
 source=source.replace(/>Cut-off /g,'>Posisi per ').replace(/>Budget dan pelaksanaan/g,'>Anggaran dan pelaksanaan').replace(/>Proyeksi setelah pending</g,'>Proyeksi setelah transaksi tertunda<').replace(/>Tidak ada transaksi pending</g,'>Tidak ada transaksi tertunda<');
 source=source.replace(/>Belum dilaporkan ke Riena</g,'>Belum dilaporkan ke Bagian Keuangan<').replace(/>Saldo belum dilaporkan ke Riena</g,'>Saldo belum dilaporkan ke Bagian Keuangan<');
 // Keep audit methodology available without dominating the dashboard.
 source=source.replace(/<p(?: className="[^"]*")?>((?:Pemakaian tercakup =|"Sudah dipulihkan" mencakup|Total alokasi =)[^<]+)<\/p>/g,'<details className="yg-methodology"><summary>Dasar perhitungan</summary><p>$1</p></details>');
 // Remove only the repeated projection card, never its underlying calculations.
 source=source.replace(/<(div|article)(?: className="[^"]*")?>\s*<(span|small)>Kebutuhan \{view\.activeStaff\} orang \/ bulan<\/\2>\s*<strong>\{idr\(view\.projectedMonthlyPayroll\)\}<\/strong>\s*<small>[^<]*<\/small>\s*<\/\1>/g,'');
 return source;
}

export async function applyFinancePresentation(root){
 const before=await fingerprint(root),app=resolve(root,'app');
 for(const name of await readdir(app)){
  if(!name.endsWith('.tsx')||name==='finance-history-report.tsx')continue;
  let source=await readFile(resolve(app,name),'utf8');
  if(['finance-archive-dashboard.tsx','reconciliation-workspace.tsx'].includes(name)){
   source=source.replace(/import PayrollPaymentsPanel from ['"]\.\/payroll-payments-panel['"];?\s*/g,'').replace(/<PayrollPaymentsPanel\s*\/>/g,'');
   source=source.replace(/<a id="finance-invoice-entry"[\s\S]*?<\/a>/g,'');
  }
  if(name==='salary-balance-enhancer.tsx'&&!source.includes('import PayrollPaymentsPanel')){
   if(!source.includes('<PendingStaffAllocation />'))throw Error('Salary presentation anchor missing');
   source=source.replace('import PendingStaffAllocation',"import PayrollPaymentsPanel from './payroll-payments-panel';\nimport PendingStaffAllocation").replace('<PendingStaffAllocation />','<PayrollPaymentsPanel /><PendingStaffAllocation />');
  }
  await writeFile(resolve(app,name),professionalCopy(source));
 }
 const after=await fingerprint(root);
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Presentation altered source data');
 // Read the private bank sources only; never migrate or write financial records.
 const files=(await readdir(app)).filter(n=>/(?:bank|statement|mutasi)/i.test(n)&&/20\d{2}/.test(n)&&/\.(?:ts|js|json)$/.test(n)).sort();
 const sources=[];
 for(const file of files){
  const mod=file.endsWith('.json')?{default:JSON.parse(await readFile(resolve(app,file),'utf8'))}:await import(pathToFileURL(resolve(app,file)).href);
  const candidates=[];
  for(const value of Object.values(mod)){
   if(!value||typeof value!=='object')continue;
   const list=Array.isArray(value)?value:value.mutations||value.entries||value.transactions||value.rows;
   if(!Array.isArray(list)||!list.length||!list.every(r=>typeof r.debit==='number'&&typeof r.credit==='number'))continue;
   candidates.push(Array.isArray(value)?{mutations:list}:{...value,mutations:list});
  }
  if(!candidates.length)continue;
  if(candidates.length!==1)throw Error('Bank history source schema needs review: '+file);
  const year=Number(file.match(/20\d{2}/)[0]);
  if(sources.some(s=>s.year===year))continue;
  sources.push({year,bank:candidates[0]});
 }
 const legacyPath=resolve(app,'multi-year-source.json');
 try{
  const archive=JSON.parse(await readFile(legacyPath,'utf8'));
  if(!Array.isArray(archive.years))throw Error('Legacy history years missing');
  const {rowProjectKey}=await import(pathToFileURL(resolve(app,'multi-year-reconciliation.js')).href);
  for(const sheet of archive.years){
   const year=Number(sheet.year);if(sources.some(s=>s.year===year))continue;
   if(!Array.isArray(sheet.rows)||!sheet.rows.length)throw Error('Legacy bank rows missing');
   const opening=sheet.rows.find(r=>r.opening)?.balance;
   const mutations=sheet.rows.filter(r=>!r.opening).map((r,i)=>{
    if(![r.incoming,r.outgoing,r.balance].every(Number.isFinite))throw Error('Legacy bank amounts need review');
    return {archiveIndex:i,date:r.date,project:rowProjectKey(year,r),description:r.description,reference:String(r.row??''),debit:r.outgoing,credit:r.incoming,balance:r.balance,evidence:(r.links||[]).map(link=>typeof link==='string'?{url:link,label:'Bukti'}:{url:link.url,label:link.label||link.name||'Bukti'})};
   });
   sources.push({year,allowUncertainDates:true,bank:{openingBalance:opening,closingBalance:sheet.rows.at(-1).balance,mutations}});
  }
 }catch(error){if(error.code!=='ENOENT')throw error;}
 if(!sources.some(s=>s.year===2025)||!sources.some(s=>s.year===2026))throw Error('Bank history must include all existing periods');
 const closing=JSON.parse(await readFile(resolve(app,'closing-august-2026.json'),'utf8'));
 const report=compileHistory(sources,closing);
 await writeFile(resolve(app,'finance-history.json'),JSON.stringify(report),{mode:0o600});
 await copyFile(new URL('./finance-history-policy.mjs',import.meta.url),resolve(app,'finance-history-policy.js'));
 await copyFile(new URL('../finance-ui/history-report.tsx',import.meta.url),resolve(app,'finance-history-report.tsx'));
 await copyFile(new URL('../finance-ui/history-report.css',import.meta.url),resolve(app,'finance-history.css'));
 await mkdir(resolve(app,'reports'),{recursive:true});
 await writeFile(resolve(app,'reports/page.tsx'),"import HistoryReport from '../finance-history-report';\nexport default function ReportsPage(){return <HistoryReport />;}\n");
 const navFile=resolve(app,'finance-staff-tools.tsx');
 let nav=await readFile(navFile,'utf8');
 nav=nav.replace('<div><a href="/finance/invoices">','<div><a href="/finance/reports">Penerimaan & pengeluaran</a><a href="/finance/invoices">');
 await writeFile(navFile,nav);
 console.log('Finance presentation prepared; source data fingerprints unchanged; full bank history report validated.');
}
