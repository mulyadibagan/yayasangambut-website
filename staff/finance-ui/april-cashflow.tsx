'use client';
import {Children,cloneElement,isValidElement,useEffect,useState,Fragment} from 'react';
import type {ReactNode,ReactElement} from 'react';
import history from './finance-history.json';
import {aprilCash} from './april-cash-policy';
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const date=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'—';
export function AprilProjectShell({children}:{children:ReactNode}){
 const [active,setActive]=useState(false);
 function controls(node:ReactNode):ReactNode{return Children.map(node,child=>{
  if(!isValidElement(child))return child;const el=child as ReactElement<any>,p=el.props;
  if(el.type==='select')return cloneElement(el,{value:active?'__APRIL':p.value,onChange:(e:any)=>{if(e.target.value==='__APRIL')setActive(true);else{setActive(false);p.onChange?.(e);}}},p.children,<option key="APRIL" value="__APRIL">APRIL Dayun</option>);
  return p.children?cloneElement(el,{},controls(p.children)):el;
 });}
 function tabs(node:ReactNode):ReactNode{return Children.map(node,child=>{if(!isValidElement(child))return child;const el=child as ReactElement<any>;return cloneElement(el,el.props.role==='tab'?{'aria-selected':active?false:el.props['aria-selected'],onClick:(e:any)=>{setActive(false);el.props.onClick?.(e);}}:{},el.props.children);});}
 return <section className="project-dossier">{Children.map(children,child=>{
  if(!isValidElement(child))return active?null:child;const el=child as ReactElement<any>;
  if(el.props.className==='dossier-topbar')return controls(el);
  if(el.props.className==='dossier-project-rail')return <Fragment>{cloneElement(el,{},tabs(el.props.children),<button type="button" role="tab" aria-selected={active} onClick={()=>setActive(true)}><b>APRIL Dayun</b><small>2026–2027</small></button>)}{active&&<AprilCashflow />}</Fragment>;
  if(el.type==='style')return el;
  return active?null:el;
 })}<style>{'.dossier-rollforward .april-metric-value{font:inherit;color:inherit;background:transparent;border:0;padding:0;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.april-budget-detail{margin:16px 0;border-top:1px solid #dbe3de;padding-top:16px}.april-budget-detail summary{cursor:pointer;font-weight:700}.april-budget-detail table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:12px}.april-budget-detail th,.april-budget-detail td{padding:10px 12px;border-bottom:1px solid #e3e9e5;text-align:left}.april-budget-detail .amount{text-align:right;white-space:nowrap}.april-budget-detail .scroll{overflow:auto}@media(max-width:640px){.april-budget-detail th,.april-budget-detail td{padding:8px}}'}</style></section>;
}
type ProjectAdvance={id:string;number:string;activity:string;total:number;status:string};
const advanceStatus:Record<string,string>={draft:'Draf UM',returned:'UM dikembalikan',submitted:'Pemeriksaan Keuangan',checked:'Persetujuan Direktur',approved:'Siap dicairkan',disbursed:'Menunggu PJUM',pjum_draft:'Draf PJUM',pjum_returned:'PJUM dikembalikan',pjum_submitted:'Pemeriksaan PJUM',pjum_checked:'Persetujuan PJUM',settlement:'Penyelesaian selisih',closed:'Selesai',cancelled:'Dibatalkan'};
function AprilAdvances(){
 const [records,setRecords]=useState<ProjectAdvance[]|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/finance/advances/api/project-advances?id=APRIL',{cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('Daftar UM belum dapat dimuat.');setRecords(await response.json());})
   .catch(err=>{if(err.name!=='AbortError')setError(err.message);});
  return ()=>controller.abort();
 },[]);
 return <section className="april-budget-detail"><h3>Uang muka kegiatan</h3>
  {error?<p role="alert">{error}</p>:records===null?<p role="status">Memuat pengajuan UM…</p>:records.length===0?<p>Belum ada pengajuan UM yang dapat ditampilkan.</p>:
   <div className="scroll"><table><thead><tr><th>Nomor UM</th><th>Kegiatan</th><th>Status</th><th className="amount">Nilai UM</th></tr></thead>
   <tbody>{records.map(row=><tr key={row.id}><td><a href={'/finance/advances?project=APRIL&id='+encodeURIComponent(row.id)}>{row.number}</a></td><td>{row.activity}</td><td>{advanceStatus[row.status]||row.status}</td><td className="amount">{money(row.total)}</td></tr>)}</tbody></table></div>}
 </section>;
}
export default function AprilCashflow(){
 const [budget,setBudget]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/finance/advances/api/project?id=APRIL',{cache:'no-store',signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error||'Anggaran belum dapat dimuat.');setBudget(b);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>c.abort();},[]);
 const cash=aprilCash(history.rows),s=budget?.budgetSummary,rows=budget?.activities||[];
 const [selected,setSelected]=useState<string|null>(null);
 const metrics=[
  {label:'Dana masuk',amount:cash.incoming,transactions:cash.rows.filter((row:any)=>row.credit!==0)},
  {label:'Dana keluar',amount:cash.outgoing,transactions:cash.rows.filter((row:any)=>row.debit!==0)},
  {label:'Saldo terakhir',amount:cash.incoming-cash.outgoing,transactions:cash.rows}
 ];
 const detail=metrics.find(metric=>metric.label===selected);
 return <>
 <header aria-label="Arus kas APRIL Dayun"><div><span className="dossier-project-status">APRIL Group</span><h2>APRIL Dayun</h2><p>{s?date(s.contractStart)+' – '+date(s.contractEnd):'Program agroforestri Dayun'}</p></div><div className="dossier-balance"><small>Saldo kas tercatat</small><strong>{money((cash.incoming-cash.outgoing)/100)}</strong></div></header>
 <section className="dossier-rollforward"><div className="dossier-rollforward-head"><h3>Angka utama</h3><small>Register mutasi bank</small></div>{!cash.rows.length&&<p className="dossier-funding-note">Belum ada mutasi bank yang dialokasikan ke APRIL Dayun.</p>}<dl>{metrics.map(metric=>
 <div key={metric.label}><dt>{metric.label}</dt><dd><button className="april-metric-value" type="button" aria-label={`Rincian ${metric.label}`} aria-expanded={selected===metric.label} onClick={()=>setSelected(selected===metric.label?null:metric.label)}>
 {money(metric.amount/100)}</button></dd></div>
 )}</dl>
 {detail&&<section className="april-budget-detail"><h4>Rincian {detail.label.toLowerCase()}</h4>
 {detail.transactions.length===0?<p>Belum ada transaksi untuk kategori ini.</p>:<div className="scroll"><table><thead><tr><th>Tanggal</th><th>Uraian transaksi</th><th className="amount">Masuk</th><th className="amount">Keluar</th></tr></thead>
 <tbody>{detail.transactions.map((row:any)=><tr key={row.id}><td>{row.date||row.rawDate}</td><td>{row.description}</td><td className="amount">{money(row.credit/100)}</td><td className="amount">{money(row.debit/100)}</td></tr>)}</tbody></table></div>}
 <p><b>{detail.label} · {money(detail.amount/100)}</b></p></section>}
 <details className="dossier-note"><summary>Catatan perhitungan</summary><p>Anggaran merupakan rencana pembiayaan. Kas mengikuti alokasi mutasi bank. Pelaporan PJUM tidak dihitung sebagai transaksi kas kedua.</p></details></section>
 {error&&<p role="alert">{error}</p>}{!budget&&!error&&<p role="status">Memuat anggaran proyek…</p>}
 {s&&<><section className="linked-project-status"><div><h3>Jasa pendampingan</h3><strong>{money(s.servicesTotal)}</strong><p>Anggaran 12 bulan. Pembayaran gaji aktual dicatat terpisah.</p></div><div><h3>Kegiatan termin berjalan</h3><strong>{money(s.periodTotal)}</strong><p>{date(s.periodStart)} – {date(s.periodEnd)}</p></div></section></>}
 <AprilAdvances />
 <nav aria-label="Layanan APRIL Dayun"><a href="/finance/advances?project=APRIL">UM &amp; PJUM</a><a href="/finance/advances/budget">Anggaran dan dokumen proyek</a></nav>
 {s&&<>{[true,false].map(jasa=><details className="april-budget-detail" key={String(jasa)}><summary>{jasa?'Rincian jasa pendampingan':'Rincian anggaran kegiatan'}</summary><div className="scroll"><table><thead><tr><th>No.</th><th>Komponen</th><th className="amount">{jasa?'Anggaran 12 bulan':'Termin berjalan'}</th></tr></thead><tbody>{rows.filter((r:any)=>!!r.management===jasa).map((r:any,i:number)=><tr key={r.code}><td>{i+1}</td><td>{r.code} · {r.name}</td><td className="amount">{money(jasa?r.annualBudget:r.periodBudget)}</td></tr>)}</tbody></table></div></details>)}</>}

 {cash.rows.length>0&&<details className="april-budget-detail"><summary>Mutasi rekening</summary><div className="scroll"><table><thead><tr><th>Tanggal</th><th>Uraian</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>{cash.rows.map((r:any)=><tr key={r.id}><td>{r.date||r.rawDate}</td><td>{r.description}</td><td>{money(r.credit/100)}</td><td>{money(r.debit/100)}</td></tr>)}</tbody></table></div></details>}
 </>;
}
