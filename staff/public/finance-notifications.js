const host=document.querySelector('[data-finance-notifications]');
if(host){
 host.classList.add('yg-finance-notifications');
 let loading=false;
 async function refresh(){
  if(loading||document.hidden)return;
  loading=true;
  try{
   const response=await fetch('/api/finance-notifications',{cache:'no-store'});
   if(!response.ok){if([401,403].includes(response.status)){host.replaceChildren();host.hidden=true;}return;}
   const rows=await response.json(),heading=document.createElement('h2'),list=document.createElement('ul');
   heading.textContent='Notifikasi Finance · '+rows.length+' pemberitahuan';
   for(const row of rows){
    const item=document.createElement('li'),title=document.createElement('strong'),text=document.createElement('p'),link=document.createElement('a');
    title.textContent=row.title||'PJUM '+row.number+' selesai diperiksa Finance';
    text.textContent=row.applicant+' · '+new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(row.total)+(row.note?' · '+row.note:'');
    link.textContent=row.actionLabel||'Buka untuk persetujuan';link.href=row.href;
    item.append(title,text,link);list.append(item);
   }
   host.replaceChildren(heading,list);host.hidden=rows.length===0;
  }catch{/* Keep the last verified notification during a temporary connection failure. */}
  finally{loading=false;}
 }
 refresh();setInterval(refresh,60000);
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('focus',refresh);
}
