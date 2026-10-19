export function agendaFilesUI({form,user,api,esc}){
 const section=document.createElement('section');section.setAttribute('aria-label','Lampiran agenda');
 section.innerHTML='<h3>Lampiran undangan / TOR</h3><p class="muted">PDF, JPEG, PNG, atau WebP, maksimal 5 MB per berkas. Lampiran hanya dapat diakses pengguna yang berhak melihat agenda.</p><div data-files-list></div><label data-files-upload>Tambah lampiran<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" multiple></label><p data-files-status role="status"></p>';
 form.elements.results.closest('label').before(section);
 const list=section.querySelector('[data-files-list]'),input=section.querySelector('input'),upload=section.querySelector('[data-files-upload]'),status=section.querySelector('[data-files-status]');
 let agenda=null,generation=0,busy=false;
 const canManage=()=>agenda&&!agenda.deleted&&(user.taskDirector||agenda.creator===user.id);
 async function refresh(id,token){
  const r=await api('/api/agendas/'+id+'/files');if(token!==generation)return;
  list.innerHTML=r.files.length?r.files.map(file=>'<div class="agenda-file"><a href="/api/agendas/'+encodeURIComponent(id)+'/files/'+encodeURIComponent(file.id)+'">'+esc(file.filename)+'</a> <small>'+Math.ceil(file.size/1024)+' KB · '+esc(file.actorName)+'</small> '+(canManage()?'<button type="button" class="secondary" data-file-remove="'+esc(file.id)+'" aria-label="Hapus '+esc(file.filename)+'">Hapus lampiran</button>':'')+'</div>').join(''):'<p class="muted">Belum ada lampiran.</p>';
 }
 async function show(a){agenda=a;const token=++generation;input.value='';input.disabled=busy;upload.hidden=!canManage();status.textContent='';list.textContent=a?'Memuat lampiran…':'Simpan agenda terlebih dahulu, lalu buka detailnya untuk menambahkan lampiran.';if(a)try{await refresh(a.id,token);}catch(e){if(token===generation)list.textContent='Lampiran belum dapat dimuat: '+e.message;}}
 input.onchange=async()=>{
  if(!canManage()||busy)return;const files=[...input.files],id=agenda.id,token=generation;if(!files.length)return;
  busy=true;input.disabled=true;let completed=0;
  try{for(const file of files){if(file.size>5*1024*1024)throw Error(file.name+': ukuran maksimal 5 MB.');status.textContent='Mengunggah '+file.name+'…';const response=await fetch('/api/agendas/'+id+'/files',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type||'application/octet-stream','X-Filename':encodeURIComponent(file.name)},body:file});const r=await response.json();if(!response.ok)throw Error(r.error||'Unggah gagal.');completed++;}
   if(token===generation)status.textContent=completed+' lampiran tersimpan.';
  }catch(e){if(token===generation)status.textContent=(completed?completed+' lampiran sudah tersimpan. ':'')+e.message;}
  finally{busy=false;input.disabled=false;input.value='';if(token===generation)try{await refresh(id,token);}catch(e){status.textContent+=' Daftar belum diperbarui: '+e.message;}}
 };
 list.onclick=async e=>{const button=e.target.closest('[data-file-remove]');if(!button||!canManage()||busy)return;if(!confirm('Hapus lampiran ini dari agenda?'))return;const id=agenda.id,token=generation;busy=true;button.disabled=true;input.disabled=true;try{await api('/api/agendas/'+id+'/files/'+button.dataset.fileRemove,'DELETE',{});if(token===generation){await refresh(id,token);status.textContent='Lampiran dihapus.';}}catch(error){if(token===generation)status.textContent=error.message;}finally{busy=false;button.disabled=false;input.disabled=false;}};
 return {show};
}
