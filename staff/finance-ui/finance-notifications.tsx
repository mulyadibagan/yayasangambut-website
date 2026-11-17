'use client';
import {useEffect,useState} from 'react';

type Notification={id:string,number:string,applicant:string,total:number,note:string,href:string};
export default function FinanceNotifications(){
 const [items,setItems]=useState<Notification[]>([]);
 useEffect(()=>{
  let active=true,loading=false;
  async function refresh(){
   if(loading||document.hidden)return;
   loading=true;
   try{
    const response=await fetch('/api/finance-notifications',{cache:'no-store'});
    if(response.ok){const rows=await response.json();if(active)setItems(rows);}
    else if(active&&[401,403].includes(response.status))setItems([]);
   }catch{/* Retain the last verified notification during a temporary connection failure. */}
   finally{loading=false;}
  }
  refresh();
  const timer=setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
  return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
 },[]);
 if(!items.length)return null;
 return <section className="yg-finance-notifications" aria-label="Notifikasi Finance" aria-live="polite">
  <h2>Notifikasi Finance · {items.length} PJUM menunggu persetujuan Anda</h2>
  <ul>{items.map(item=><li key={item.id}>
   <strong>PJUM {item.number} selesai diperiksa Finance</strong>
   <p>{item.applicant} · {new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(item.total)}{item.note?' · '+item.note:''}</p>
   <a href={item.href}>Buka untuk persetujuan</a>
  </li>)}</ul>
 </section>;
}
