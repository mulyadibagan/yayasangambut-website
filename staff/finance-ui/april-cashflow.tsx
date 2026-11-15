'use client';
import {useEffect,useState} from 'react';
import history from './finance-history.json';
import {aprilCash} from './april-cash-policy';
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export default function AprilCashflow({compact=false}:{compact?:boolean}){
 const [budget,setBudget]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/finance/advances/api/project?id=APRIL',{cache:'no-store',signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error||'Anggaran APRIL belum dapat dimuat.');setBudget(body);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();},[]);
 const cash=aprilCash(history.rows),s=budget?.budgetSummary;
 return <section className={'yg-april-cash '+(compact?'compact':'')} aria-label="Arus kas APRIL Dayun" style={{border:'1px solid #cbded3',borderRadius:14,padding:20,margin:'16px 0',background:'#f5f9f6'}}>
 <p className="eyebrow">APRIL GROUP · DAYUN</p><h2>{compact?<a href="/finance/projects/april-dayun">APRIL Dayun</a>:'Arus Kas Proyek · APRIL Dayun'}</h2>
 {s&&<p>Periode dokumen kontrak: {s.contractStart} – {s.contractEnd}</p>}
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:16,margin:'16px 0'}}>{[['Dana masuk tercatat',cash.incoming/100],['Dana keluar tercatat',cash.outgoing/100],['Arus kas bersih', (cash.incoming-cash.outgoing)/100]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong style={{display:'block',fontSize:20,marginTop:6}}>{money(Number(value))}</strong></div>)}</div>
 {!cash.rows.length&&<p>Belum ada mutasi bank yang dialokasikan ke APRIL Dayun dalam register tercatat.</p>}
 {error&&<p role="alert">{error}</p>}{!budget&&!error&&<p>Memuat anggaran proyek…</p>}
 {s&&<div style={{display:'flex',gap:24,flexWrap:'wrap'}}><p>Jasa pendampingan · 12 bulan<br/><b>{money(s.servicesTotal)}</b></p><p>Kegiatan termin {s.periodStart} – {s.periodEnd}<br/><b>{money(s.periodTotal)}</b></p></div>}
 <p style={{display:'flex',gap:18,flexWrap:'wrap'}}><a href="/finance/advances/budget">Anggaran jasa & kegiatan</a><a href="/finance/advances?project=APRIL">UM & PJUM APRIL Dayun</a>{compact&&<a href="/finance/projects/april-dayun">Rincian arus kas →</a>}{!compact&&<a href="/finance/?view=projects">Seluruh proyek</a>}</p>
 {!compact&&<><p>Anggaran merupakan rencana pembiayaan. Penerimaan dan pengeluaran kas mengikuti alokasi mutasi bank; pelaporan PJUM tidak dihitung sebagai transaksi kas kedua.</p>{cash.rows.length>0&&<div style={{overflowX:'auto'}}><table><thead><tr><th>Tanggal</th><th>Uraian / referensi</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>{cash.rows.map((r:any)=><tr key={r.id}><td>{r.date||r.rawDate}</td><td>{r.description}<small style={{display:'block'}}>{r.reference}</small></td><td>{money(r.credit/100)}</td><td>{money(r.debit/100)}</td></tr>)}</tbody></table></div>}</>}
 </section>;
}
