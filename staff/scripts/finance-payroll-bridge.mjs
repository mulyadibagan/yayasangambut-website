import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createDecipheriv} from 'node:crypto';

export function decryptProfiles(bytes,hex){
 if(!/^[a-f0-9]{64}$/i.test(hex||''))throw Error('PAYROLL_PROFILE_KEY is not configured.');
 const d=createDecipheriv('aes-256-gcm',Buffer.from(hex,'hex'),bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));
 const data=JSON.parse(Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString('utf8'));
 if(!data.profiles||!data.applicant)throw Error('Payroll reference profiles invalid.');return data;
}

export function extractSalaryPolicy(source){
 const match=source.match(/const STAFF_POLICY[^=]*=\s*(\{[\s\S]*?\n\});/);
 if(!match)throw Error('Salary policy source missing; payroll auto-fill cannot be configured.');
 // Read only supported literal fields. Effective policy can contain additional
 // metadata (such as start dates); never evaluate source code or parse it as JSON.
 const value={};
 for(const entry of match[1].matchAll(/("(?:[^"\\]|\\.)*")\s*:\s*\{([^{}]*)\}/g)){
  const name=JSON.parse(entry[1]),active=entry[2].match(/\bactive\s*:\s*(true|false)\b/),amount=entry[2].match(/\bmonthlySalary\s*:\s*(null|[0-9][0-9_]*)\s*(?:,|$)/),label=entry[2].match(/\blabel\s*:\s*("(?:[^"\\]|\\.)*")/);
  if(!name||!active||!amount||Object.hasOwn(value,name))throw Error('Salary policy source invalid.');
  const monthlySalary=amount[1]==='null'?null:Number(amount[1].replaceAll('_',''));
  if(monthlySalary!==null&&(!Number.isSafeInteger(monthlySalary)||monthlySalary<0))throw Error('Salary policy amount invalid.');
  value[name]={active:active[1]==='true',monthlySalary,...(label?{label:JSON.parse(label[1])}:{})};
 }
 if(!Object.keys(value).length)throw Error('Salary policy source empty.');
 return value;
}
export async function applyPayrollBridge(root,referenceProfiles){
 const profiles=referenceProfiles||decryptProfiles(await readFile(new URL('../imports/payroll-profiles.enc',import.meta.url)),process.env.PAYROLL_PROFILE_KEY);
 await writeFile(resolve(root,'app/payroll-profiles.json'),JSON.stringify(profiles),{mode:0o600});
 const salary=await readFile(resolve(root,'app/salary-balance-enhancer.tsx'),'utf8');
 await writeFile(resolve(root,'app/payroll-policy.json'),JSON.stringify(extractSalaryPolicy(salary)));
 await mkdir(resolve(root,'app/api/payroll-source'),{recursive:true});
 await writeFile(resolve(root,'app/api/payroll-source/route.ts'),`import policy from '../../payroll-policy.json';
import profiles from '../../payroll-profiles.json';
import ledger from '../../finance-ledger-2026';
import {financeAsOfIso} from '../../finance-reporting-date';
import {salaryRowsThrough} from '../../salary-period.js';
import {GET as getSavings} from '../salary-savings/route';
export async function GET(){
 const r=await getSavings();if(!r.ok)return Response.json({error:'Sumber saving gaji belum tersedia.'},{status:503});
 const savings=await r.json();
 return Response.json({policy,profiles,asOf:financeAsOfIso,mode:savings.mode,refreshedAt:savings.refreshedAt,sourceUrl:savings.sourceUrl,rows:salaryRowsThrough(savings.rows,Number(financeAsOfIso.slice(0,4)),financeAsOfIso),bank:{account:ledger.accountNumber,name:ledger.accountName,closing:ledger.bankClosing},generalSaving:ledger.ygCash,projectCash:ledger.projectCash,pendingStaffCash:ledger.pendingStaffCash,entries:ledger.entries},{headers:{'Cache-Control':'private, no-store'}});
}`);
 // This live panel supplements the dated, immutable bank reconciliation.
 // It reads the same payroll report API as the payment register and never writes historical rows.
 const component=`'use client';
import {useEffect,useState} from 'react';
export default function PayrollPaymentsPanel(){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/finance/payroll/api/report',{signal:c.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Laporan pembayaran belum dapat dimuat.');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 const money=(n:number|null)=>n===null?'Perlu rekonsiliasi':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
 return <section aria-label="Pembayaran gaji dari pengajuan" style={{padding:20,margin:'20px 0',border:'1px solid #dce5dc',borderRadius:12,background:'#f8fbf6'}}><h2>Pengajuan dan pembayaran gaji</h2><p>Terhubung dengan alokasi gaji dan bukti transfer. Rekonsiliasi bank historis tetap memakai tanggal sumbernya.</p>{error?<p role="alert">{error}</p>:!data?<p>Memuat pembayaran…</p>:<><p><b>{data.payments.length} pembayaran</b> · Tercatat {money(data.totalPaid)} · Sudah tercakup di mutasi {money(data.bankMatched)} · Belum tercakup di mutasi {money(data.bankAdditional)}</p>{data.payments.length>0&&<p>Saldo menurut catatan setelah pembayaran gaji {money(data.bookBalance)}. Saldo mutasi per {data.sourceAsOf}: {money(data.bankBalance)}.</p>}{data.issues.length>0&&<p role="alert">{data.issues.length} pembayaran perlu diperiksa kecocokan mutasi/alokasinya.</p>}</>}<p><a href="/finance/payroll">Buka pengajuan gaji</a> · <a href="/finance/payroll/report">Laporan pembayaran dan bukti transfer</a></p></section>;
}`;
 await writeFile(resolve(root,'app/payroll-payments-panel.tsx'),component);
 let page=await readFile(resolve(root,'app/finance-archive-dashboard.tsx'),'utf8');
 if(!page.includes('import PayrollPaymentsPanel')){
  const anchor='      <section className="archive-workspace">';
  if(!page.includes(anchor))throw Error('Finance dashboard payroll insertion point missing.');
  page=page.replace('import ClosingAugustPanel',"import PayrollPaymentsPanel from './payroll-payments-panel';\nimport ClosingAugustPanel");
  page=page.replace(anchor,anchor+'\n        <PayrollPaymentsPanel />');
  await writeFile(resolve(root,'app/finance-archive-dashboard.tsx'),page);
 }
 let workspace=await readFile(resolve(root,'app/reconciliation-workspace.tsx'),'utf8');
 if(!workspace.includes('import PayrollPaymentsPanel')){
  const anchor='<main className="recon-workspace" data-tab={tab}>';if(!workspace.includes(anchor))throw Error('Reconciliation payroll insertion point missing.');
  workspace=workspace.replace("import PendingStaffAllocation","import PayrollPaymentsPanel from './payroll-payments-panel';\nimport PendingStaffAllocation").replace(anchor,anchor+'<PayrollPaymentsPanel />');
  await writeFile(resolve(root,'app/reconciliation-workspace.tsx'),workspace);
 }
 console.log('Payroll source bridge prepared from effective private salary policy and canonical ledger.');
}
