'use client';
import {useEffect,useState} from 'react';
export default function DonationBalanceSummary(){
 const [report,setReport]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{
  let active=true,busy=false;const controller=new AbortController();
  async function refresh(){
   if(busy||document.hidden)return;busy=true;
   try{const response=await fetch('/finance/payroll/api/report',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Saldo terbaru belum dapat dimuat.');const data=await response.json();if(!Array.isArray(data.staff))throw Error('Saldo terbaru belum lengkap.');if(active){setReport(data);setError('');window.dispatchEvent(new CustomEvent('yg-finance-report',{detail:data}));}}
   catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'Saldo terbaru belum dapat dimuat.');}finally{busy=false;}
  }
  refresh();const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 if(!report||!report.donations?.length&&!report.donationIssues?.length)return null;
 const money=(n:number|null)=>n===null?'Perlu rekonsiliasi':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
 const date=new Date(report.sourceAsOf+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
 return <section aria-label="Saldo termasuk donasi" style={{margin:'16px auto',padding:20,maxWidth:1440,background:'#eef6f0',border:'1px solid #cadfce',borderRadius:14,color:'#173e30'}}>
 <h2 style={{margin:'0 0 12px',fontSize:18}}>Saldo termasuk donasi</h2>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16}}>{[['Saldo menurut catatan',report.bookBalance],['Saving gaji tersedia',report.salaryReserve],['Saving umum',report.generalSaving],['Donasi belum tercakup mutasi',report.donationAdditional]].map(([label,value])=><div key={String(label)}><span style={{display:'block',fontSize:13}}>{label}</span><strong style={{display:'block',fontSize:21,marginTop:5}}>{money(value as number|null)}</strong></div>)}</div>
 <p style={{marginBottom:0,fontSize:13}}>Saldo mutasi bank per {date}: {money(report.bankBalance)}. Donasi yang belum tercakup mutasi sudah diperhitungkan dalam saldo menurut catatan.</p>
 {error&&<p role="alert">{error} Angka di atas adalah pembaruan terakhir yang berhasil dimuat.</p>}
 {report.donationIssues?.map((i:any,n:number)=><p role="alert" key={n}>{i.message} <a href="/finance/donations">Periksa donasi</a></p>)}
 </section>;
}
