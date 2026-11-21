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
 // Refresh the original Finance views without adding a new visual panel.
 return null;
}
