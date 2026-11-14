import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {compileHistory} from './finance-history-policy.mjs';

// Only presentation modules are edited. Ledger and source data are fingerprinted.
const fingerprint=async root=>{const out={};for(const f of await readdir(resolve(root,'app')))if(/\.(?:json|ts|js)$/.test(f))out[f]=createHash('sha256').update(await readFile(resolve(root,'app',f))).digest('hex');return out;};
export function professionalCopy(source){
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
 if(!sources.some(s=>s.year===2025)){
  // The original 2025 register may be embedded in the closing source rather
  // than a separate bank-statement module. Locate its bank rows structurally.
  const candidates=[],schemas=[],unreadable=[];
  const walk=(value,file,path='',parent=null)=>{
   if(Array.isArray(value)){
    if(value.length&&value.every(r=>r&&typeof r==='object'&&typeof r.debit==='number'&&typeof r.credit==='number'&&typeof r.balance==='number')){
     let dates;try{dates=value.map(r=>String(r.postedAt||r.date||''));}catch{return;}
     if(dates.every(d=>/2025/.test(d)))candidates.push({file,path,bank:{...(parent&&!Array.isArray(parent)?parent:{}),mutations:value}});
    }else if(value.length>20&&value[0]&&typeof value[0]==='object')schemas.push({file,path,keys:Object.keys(value[0])});
    return;
   }
   if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))walk(child,file,path?path+'.'+key:key,value);
  };
  const all=await readdir(app,{recursive:true});
  let bundle;
  for(const name of all.filter(n=>n.endsWith('.json')||(!n.includes('/')&&!n.includes('\\')&&/\.(?:ts|js)$/.test(n)))){
   try{
    let data;
    if(name.endsWith('.json'))data=JSON.parse(await readFile(resolve(app,name),'utf8'));
    else{
     try{data=await import(pathToFileURL(resolve(app,name)).href);}catch{
      bundle??=(await import(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href)).build;
      const built=await bundle({entryPoints:[resolve(app,name)],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
      const target=resolve(root,'history-source-'+unreadable.length+'-'+sources.length+'.mjs');
      await writeFile(target,built.outputFiles[0].text,{mode:0o600});data=await import(pathToFileURL(target).href+'?file='+encodeURIComponent(name));
     }
    }
    walk(data,name);
   }catch{unreadable.push(name);}
  }
  const unique=[];for(const candidate of candidates)if(!unique.some(c=>JSON.stringify(c.bank.mutations)===JSON.stringify(candidate.bank.mutations)))unique.push(candidate);
  if(unique.length!==1){const imports=(await readFile(resolve(app,'finance-archive-dashboard.tsx'),'utf8')).match(/from ['"][^'"]+['"]/g);throw Error('Historical bank source needs review. Candidates: '+JSON.stringify(unique.map(c=>({file:c.file,path:c.path})))+'; array schemas: '+JSON.stringify(schemas)+'; unreadable: '+unreadable.join(', ')+'; imports: '+JSON.stringify(imports));}
  sources.unshift({year:2025,bank:unique[0].bank});
 }
 if(!sources.some(s=>s.year===2025)||!sources.some(s=>s.year===2026))throw Error('Bank history must cover both existing years. Candidate source modules: '+files.join(', '));
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
