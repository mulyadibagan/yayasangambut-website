export function teamSizesUI({api,esc,handle,notice}){
 const root=document.querySelector('#team-sizes');let records=[];
 async function load(){
  records=await api('/api/team-sizes');
  root.innerHTML=`<div class="section-heading"><h2>Ukuran kaos tim</h2><button class="secondary" id="reload-sizes">Muat ulang</button></div><p>Database internal untuk Mulyadi dan Riena. Ukuran dapat diperbarui sesuai konfirmasi anggota tim.</p><form id="size-form"><div class="form-grid"><label>Nama tim<input name="name" required maxlength="160"></label><label>Ukuran kaos<select name="size">${['XS','S','M','L','XL','XXL','3XL','4XL','5XL'].map(s=>`<option${s==='L'?' selected':''}>${s}</option>`).join('')}</select></label></div><p><button class="primary" type="submit">Simpan ukuran</button> <button class="secondary" type="button" id="cancel-size" hidden>Batal sunting</button></p></form><div style="overflow-x:auto"><table><thead><tr><th>Nama</th><th>Ukuran kaos</th><th></th></tr></thead><tbody>${records.map(r=>`<tr><td>${esc(r.name)}</td><td><strong>${esc(r.size)}</strong></td><td><button class="secondary" data-size-id="${esc(r.id)}" aria-label="Sunting ukuran ${esc(r.name)}">Sunting</button></td></tr>`).join('')}</tbody></table></div>${records.length?'':'<p>Belum ada ukuran kaos yang dicatat.</p>'}`;
  const form=root.querySelector('form');let current=null;
  root.querySelector('#reload-sizes').onclick=handle(load);
  root.querySelector('#cancel-size').onclick=()=>{current=null;form.reset();root.querySelector('#cancel-size').hidden=true;};
  root.querySelectorAll('[data-size-id]').forEach(b=>b.onclick=()=>{current=records.find(r=>r.id===b.dataset.sizeId);form.elements.name.value=current.name;form.elements.size.value=current.size;root.querySelector('#cancel-size').hidden=false;form.elements.name.focus();});
  form.onsubmit=handle(async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await api('/api/team-sizes'+(current?'/'+current.id:''),current?'PUT':'POST',{name:form.elements.name.value,size:form.elements.size.value,...(current?{version:current.version}:{})});await load();notice('Ukuran kaos tersimpan.');}finally{button.disabled=false;}});
 }
 return {load};
}
