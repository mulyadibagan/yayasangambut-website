import {applyAdditionalSalaryList} from './finance-salary-list.mjs';
import {staffNames} from '../src/payroll-identity.mjs';
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
 const profiles=referenceProfiles||decryptProfiles(await readFile(new URL('../imports/payroll-profiles-v2.enc',import.meta.url)),process.env.PAYROLL_PROFILE_KEY_V2);
 await writeFile(resolve(root,'app/payroll-profiles.json'),JSON.stringify(profiles),{mode:0o600});
 const salary=await readFile(resolve(root,'app/salary-balance-enhancer.tsx'),'utf8');
 await writeFile(resolve(root,'app/payroll-policy.json'),JSON.stringify(extractSalaryPolicy(salary)));
 const labelPattern=/const staffLabel = \(name: string\) => name[\s\S]*?;/;
 if(!labelPattern.test(salary))throw Error('Team salary name display anchor missing.');
 const displayNames='const fullStaffNames: Record<string,string> = '+JSON.stringify(staffNames)+';\nconst staffLabel = (name: string) => fullStaffNames[name] || name;';
 await writeFile(resolve(root,'app/salary-balance-enhancer.tsx'),salary.replace(labelPattern,()=>displayNames));
 await applyAdditionalSalaryList(root);
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
 return <section className="yg-payroll-panel" aria-label="Pembayaran gaji dari pengajuan">
 <div className="yg-payroll-heading"><div><span className="yg-payroll-eyebrow">GAJI BULANAN</span><h2>Pengajuan & pembayaran gaji</h2><p>Kelola pengajuan, persetujuan, dan bukti transfer tim.</p></div><div className="yg-payroll-actions"><a className="yg-payroll-primary" href="/finance/payroll">Buka pengajuan <span aria-hidden="true">→</span></a><a href="/finance/payroll/report">Laporan & bukti transfer</a></div></div>
 {error?<p className="yg-payroll-error" role="alert">{error}</p>:!data?<p className="yg-payroll-note" role="status">Memuat pembayaran…</p>:data.payments.length===0?<div className="yg-payroll-empty"><span className="yg-payroll-dot" aria-hidden="true"/><p><strong>Belum ada pembayaran dari pengajuan</strong><span>Pembayaran dan bukti transfer akan muncul setelah dicatat Finance.</span></p></div>:<><dl className="yg-payroll-metrics"><div><dt>Pembayaran tercatat</dt><dd>{data.payments.length}<small>transaksi</small></dd></div><div><dt>Total pembayaran</dt><dd>{money(data.totalPaid)}</dd></div><div><dt>Tercakup di mutasi</dt><dd>{money(data.bankMatched)}</dd></div><div><dt>Belum tercakup di mutasi</dt><dd>{money(data.bankAdditional)}</dd></div></dl><p className="yg-payroll-note">Saldo menurut catatan: <strong>{money(data.bookBalance)}</strong>. Saldo mutasi per {data.sourceAsOf}: {money(data.bankBalance)}.</p></>}
 {data?.staff?.some((s:any)=>s.effectiveMonth)&&<div className="yg-payroll-note"><h3>Ketentuan gaji tambahan</h3>{data.staff.filter((s:any)=>s.effectiveMonth).map((s:any)=><p key={s.id}><strong>{s.name}</strong> · {money(s.monthlySalary)} / bulan · mulai {s.effectiveMonth} · {s.fundingSource}<br/>{s.notes||s.fundingStatus}</p>)}<a href="/finance/payroll/staff">Kelola data gaji staf</a></div>}
 {data?.issues.length>0&&<p className="yg-payroll-error" role="alert">{data.issues.length} pembayaran perlu diperiksa kecocokan mutasi/alokasinya.</p>}
 </section>;
}`;
 await writeFile(resolve(root,'app/payroll-payments-panel.tsx'),component);
 let page=await readFile(resolve(root,'app/finance-archive-dashboard.tsx'),'utf8');
 if(!page.includes('import PayrollPaymentsPanel')){
  const anchor='      <section className="archive-workspace">';
  if(!page.includes(anchor))throw Error('Finance dashboard payroll insertion point missing.');
  page=page.replace('import ClosingAugustPanel',"import PayrollPaymentsPanel from './payroll-payments-panel';\nimport ClosingAugustPanel");
  const headerEnd=page.indexOf('</header>',page.indexOf(anchor));
  if(headerEnd<0)throw Error('Finance page heading missing.');
  page=page.slice(0,headerEnd+9)+'\n        <PayrollPaymentsPanel />'+page.slice(headerEnd+9);
  await writeFile(resolve(root,'app/finance-archive-dashboard.tsx'),page);
 }
 if(!page.includes('id="finance-invoice-entry"')){
  const anchor='<div className="archive-header-tools">';
  if(!page.includes(anchor))throw Error('Finance header actions anchor missing.');
  page=page.replace(anchor,anchor+'<a id="finance-invoice-entry" href="/finance/invoices" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:9,background:"#155b43",color:"white",fontSize:13,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}>Invoice <span aria-hidden="true">↗</span></a>');
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
