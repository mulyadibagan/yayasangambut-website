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
  return active?null:el;
 })}<style>{'.april-cash-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.april-cash-cards button{display:grid;gap:6px;text-align:left;font:inherit;color:inherit;background:white;border:1px solid #cad9d0;border-radius:10px;padding:14px;cursor:pointer}.april-cash-cards button[aria-expanded=true]{background:#eef7f0;border-color:#397158}.april-cash-cards small{color:#285a49;text-decoration:underline}.april-project-content>header{display:flex;justify-content:space-between;align-items:start;gap:24px;margin:24px 0}.april-project-content>header h2{margin:8px 0}.april-project-content>header p{color:#63716b;margin:8px 0}.april-budget-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0}.april-budget-grid>section{border:1px solid #dbe3de;border-radius:12px;padding:18px;background:#fff}.april-budget-grid h3{font-size:1rem;margin:0 0 10px}.april-budget-grid strong{font-size:1.35rem;color:#285a49}.april-budget-grid p{font-size:.875rem;color:#5c6e66}.april-actions{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}.april-budget-detail{margin:16px 0;border-top:1px solid #dbe3de;padding-top:16px}.april-budget-detail summary{cursor:pointer;font-weight:700}.april-budget-detail table{width:100%;border-collapse:collapse;font-size:.9rem;margin-top:12px}.april-budget-detail th,.april-budget-detail td{padding:10px 12px;border-bottom:1px solid #e3e9e5;text-align:left}.april-budget-detail .amount{text-align:right;white-space:nowrap}.april-budget-detail .scroll{overflow:auto}@media(max-width:640px){.april-budget-grid{grid-template-columns:1fr}.april-project-content>header{flex-direction:column}.april-budget-detail th,.april-budget-detail td{padding:8px}}'}</style></section>;
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
 return <div className="april-project-content" aria-label="Arus kas APRIL Dayun">
 <header><div><span className="dossier-project-status">APRIL Group</span><h2>APRIL Dayun</h2><p>{s?date(s.contractStart)+' – '+date(s.contractEnd):'Program agroforestri Dayun'}</p></div><div className="dossier-balance"><small>Saldo kas tercatat</small><strong>{money((cash.incoming-cash.outgoing)/100)}</strong></div></header>
 <section className="dossier-rollforward"><div className="dossier-rollforward-head"><h3>Angka utama</h3><small>Register mutasi bank</small></div>{!cash.rows.length&&<p className="dossier-funding-note">Belum ada mutasi bank yang dialokasikan ke APRIL Dayun.</p>}<div className="april-cash-cards">{metrics.map(metric=>
 <button key={metric.label} type="button" aria-expanded={selected===metric.label} onClick={()=>setSelected(selected===metric.label?null:metric.label)}>
 <span>{metric.label}</span><strong>{money(metric.amount/100)}</strong><small>{selected===metric.label?'Tutup rincian':'Lihat rincian'}</small></button>
 )}</div>
 {detail&&<section className="april-budget-detail"><h4>Rincian {detail.label.toLowerCase()}</h4>
 {detail.transactions.length===0?<p>Belum ada transaksi untuk kategori ini.</p>:<div className="scroll"><table><thead><tr><th>Tanggal</th><th>Uraian transaksi</th><th className="amount">Masuk</th><th className="amount">Keluar</th></tr></thead>
 <tbody>{detail.transactions.map((row:any)=><tr key={row.id}><td>{row.date||row.rawDate}</td><td>{row.description}</td><td className="amount">{money(row.credit/100)}</td><td className="amount">{money(row.debit/100)}</td></tr>)}</tbody></table></div>}
 <p><b>{detail.label} · {money(detail.amount/100)}</b></p></section>}
 <details className="dossier-note"><summary>Catatan perhitungan</summary><p>Anggaran merupakan rencana pembiayaan. Kas mengikuti alokasi mutasi bank. Pelaporan PJUM tidak dihitung sebagai transaksi kas kedua.</p></details></section>
 {error&&<p role="alert">{error}</p>}{!budget&&!error&&<p role="status">Memuat anggaran proyek…</p>}
 {s&&<><div className="april-budget-grid"><section><h3>Jasa pendampingan</h3><strong>{money(s.servicesTotal)}</strong><p>Anggaran 12 bulan. Pembayaran gaji aktual dicatat terpisah.</p></section><section><h3>Kegiatan termin berjalan</h3><strong>{money(s.periodTotal)}</strong><p>{date(s.periodStart)} – {date(s.periodEnd)}</p></section></div>{[true,false].map(jasa=><details className="april-budget-detail" key={String(jasa)}><summary>{jasa?'Rincian jasa pendampingan':'Rincian anggaran kegiatan'}</summary><div className="scroll"><table><thead><tr><th>No.</th><th>Komponen</th><th className="amount">{jasa?'Anggaran 12 bulan':'Termin berjalan'}</th></tr></thead><tbody>{rows.filter((r:any)=>!!r.management===jasa).map((r:any,i:number)=><tr key={r.code}><td>{i+1}</td><td>{r.code} · {r.name}</td><td className="amount">{money(jasa?r.annualBudget:r.periodBudget)}</td></tr>)}</tbody></table></div></details>)}</>}
 <nav className="april-actions" aria-label="Layanan APRIL Dayun"><a href="/finance/advances?project=APRIL">UM &amp; PJUM</a><a href="/finance/advances/budget">Anggaran dan dokumen proyek</a></nav>
 {cash.rows.length>0&&<details className="april-budget-detail"><summary>Mutasi rekening</summary><div className="scroll"><table><thead><tr><th>Tanggal</th><th>Uraian</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>{cash.rows.map((r:any)=><tr key={r.id}><td>{r.date||r.rawDate}</td><td>{r.description}</td><td>{money(r.credit/100)}</td><td>{money(r.debit/100)}</td></tr>)}</tbody></table></div></details>}
 </div>;
}
