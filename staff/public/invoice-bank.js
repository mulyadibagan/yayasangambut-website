const form=document.querySelector('#bank-form'),status=document.querySelector('#bank-status'),url='/finance/invoices/bank-settings/api';
function show(r){const active=!!r.data.account;status.textContent=active?[r.data.account_name,r.data.bank,r.data.bank_address,'Swift code: '+r.data.swift,'A/c No: '+r.data.account+' (IDR)'].join(' · '):'Belum ada rekening standar.';form.hidden=active;}
async function result(r){const b=await r.json();if(!r.ok)throw Error(b.error||'Permintaan gagal.');return b;}
fetch(url,{cache:'no-store'}).then(result).then(show).catch(e=>status.textContent=e.message);
form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{show(await result(await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))})));}catch(e){status.textContent=e.message;}finally{b.disabled=false;}});
