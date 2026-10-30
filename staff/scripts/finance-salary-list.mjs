import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export function integrateAdditionalSalaryRows(source){
 if(source.includes('<AdditionalSalaryRows '))return source;
 const heading=source.indexOf('Posisi gaji per staf'),body=source.indexOf('<tbody',heading),end=source.indexOf('>',body);
 if(heading<0||body<0||end<0)throw Error('Salary staff table insertion point missing.');
 const updated=source.slice(0,end+1)+'<AdditionalSalaryRows existingNames={Object.keys(STAFF_POLICY).map(staffLabel)} />'+source.slice(end+1);
 const declaration="import AdditionalSalaryRows from './additional-salary-rows';\n";
 const directive=/^\s*(['"])use client\1;?/;
 return directive.test(updated)?updated.replace(directive,match=>match+'\n'+declaration):declaration+updated;
}
export async function applyAdditionalSalaryList(root){
 const file=resolve(root,'app/salary-balance-enhancer.tsx');
 await writeFile(file,integrateAdditionalSalaryRows(await readFile(file,'utf8')));
 await writeFile(resolve(root,'app/additional-salary-rows.tsx'),`'use client';
import {useEffect,useState} from 'react';
export default function AdditionalSalaryRows({existingNames}:{existingNames:string[]}){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/finance/payroll/api/report',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Data staf tambahan belum dapat dimuat.');return r.json();}).then(d=>setRows(d.staff||[])).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
 const money=(n:number|null)=>n===null?'Perlu rekonsiliasi':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
 if(error)return <tr><td colSpan={11} role="status">{error}</td></tr>;
 return <>{rows.filter(s=>s.effectiveMonth&&!existingNames.some(n=>n.toLowerCase()===s.name.toLowerCase())).map(s=>{
 const start=new Date(s.effectiveMonth+'-01T12:00:00+07:00').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
 const position=s.position;
 return <tr key={s.id}><td><strong>{s.name}</strong><br/><small>{s.fundingSource}</small></td><td>{s.active?'Staf aktif · ':'Mulai '}{start}<br/><small>{s.fundingStatus}</small></td><td>{money(s.monthlySalary)}</td><td>{money(s.opening)}</td><td>{s.allocation===0?money(0):'Lihat rincian'}</td><td>{s.allocation===0?money(0):'Lihat rincian'}</td><td>{money(s.opening+s.allocation)}</td><td>{money(s.paid)}</td><td>{money(position===null?null:Math.max(0,position))}</td><td>{money(position===null?null:Math.max(0,-position))}</td><td>{position===null?'Perlu rekonsiliasi':(Math.max(0,position)/s.monthlySalary).toLocaleString('id-ID',{maximumFractionDigits:1})+' bulan'}</td></tr>;
 })}</>;
}`);
}
