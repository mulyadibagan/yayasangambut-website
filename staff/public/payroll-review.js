const root=document.querySelector('.decision'),confirmBox=document.querySelector('#review-confirmed'),approve=document.querySelector('#review-approve'),back=document.querySelector('#review-return'),message=document.querySelector('#review-message');
let busy=false;
confirmBox.onchange=()=>approve.disabled=busy||!confirmBox.checked;
async function decide(action){
 if(busy)return;
 const note=document.querySelector('#review-comment').value.trim();
 if(action==='return'&&!note){message.textContent='Isi catatan perbaikan terlebih dahulu.';return;}
 if(action==='approve'&&!confirmBox.checked)return;
 if(!window.confirm(action==='approve'?'Setujui formulir yang sudah Anda review? Email pemberitahuan akan dikirim ke Hisam, Serena, dan Riena.':'Kembalikan formulir kepada Finance untuk diperbaiki?'))return;
 busy=true;approve.disabled=true;back.disabled=true;message.textContent='Menyimpan keputusan…';
 try{const response=await fetch('/finance/payroll/api/'+root.dataset.request+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:Number(root.dataset.version),note,review_token:root.dataset.token,review_confirmed:confirmBox.checked})});const data=await response.json();if(!response.ok)throw Error(data.error||'Keputusan belum tersimpan.');location.assign('/finance/payroll?id='+root.dataset.request);}
 catch(e){message.textContent=e.message;busy=false;approve.disabled=!confirmBox.checked;back.disabled=false;}
}
approve.onclick=()=>decide('approve');back.onclick=()=>decide('return');
