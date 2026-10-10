const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let user,posts=[],media=[],current=null,cover='',dirty=false,view='overview',picker='body',range=null,busy=false;
const labels={draft:'Draf',review:'Menunggu tinjauan',publishing:'Sedang diterbitkan',published:'Terbit'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editor=()=>user&&['editor','admin'].includes(user.role);
const date=s=>new Date(s).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'});
function notice(message,error=false){$('#notice').hidden=false;$('#notice').textContent=message;$('#notice').classList.toggle('error',error);}
async function api(path,method='GET',data){
 const response=await fetch(path,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});
 let result;try{result=await response.json();}catch{throw new Error('Layanan belum tersedia. Coba kembali nanti.');}
 if(!response.ok){if(response.status===401){$('#app').hidden=true;$('#login').hidden=false;$('#google-login').hidden=false;}throw new Error(result.error||'Permintaan belum berhasil.');}return result;
}
function handle(fn){return async(...args)=>{try{await fn(...args);}catch(e){notice(e.message,true);}};}
async function lock(fn){if(busy)return;busy=true;$$('.editor-actions button').forEach(b=>b.disabled=true);try{await fn();}finally{busy=false;setEditorState();}}
async function show(next){
 if(view==='editor'&&dirty&&next!=='editor'&&!confirm('Ada perubahan yang belum disimpan. Tinggalkan tulisan?'))return;
 dirty=false;view=next;$$('.view').forEach(e=>e.hidden=e.id!==next);$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
 $('#view-title').textContent={overview:'Ringkasan',posts:'Tulisan',editor:current?'Sunting tulisan':'Tulisan baru',media:'Media',analytics:'Statistik',users:'Pengguna'}[next];$('#notice').hidden=true;
 if(next==='overview'||next==='posts')await loadPosts();if(next==='media')await loadMedia();if(next==='analytics')await loadStats();if(next==='users')await loadUsers();
}
function postRows(list){if(!list.length)return '<div class="empty">Belum ada tulisan di sini.<br>Mulai dari tombol “Tulisan baru”.</div>';return list.map(p=>`<button class="post-row" data-post="${esc(p.id)}"><span><strong>${esc(p.title)}</strong><small>${p.language==='en'?'English':'Indonesia'} · ${date(p.updated_at)} · ${p.deleted_at?'Buka Sampah':p.status==='publishing'?'Periksa proses':'Perbaiki tulisan'}</small></span><span class="badge ${p.status}">${p.deleted_at?'Sampah':p.status==='publishing'&&p.publish_action==='trash'?'Sedang ditarik':labels[p.status]}</span></button>`).join('');}
function bindPostRows(root){root.querySelectorAll('[data-post]').forEach(b=>b.onclick=handle(()=>openPost(b.dataset.post)));}
async function loadPosts(){posts=await api('/api/posts');$('#counts').innerHTML=['draft','review','publishing','published'].map(s=>`<div class="stat"><span>${labels[s]}</span><b>${posts.filter(p=>!p.deleted_at&&p.status===s).length}</b></div>`).join('');$('#recent-posts').innerHTML=postRows(posts.filter(p=>!p.deleted_at).slice(0,5));bindPostRows($('#recent-posts'));filterPosts();}
function filterPosts(){const search=$('#post-search').value.toLowerCase(),status=$('#post-filter').value;$('#all-posts').innerHTML=postRows(posts.filter(p=>(status==='trash'?!!p.deleted_at:!p.deleted_at&&(!status||p.status===status))&&p.title.toLowerCase().includes(search)));bindPostRows($('#all-posts'));}
function values(){return {title:$('#post-title').value,body:$('#post-body').innerHTML,language:$('#post-language').value,author:$('#post-author').value,category:$('#post-category').value,summary:$('#post-summary').value,cover,image_alt:$('#post-alt').value,image_credit:$('#post-credit').value,...(current?{version:current.version}:{})};}
function setCover(url){cover=url;$('#cover-preview').hidden=!url;$('#remove-cover').hidden=!url;if(url)$('#cover-preview').src=url;else $('#cover-preview').removeAttribute('src');}
function countWords(){$('#word-count').textContent=($('#post-body').innerText.trim().match(/\S+/g)||[]).length+' kata';}
function markDirty(){dirty=true;$('#save-state').textContent='Perubahan belum disimpan';countWords();}
function setEditorState(){
 const readonly=busy||(current&&(current.status==='publishing'||current.deleted_at));
 $$('#editor input,#editor textarea,#editor select').forEach(e=>e.disabled=!!readonly);$('#post-language').disabled=!!current;
 $('#post-body').contentEditable=String(!readonly);$$('.toolbar button,#choose-cover,#remove-cover').forEach(b=>b.disabled=!!readonly);
 $$('.editor-actions button').forEach(b=>b.disabled=false);$('#save-post').disabled=!!readonly;$('#submit-post').disabled=!!readonly;
 $('#publish-post').hidden=false;$('#publish-post').disabled=!!readonly;$('#submit-post').hidden=editor();
 $('#publish-post').textContent=$('#post-language').value==='id'?'Terbitkan Indonesia & English':current?.published_at?'Terbitkan perbaikan':'Terbitkan';
 $('#trash-post').hidden=!current||!!current.deleted_at;$('#trash-post').disabled=!!readonly;$('#restore-post').hidden=!current?.deleted_at;$('#check-post').hidden=current?.status!=='publishing';
 $('#return-post').hidden=!(editor()&&current?.status==='review');
 $('#review-note').hidden=!current?.review_note;$('#review-note').textContent=current?.review_note||'';
 $('#live-post').hidden=!current?.published_at||!!current?.deleted_at;if(current?.published_at)$('#live-post').href='https://yayasangambut.org/'+current.language+'/'+(current.language==='id'?'cerita':'field-stories')+'/'+current.slug+'/';
}
async function openPost(id){if(dirty&&!confirm('Tinggalkan perubahan yang belum disimpan?'))return;current=id?await api('/api/posts/'+id):null;dirty=false;await show('editor');
 const p=current||{};$('#post-title').value=p.title||'';$('#post-body').innerHTML=p.body||'';$('#post-author').value=p.author||user.name;$('#post-language').value=p.language||'id';$('#post-summary').value=p.summary||'';$('#post-category').value=p.category||'Cerita lapangan';$('#post-alt').value=p.image_alt||'';$('#post-credit').value=p.image_credit||'';setCover(p.cover||'');setEditorState();countWords();$('#save-state').textContent=p.id?(p.deleted_at?'Sampah':labels[p.status])+' · '+date(p.updated_at):'Draf baru';if(p.publish_error)notice(p.publish_error,true);
 if(p.status==='publishing')notice(p.publish_action==='trash'?'Artikel sedang ditarik dari website. Klik Periksa status untuk melihat hasilnya.':'Penerbitan sedang diproses. Klik Periksa status untuk melihat hasilnya.');
 if(p.deleted_at)notice('Tulisan berada di Sampah. Pulihkan untuk menyunting dan menerbitkannya kembali.');
}
async function save(){const data=values();current=await api('/api/posts'+(current?'/'+current.id:''),current?'PUT':'POST',data);dirty=false;$('#post-body').innerHTML=current.body;$('#save-state').textContent='Draf tersimpan · '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'});setEditorState();return current;}
async function submit(){await lock(async()=>{await save();await api('/api/posts/'+current.id+'/submit','POST',{version:current.version});await openPost(current.id);notice('Tulisan sudah diajukan kepada editor.');});}
async function publish(){if(!confirm($('#post-language').value==='id'?'Terbitkan tulisan Indonesia beserta terjemahan Inggris otomatis? Foto dalam tulisan juga akan menjadi publik.':'Terbitkan tulisan ini ke website publik Yayasan Gambut? Foto dalam tulisan juga akan menjadi publik.'))return;await lock(async()=>{if(dirty||!current)await save();notice(current.language==='id'?'Menyiapkan terjemahan Inggris dan penerbitan kedua versi. Mohon tunggu…':'Menyiapkan penerbitan…');const r=await api('/api/posts/'+current.id+'/publish','POST',{version:current.version});await openPost(current.id);notice(r.message);});}
async function trashPost(){
 const message=current.published_at?'Tarik artikel ini beserta versi bahasa pasangannya dari website dan pindahkan ke Sampah? Tulisan dapat dipulihkan. Foto tidak dihapus.':'Pindahkan tulisan ini ke Sampah? Tulisan dapat dipulihkan.';
 if(!confirm(message+(dirty?' Perubahan yang belum disimpan tidak ikut disimpan.':'')))return;
 await lock(async()=>{const r=await api('/api/posts/'+current.id+'/trash','POST',{version:current.version});dirty=false;await show('posts');notice(r.message);});
}
async function restorePost(){await lock(async()=>{await api('/api/posts/'+current.id+'/restore','POST',{version:current.version});await openPost(current.id);notice('Tulisan dipulihkan sebagai draf. Klik Terbitkan untuk menampilkannya kembali di website.');});}
async function loadMedia(){media=await api('/api/media');renderMedia($('#media-grid'),false);}
function renderMedia(root,pick){root.innerHTML=media.length?media.map(m=>`<button class="media-card" data-media="${esc(m.id)}"><img src="${esc(m.url)}" alt="${esc(m.filename)}" loading="lazy"><span>${esc(m.filename)}<small>${m.public?'Publik':'Privat'} · ${Math.ceil(m.size/1024)} KB</small></span></button>`).join(''):'<div class="empty">Belum ada foto. Unggah dokumentasi pertama Anda.</div>';root.querySelectorAll('[data-media]').forEach(b=>b.onclick=()=>{const m=media.find(x=>x.id===b.dataset.media);if(!pick){notice('Foto: '+m.filename+' · '+(m.public?'Publik':'Privat'));return;}if(picker==='cover')setCover(m.url);else{const body=$('#post-body');body.focus();const sel=getSelection();if(range){sel.removeAllRanges();sel.addRange(range);}const img=document.createElement('img');img.src=m.url;img.alt=m.filename;const r=sel.rangeCount?sel.getRangeAt(0):null;if(r&&body.contains(r.commonAncestorContainer)){r.deleteContents();r.insertNode(img);}else body.append(img);}$('#media-dialog').close();markDirty();});}
async function chooseMedia(kind){picker=kind;if(kind==='body'){const s=getSelection();range=s.rangeCount?s.getRangeAt(0).cloneRange():null;}await loadMedia();renderMedia($('#picker-grid'),true);$('#media-dialog').showModal();}
async function photoBlob(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Pilih foto JPEG, PNG, atau WebP.');if(file.size>20*1024*1024)throw new Error('Foto sumber terlalu besar. Gunakan foto di bawah 20 MB.');
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.83));if(!blob||blob.size>2097152)throw new Error('Foto masih lebih dari 2 MB setelah diperkecil. Pilih ukuran lebih kecil.');return blob;
}
async function upload(file){if(!file)return;notice('Mengunggah foto…');const blob=await photoBlob(file);const response=await fetch('/api/media',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'image/webp','X-Filename':encodeURIComponent(file.name.replace(/\.[^.]+$/,'.webp'))},body:blob});const r=await response.json();if(!response.ok)throw new Error(r.error);await loadMedia();if($('#media-dialog').open)renderMedia($('#picker-grid'),true);notice('Foto berhasil diunggah.');}
async function preview(){
 const tab=window.open('','_blank');if(!tab)throw new Error('Izinkan tab baru untuk membuka pratinjau website.');tab.opener=null;
 tab.document.title='Memuat pratinjau…';tab.document.body.textContent='Memuat pratinjau website…';
 const button=$('#preview');button.disabled=true;
 try{const result=await api('/api/preview?view=website','POST',values());tab.document.open();tab.document.write(result.html);tab.document.close();}
 catch(e){tab.close();throw e;}finally{button.disabled=false;}
}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Belum ada data untuk periode ini.</td></tr>'}</tbody></table></div>`;}
let statsRequest=0;
async function loadStats(){const requestId=++statsRequest;$('#stats-description').textContent='Google Analytics · '+($('#stats-site').value==='webgis'?'WebGIS YG':'Website YG')+' · hingga kemarin';const root=$('#analytics-content');root.innerHTML='<div class="empty">Memuat statistik…</div>';try{const r=await api('/api/analytics?days='+$('#stats-range').value+'&site='+$('#stats-site').value);if(requestId!==statsRequest)return;if(!r.configured){root.innerHTML='<div class="empty">'+esc(r.message)+'</div>';return;}const totals=r.totals.rows?.[0]?.metricValues?.map(x=>Number(x.value))||[0,0,0,0];root.innerHTML='<div class="stats-grid">'+['Pengunjung aktif','Sesi','Tampilan halaman','Tingkat interaksi'].map((name,i)=>`<div class="stat"><span>${name}</span><b>${i===3?(totals[i]*100).toFixed(1)+'%':totals[i].toLocaleString('id-ID')}</b></div>`).join('')+'</div><h2>Tren pengunjung</h2>';

 const dailyRows=r.daily.rows||[];
 if(!dailyRows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Belum ada data pengunjung harian untuk periode ini.';root.append(empty);}
 else{
 const counts=new Map(dailyRows.map(row=>[row.dimensionValues[0].value,Number(row.metricValues[0].value)]));
 const today=new Date(new Date().toLocaleDateString('sv-SE',{timeZone:r.timezone||'Asia/Jakarta'})+'T00:00:00Z');
 const points=Array.from({length:Number(r.days)||28},(_,i)=>{const date=new Date(today);date.setUTCDate(date.getUTCDate()-(Number(r.days)||28)+i);const key=date.toISOString().slice(0,10).replaceAll('-','');return{date,count:counts.get(key)||0};});
 const peak=Math.max(1,...points.map(p=>p.count)),step=Math.max(1,Math.ceil(peak/4)),top=step*4;
 const chart=document.createElement('section');chart.className='daily-chart';chart.setAttribute('aria-label','Grafik pengunjung aktif per hari');
 const unit=document.createElement('p');unit.className='muted';unit.textContent='Pengunjung aktif · pilih batang untuk melihat rincian';chart.append(unit);
 const frame=document.createElement('div');frame.className='daily-frame';
 const axis=document.createElement('div');axis.className='daily-axis';axis.setAttribute('aria-hidden','true');for(let i=4;i>=0;i--){const tick=document.createElement('span');tick.textContent=(i*step).toLocaleString('id-ID');axis.append(tick);}frame.append(axis);
 const scroll=document.createElement('div');scroll.className='daily-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Geser untuk melihat seluruh tanggal');
 const plot=document.createElement('div');plot.className='daily-plot';plot.style.minWidth=points.length*38+'px';
 const detail=document.createElement('p');detail.className='daily-detail';detail.setAttribute('aria-live','polite');
 const fullDate=date=>date.toLocaleDateString('id-ID',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const buttons=[];
 const select=index=>{buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));detail.textContent=fullDate(points[index].date)+' — '+points[index].count.toLocaleString('id-ID')+' pengunjung aktif';};
 points.forEach((point,index)=>{const button=document.createElement('button');button.type='button';button.className='daily-bar';button.title=fullDate(point.date)+': '+point.count.toLocaleString('id-ID')+' pengunjung aktif';button.setAttribute('aria-label',button.title);
 const fill=document.createElement('span');fill.className='daily-fill';fill.style.height=Math.max(point.count?2:0,point.count/top*100)+'%';
 const value=document.createElement('span');value.className='daily-value';value.textContent=point.count.toLocaleString('id-ID');fill.append(value);
 const date=document.createElement('span');date.className='daily-date';date.textContent=point.date.toLocaleDateString('id-ID',{timeZone:'UTC',day:'numeric',month:'short'});
 button.append(fill,date);button.addEventListener('click',()=>select(index));buttons.push(button);plot.append(button);});
 scroll.append(plot);frame.append(scroll);chart.append(frame,detail);root.append(chart);select(points.length-1);
 }

 const tables=document.createElement('div');tables.className='analytics-tables';tables.innerHTML='<div><h2>Halaman populer</h2>'+table(['Halaman','Tampilan'],(r.pages.rows||[]).map(d=>[d.dimensionValues[0].value,d.metricValues[0].value]))+'</div><div><h2>Sumber kunjungan</h2>'+table(['Saluran','Sesi'],(r.sources.rows||[]).map(d=>[d.dimensionValues[0].value,d.metricValues[0].value]))+'</div>';root.append(tables);
 const geography=document.createElement('div');geography.className='analytics-tables';
 const unknownLocation=value=>!value||['(not set)','unknown','tidak teridentifikasi'].includes(value.trim().toLowerCase());
 const location=value=>unknownLocation(value)?'Tidak teridentifikasi':value;
 const geoTable=(report,headers,dimensionCount,limit)=>{
   if(report?.unavailable)return '<div class="empty">Data lokasi belum dapat dibaca. Coba muat ulang statistik.</div>';
   if(!report?.rows?.length)return '<div class="empty">Belum ada data lokasi untuk periode ini.</div>';
   const isUnknown=row=>[0,dimensionCount-1].some(index=>unknownLocation(row.dimensionValues[index]?.value));
   const rows=[...report.rows].sort((a,b)=>Number(isUnknown(a))-Number(isUnknown(b))).map(row=>[...row.dimensionValues.slice(0,dimensionCount).map(d=>location(d.value)),...row.metricValues.map(m=>Number(m.value).toLocaleString('id-ID'))]);
   let note=Number(report.rowCount)>limit?'Menampilkan '+limit+' lokasi dengan pengunjung aktif terbanyak.':'';
   if(report.metadata?.subjectToThresholding)note+=(note?' ':'')+'Sebagian rincian dapat dibatasi oleh Google Analytics karena ambang privasi.';
   return table(headers,rows)+(note?'<p class="muted">'+esc(note)+'</p>':'');
 };
 geography.innerHTML='<section><h2>Negara pengunjung</h2>'+geoTable(r.countries,['Negara','Pengunjung aktif','Sesi'],1,20)+'</section><section><h2>Kota pengunjung</h2>'+geoTable(r.cities,['Kota','Wilayah','Negara','Pengunjung aktif','Sesi'],3,50)+'</section>';
 root.append(geography);
 const note=document.createElement('p');note.className='muted';note.textContent='Data hingga kemarin. Lokasi merupakan perkiraan Google Analytics; lokasi yang tidak tersedia ditampilkan sebagai “Tidak teridentifikasi”.';root.append(note);

 }catch(e){if(requestId===statsRequest)root.innerHTML='<div class="empty">'+esc(e.message)+'</div>';}}
async function loadUsers(){const list=await api('/api/users');$('#user-list').innerHTML='<div class="table-wrap"><table><thead><tr><th>Nama / email</th><th>Peran</th><th>Akses</th><th></th></tr></thead><tbody>'+list.map(u=>`<tr data-user="${esc(u.id)}"><td>${esc(u.name)}<br><small>${esc(u.email)}</small></td><td>${u.role==='admin'?'Administrator':`<select aria-label="Peran ${esc(u.name)}"><option value="staff" ${u.role==='staff'?'selected':''}>Staf</option><option value="editor" ${u.role==='editor'?'selected':''}>Editor</option></select>`}</td><td>${u.disabled?'Dinonaktifkan':'Aktif'}</td><td>${u.role==='admin'?'':`<button class="secondary" data-save-user>Simpan peran</button> <button class="text-button" data-toggle-user>${u.disabled?'Aktifkan':'Nonaktifkan'}</button>`}</td></tr>`).join('')+'</tbody></table></div>';
 $('#user-list').querySelectorAll('[data-user]').forEach(row=>{const u=list.find(x=>x.id===row.dataset.user);row.querySelector('[data-save-user]')?.addEventListener('click',handle(async()=>{if(!confirm('Ubah peran '+u.email+'?'))return;await api('/api/users','PATCH',{id:u.id,role:row.querySelector('select').value,disabled:!!u.disabled});await loadUsers();notice('Peran pengguna diperbarui.');}));row.querySelector('[data-toggle-user]')?.addEventListener('click',handle(async()=>{if(!confirm((u.disabled?'Aktifkan':'Nonaktifkan')+' akses '+u.email+'?'))return;await api('/api/users','PATCH',{id:u.id,role:u.role,disabled:!u.disabled});await loadUsers();notice('Akses pengguna diperbarui.');}));});}
async function init(){
 const entry=new URLSearchParams(location.search);if(entry.get('view')==='analytics'){sessionStorage.setItem('yg-stats-view','analytics');sessionStorage.setItem('yg-stats-site',entry.get('site')==='webgis'?'webgis':'website');}
 $('#today').textContent=new Date().toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long',year:'numeric'});
 const config=await api('/api/config');if(!config.ready){$('#login-status').textContent='Ruang Staf sedang disiapkan. Login akan tersedia setelah aktivasi selesai.';return;}
 $('#google-login').hidden=false;$('#login-status').textContent='';try{user=await api('/api/me');}catch{return;}
 $('#login').hidden=true;$('#app').hidden=false;$('#user-name').textContent=user.name;$('#user-role').textContent={staff:'Staf',editor:'Editor',admin:'Administrator'}[user.role];$('#avatar').textContent=user.name.split(' ').slice(0,2).map(x=>x[0]).join('');$('#greeting').textContent='Selamat datang, '+user.name.split(' ')[0]+'.';$$('[data-editor]').forEach(e=>e.hidden=!editor());$$('[data-admin]').forEach(e=>e.hidden=user.role!=='admin');const params=new URLSearchParams(location.search);if(params.get('site')==='webgis'||sessionStorage.getItem('yg-stats-site')==='webgis')$('#stats-site').value='webgis';await show(params.get('view')==='analytics'||sessionStorage.getItem('yg-stats-view')==='analytics'?'analytics':'overview');sessionStorage.removeItem('yg-stats-view');sessionStorage.removeItem('yg-stats-site');
}
$$('[data-view]').forEach(b=>b.onclick=handle(()=>show(b.dataset.view)));$('#new-post').onclick=$('#start-writing').onclick=handle(()=>openPost());$('#back-posts').onclick=handle(()=>show('posts'));$('#refresh-posts').onclick=handle(loadPosts);$('#post-search').oninput=filterPosts;$('#post-filter').onchange=filterPosts;
$('#trash-post').onclick=handle(trashPost);$('#restore-post').onclick=handle(restorePost);$('#check-post').onclick=handle(()=>openPost(current.id));
$('#save-post').onclick=handle(()=>lock(async()=>{await save();notice('Draf berhasil disimpan.');}));$('#submit-post').onclick=handle(submit);$('#publish-post').onclick=handle(publish);$('#preview').onclick=handle(preview);$('#close-preview').onclick=()=>$('#preview-dialog').close();
$('#return-post').onclick=handle(async()=>{const note=prompt('Catatan perbaikan untuk penulis:');if(note===null)return;if(dirty)await save();await api('/api/posts/'+current.id+'/return','POST',{version:current.version,note});await openPost(current.id);notice('Tulisan dikembalikan kepada penulis.');});
$$('#editor input,#editor textarea,#editor select').forEach(e=>e.addEventListener('input',markDirty));$('#post-language').addEventListener('change',setEditorState);$('#post-body').oninput=markDirty;$('#post-body').onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));markDirty();};$('#post-body').ondrop=e=>e.preventDefault();
$$('[data-command]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{$('#post-body').focus();document.execCommand(b.dataset.command,false,b.dataset.value||null);markDirty();};});
$('#insert-link').onmousedown=e=>e.preventDefault();$('#insert-link').onclick=()=>{const url=prompt('Alamat tautan (https://…):');if(!url)return;try{if(!['https:','mailto:'].includes(new URL(url).protocol))throw Error();document.execCommand('createLink',false,url);markDirty();}catch{notice('Gunakan tautan HTTPS atau email yang valid.',true);}};
$('#insert-photo').onclick=handle(()=>chooseMedia('body'));$('#choose-cover').onclick=handle(()=>chooseMedia('cover'));$('#remove-cover').onclick=()=>{setCover('');markDirty();};$('#close-media').onclick=()=>$('#media-dialog').close();$('#upload-media').onclick=$('#upload-dialog').onclick=()=>$('#file-upload').click();$('#file-upload').onchange=handle(async e=>{await upload(e.target.files[0]);e.target.value='';});$('#stats-range').onchange=handle(loadStats);$('#stats-site').onchange=handle(loadStats);
$('#logout').onclick=handle(async()=>{if(dirty&&!confirm('Keluar tanpa menyimpan perubahan?'))return;await api('/api/logout','POST',{});location.reload();});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
init().catch(e=>{$('#login-status').textContent='Layanan login belum tersedia. Silakan coba kembali nanti.';});
