import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export function integrateAdditionalSalaryRows(source){
 if(source.includes('const [effectiveSalaryStaff'))return source;
 source=source.replace(/import AdditionalSalaryRows from ['"]\.\/additional-salary-rows['"];?\s*/g,'').replace(/<AdditionalSalaryRows existingNames=\{Object\.keys\(STAFF_POLICY\)\.map\(staffLabel\)\} \/>/g,'');
 const once=(from,to)=>{if(source.split(from).length!==2)throw Error('Effective salary integration anchor changed.');source=source.replace(from,()=>to);};
 once('import { useMemo } from "react";','import { useEffect, useMemo, useState } from "react";');
 const hook=[
 '  const [effectiveSalaryStaff,setEffectiveSalaryStaff]=useState<any[]>([]);',
 '  const [effectiveSalaryError,setEffectiveSalaryError]=useState("");',
 '  const policyMonth=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Jakarta"}).slice(0,7);',
 '  useEffect(()=>{const controller=new AbortController();fetch("/finance/payroll/api/report",{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw Error("Ketentuan gaji aktif belum dapat dimuat.");return response.json();}).then(data=>{if(!Array.isArray(data.staff))throw Error("Ketentuan gaji aktif tidak lengkap.");setEffectiveSalaryStaff(data.staff);}).catch(error=>{if(error.name!=="AbortError")setEffectiveSalaryError(error.message);});return()=>controller.abort();},[]);',
 '  const canonicalSalaryName=(name:string)=>Object.keys(STAFF_POLICY).find(key=>key.toLowerCase()===name.toLowerCase()||staffLabel(key).toLowerCase()===name.toLowerCase())||name;',
 '  const effectivePolicy=(staff:string)=>{const base=policyFor(staff,year===Number(policyMonth.slice(0,4))?policyMonth+"-01":year+"-12-31"),live=(year===Number(policyMonth.slice(0,4))?effectiveSalaryStaff:[]).find(row=>canonicalSalaryName(row.name)===staff);if(!live)return base;const start=live.effectiveMonth?new Date(live.effectiveMonth+"-01T12:00:00+07:00").toLocaleDateString("id-ID",{month:"long",year:"numeric",timeZone:"Asia/Jakarta"}):"";return {...base,active:!!live.active,monthlySalary:live.monthlySalary,label:start?(live.active?"Staf aktif · ":"Mulai ")+start:base.label};};',
 ].join('\n');
 once('  const view = useMemo(() => {',hook+'\n  const view = useMemo(() => {');
 once('const names = [...new Set(rows.map((row) => row.staff))]', 'const names = [...new Set([...rows.map((row) => row.staff), ...(year===Number(policyMonth.slice(0,4))?effectiveSalaryStaff:[]).map((row) => canonicalSalaryName(row.name))])]');
 const policyCall=/const policy = policyFor\(staff(?:, cutoff)?\);/g;
 if([...source.matchAll(policyCall)].length!==1)throw Error('Effective salary policy call anchor changed.');
 source=source.replace(policyCall,'const policy = effectivePolicy(staff);');
 once('const projectedMonthlyPayroll = totals.reduce((sum, row) => sum + (row.monthlySalary ?? 0), 0);','const projectedMonthlyPayroll = currentMonthlyPayroll;');
 once('}, [savingData, year]);','}, [savingData, year, effectiveSalaryStaff]);');
 source=source.replace(/(?:Proyeksi|Kebutuhan) 5 orang \/ bulan/g,'Kebutuhan {view.activeStaff} orang / bulan');
 source=source.replace(/<small>(?:Termasuk asumsi Ainul Rp3\.500\.000|Seluruh staf sudah aktif)<\/small>/g,'<small>Ketentuan berlaku {policyMonth}</small>');
 source=source.replace('{view.activeStaff} aktif + 1 calon','{view.activeStaff} aktif').replace('{idr(view.projectedMonthlyPayroll)}*','{idr(view.projectedMonthlyPayroll)}');
 once('    <PendingStaffAllocation />','    <PendingStaffAllocation />\n    <p className="salary-footnote">Kebutuhan dan simulasi memakai ketentuan gaji aktif bulan {policyMonth}; saldo tetap mengikuti tanggal rekonsiliasi bank di atas.</p>\n    {effectiveSalaryError&&<p role="alert">{effectiveSalaryError} Total kebutuhan staf tambahan belum dapat dipastikan.</p>}');
 return source;
}

export async function applyAdditionalSalaryList(root){
 const file=resolve(root,'app/salary-balance-enhancer.tsx');
 await writeFile(file,integrateAdditionalSalaryRows(await readFile(file,'utf8')));
}
