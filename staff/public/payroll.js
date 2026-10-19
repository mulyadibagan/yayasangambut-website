const $=s=>document.querySelector(s),form=$('#payroll-form'),base='/finance/payroll/api';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const money=n=>n===null?'Perlu rekonsiliasi':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);

const labels={draft:'Draf',submitted:'Diajukan',returned:'Dikembalikan',approved:'Disetujui'};

const month=p=>new Date(p+'-01T12:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});

const date=s=>new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB';

let user,current=null,requests=[],busy=false,dirty=false,paymentDirty=false,previewMode=false,defaults=null,paymentToken=crypto.randomUUID(),bankData=null;

const paymentForm=$('#payment-form'),localToday=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}),staffId=i=>i.staff_id||'staff:'+i.name.trim().toLowerCase().replace(/\s+/g,'-');

const editable=()=>!previewMode&&(user?.operator||user?.director)&&(!current||['draft','returned'].includes(current.status)&&(user.operator||current.creator_email===user.email));

async function api(path='',method='GET',data){const r=await fetch(base+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error||'Permintaan gagal.');return result;}

function notice(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}

function lock(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);form.querySelectorAll('input,textarea').forEach(i=>i.disabled=value||!editable());paymentForm.querySelectorAll('input,textarea,select').forEach(i=>i.disabled=value||!user?.operator||current?.status!=='approved');$('#director-note').disabled=value||!user?.director||current?.status!=='submitted';}

async function run(fn){if(busy)return;lock(true);notice('');try{await fn();}catch(e){notice(e.message,true);}finally{lock(false);}}

function badge(status){return '<span class="badge" data-status="'+status+'">'+labels[status]+'</span>';}

function list(){ $('#requests').innerHTML=requests.length?requests.map(r=>'<button type="button" class="request" data-id="'+r.id+'" aria-current="'+(current?.id===r.id)+'"><strong>'+month(r.period)+'</strong><small>'+money(r.total)+'</small>'+badge(r.status)+'</button>').join(''):'<p class="muted">Belum ada pengajuan gaji.</p>'; }

async function loadList(){const data=await api();user=data.user;requests=data.requests;$('#account').textContent=user.name+' · '+(user.director?'Direktur':'Finance');$('#finance-home').hidden=!user.director;$('#new-request').hidden=!(user.operator||user.director);$('#new-request').textContent='＋ Pengajuan baru';$('#preview-request').hidden=!(user.operator||user.director);$('#empty').textContent=requests.length?'Pilih pengajuan untuk melihat rincian.':'Menunggu pengajuan dari Finance. Anda dapat melihat form melalui tombol di atas.';list();}

function row(item={name:'',program:'',bank:'',account:'',base:0,allowance:0,deduction:0}){

 const el=document.createElement('article');el.className='recipient';const disabled=editable()?'':' disabled';

 const field=(key,label,type='text')=>'<label>'+label+'<input data-key="'+key+'" type="'+type+'" value="'+esc(item[key]??'')+'"'+disabled+(type==='number'?' min="0" max="10000000000" step="1" required':(key==='name'||key==='program'||key==='description'?' required':'')+' maxlength="'+({name:160,program:200,bank:80,account:80,budget_code:80,description:600,account_name:160,remarks:500}[key])+'"')+'></label>';

 el.innerHTML='<div class="recipient-heading"><strong class="recipient-number"></strong><button type="button" class="quiet" data-remove'+(editable()?'':' hidden')+'>Hapus baris</button></div><div class="recipient-grid">'+field('name','Nama penerima')+field('budget_code','Kode anggaran')+field('description','Rincian keperluan')+field('program','Sumber alokasi')+field('account_name','Nama penerima transfer')+field('bank','Bank')+field('account','Nomor rekening')+field('remarks','Keterangan tambahan')+'</div><div class="amounts">'+field('base','Nominal gaji (Rp)','number')+field('allowance','Tambahan (Rp)','number')+field('deduction','Potongan (Rp)','number')+'</div><div class="net"><span>Jumlah diminta</span><strong data-net></strong></div>'+(item.allocation_snapshot?'<p class="muted">Posisi alokasi saat disiapkan: '+money(item.allocation_snapshot.position)+' · per '+esc(item.allocation_snapshot.asOf)+'</p>':'');

 $('#items').append(el);calculate();

}

function values(){return [...$('#items').children].map(el=>Object.fromEntries([...el.querySelectorAll('[data-key]')].map(i=>[i.dataset.key,i.type==='number'?(i.value===''?NaN:Number(i.value)):i.value])));}

function calculate(){let total=0;values().forEach((r,i)=>{const el=$('#items').children[i],net=r.base+r.allowance-r.deduction;el.querySelector('.recipient-number').textContent='Penerima '+(i+1);el.querySelector('[data-net]').textContent=Number.isFinite(net)?money(net):'—';total+=net;});$('#total').textContent=Number.isFinite(total)?money(total):'—';}

function render(r){

 current=r;if(r)previewMode=false;dirty=false;paymentDirty=false;$('#empty').hidden=true;form.hidden=false;const edit=editable(),preview=!r&&previewMode;

 $('#detail-title').textContent=r?'Gaji '+month(r.period):'Pengajuan baru';$('#status').textContent=labels[r?.status||'draft'];$('#status').dataset.status=r?.status||'draft';$('#request-meta').textContent=r?'Dibuat oleh '+r.creator_email+' · '+date(r.created_at):'Draf dapat diperiksa dan dilengkapi sebelum diajukan.';

 if(preview){$('#detail-title').textContent='Form pengajuan gaji';$('#status').textContent='Pratinjau';$('#request-meta').textContent='Ini formulir yang digunakan Finance. Tampilan ini tidak membuat pengajuan atau mengubah data. Gunakan Pengajuan baru untuk membuat draf. Pratinjau ini menampilkan form Finance.';}

 form.elements.period.value=r?.period||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}).slice(0,7);form.elements.notes.value=r?.notes||'';form.elements.period.disabled=!edit;form.elements.notes.disabled=!edit;

 const meta=r?.form_meta||defaults?.form_meta||{};for(const key of ['number','applicant','title','purpose','place','adjustment_note'])form.elements[key].value=meta[key]||'';form.elements.request_date.value=meta.date||r?.created_at?.slice(0,10)||localToday();if(!r&&defaults?.period)form.elements.period.value=defaults.period;

 $('#allocation-source').textContent=meta.allocation_as_of?'Nominal diisi dari kebijakan staf aktif. Alokasi sistem per '+meta.allocation_as_of+'. Periksa rekening dan rincian sebelum diajukan.':'Data pengajuan lama. Gunakan Isi dari alokasi gaji untuk mengambil sumber terbaru saat menyunting.';$('#fill-allocation').hidden=!edit;

 $('#items').innerHTML='';(r?.items||defaults?.items||[{}]).forEach(v=>row(Object.keys(v).length?v:undefined));$('#add-row').hidden=!edit;
 $('#items').hidden=preview;$('#preview-recipients').hidden=!preview;if(preview)$('#preview-recipients').innerHTML='<table class="report-table"><thead><tr><th>Nama penerima</th><th>Rekening tujuan</th><th>Gaji bulanan</th></tr></thead><tbody>'+(defaults?.items||[]).map(i=>'<tr><th>'+esc(i.name)+'</th><td>'+esc(i.bank)+'<br>'+esc(i.account)+'<br><small>a.n. '+esc(i.account_name)+'</small></td><td>'+money(i.net)+'</td></tr>').join('')+'</tbody></table>';

 $('#review-note').hidden=!r?.review_note;$('#review-note').textContent=r?.review_note?'Catatan Direktur: '+r.review_note:'';

 $('#save').hidden=!edit;$('#submit').hidden=!edit||!r;$('#upload-label').hidden=!edit||!r;$('#upload-hint').textContent=!r?'Simpan draf terlebih dahulu untuk menambahkan dokumen.':edit?'Lampiran tersimpan secara privat dan hanya dapat dibuka oleh Finance yang ditunjuk serta Direktur.':'Lampiran dikunci bersama pengajuan.';

 if(preview)$('#upload-hint').textContent='Finance dapat melampirkan dokumen setelah menyimpan draf.';

 $('#files').innerHTML=r?.files?.some(f=>f.purpose!=='payment')?r.files.filter(f=>f.purpose!=='payment').map(f=>'<div class="file"><a href="'+base+'/'+r.id+'/files/'+f.id+'">'+esc(f.filename)+'</a><small>'+Math.ceil(f.size/1024)+' KB · '+esc(f.actor_email)+'</small></div>').join(''):'<p class="muted">Belum ada dokumen pendukung.</p>';

 const review=user.director&&r?.status==='submitted';$('#review-controls').hidden=!review;$('#approve').hidden=!review;$('#return').hidden=!review;$('#director-note').value='';$('#print').hidden=!r&&!preview;$('#print').textContent=r?'Cetak':'Pratinjau cetak';

 const actions={created:'Draf dibuat',updated:'Draf diperbarui',attached:'Dokumen dilampirkan',submitted:'Diajukan kepada Direktur',returned:'Dikembalikan untuk diperbaiki',approved:'Disetujui Direktur',paid:'Pembayaran dicatat'};

 $('#events').innerHTML=(r?.events||[]).map(e=>'<div class="event"><strong>'+actions[e.action]+(e.snapshot.self_approved?' (pengajuan sendiri)':'')+'</strong><br><small>'+esc(e.actor_email)+' · '+date(e.created_at)+' · Versi '+e.version+'</small>'+(e.snapshot.review_note?'<p>'+esc(e.snapshot.review_note)+'</p>':'')+'</div>').join('');$('#history').hidden=!r;renderPayments();list();lock(busy);

}

async function newForm(period=localToday().slice(0,7),preview=false){previewMode=preview;defaults={...await api('/defaults?period='+encodeURIComponent(period)),period};if(user.director&&!preview){defaults.form_meta.applicant='Mulyadi, S.P.';defaults.form_meta.title='Direktur';}render(null);if(defaults.warnings?.length)notice(defaults.warnings.join(' '));}

async function save(){if(!editable())return false;const form_meta=Object.fromEntries(['number','applicant','title','purpose','place','adjustment_note'].map(k=>[k,form.elements[k].value]));form_meta.date=form.elements.request_date.value;const payload={period:form.elements.period.value,notes:form.elements.notes.value,form_meta,items:values(),...(current?{version:current.version}:{})};const result=await api(current?'/'+current.id:'',current?'PUT':'POST',payload);render(result);await loadList();return true;}

form.addEventListener('input',e=>{if(e.target.id==='director-note'||e.target.id==='file')return;dirty=true;calculate();});

form.onsubmit=e=>{e.preventDefault();run(async()=>{if(await save())notice('Draf gaji tersimpan.');});};

$('#add-row').onclick=()=>{if($('#items').children.length>=100)return notice('Maksimal 100 penerima.',true);row();dirty=true;};

$('#items').onclick=e=>{const b=e.target.closest('[data-remove]');if(!b||!editable())return;if($('#items').children.length===1)return notice('Minimal satu penerima gaji.',true);b.closest('.recipient').remove();dirty=true;calculate();};

$('#preview-request').onclick=()=>{if((dirty||paymentDirty)&&!confirm('Tinggalkan perubahan yang belum disimpan?'))return;run(()=>newForm(localToday().slice(0,7),true));};
$('#new-request').onclick=()=>{if((dirty||paymentDirty)&&!confirm('Tinggalkan perubahan yang belum disimpan?'))return;run(()=>newForm());};

$('#fill-allocation').onclick=()=>{if(!confirm('Isi ulang rincian dari kebijakan gaji dan alokasi saat ini? Perubahan draf tetap perlu disimpan.'))return;run(async()=>{const data=await api('/defaults?period='+form.elements.period.value);$('#items').innerHTML='';data.items.forEach(row);form.elements.purpose.value=data.form_meta.purpose;$('#allocation-source').textContent='Diisi dari alokasi sistem per '+data.sourceAsOf;dirty=true;notice('Rincian diisi otomatis. Periksa lalu simpan draf.');});};

form.elements.period.onchange=()=>{if(!current)form.elements.purpose.value='Pembayaran Gaji Pengurus YG '+month(form.elements.period.value);};

$('#requests').onclick=e=>{const b=e.target.closest('[data-id]');if(!b)return;if((dirty||paymentDirty)&&!confirm('Tinggalkan perubahan yang belum disimpan?'))return;run(async()=>render(await api('/'+b.dataset.id)));};

$('#refresh').onclick=()=>{if((dirty||paymentDirty)&&!confirm('Muat ulang dan tinggalkan perubahan yang belum disimpan?'))return;run(async()=>{await loadList();if(current)render(await api('/'+current.id));else if(!form.hidden)render(null);notice('Daftar pengajuan diperbarui.');});};

$('#submit').onclick=()=>run(async()=>{if(dirty){notice('Simpan perubahan draf sebelum mengajukan.',true);return;}if(!confirm('Ajukan gaji '+month(current.period)+' sebesar '+money(current.total)+' kepada Direktur? Rincian akan dikunci sampai dikembalikan.'))return;render(await api('/'+current.id+'/submit','POST',{version:current.version}));await loadList();notice('Pengajuan sudah masuk ke daftar tinjauan Direktur.');});

for(const action of ['approve','return'])$('#'+action).onclick=()=>run(async()=>{const note=$('#director-note').value.trim();if(action==='return'&&!note)return notice('Isi catatan perbaikan terlebih dahulu.',true);if(!confirm(action==='approve'?(current.creator_email===user.email?'Setujui pengajuan yang Anda buat sendiri? Tindakan ini akan ditandai di riwayat. ':'Setujui pengajuan? ')+'Gaji '+month(current.period)+' sebesar '+money(current.total):'Kembalikan pengajuan ini kepada Finance?'))return;render(await api('/'+current.id+'/'+action,'POST',{version:current.version,note}));await loadList();notice(action==='approve'?'Pengajuan disetujui. Belum ada pencatatan pembayaran otomatis.':'Pengajuan dikembalikan beserta catatan perbaikan.');});

$('#file').onchange=()=>{const file=$('#file').files[0];if(!file)return;run(async()=>{try{if(dirty)throw Error('Simpan perubahan draf sebelum menambahkan dokumen.');if(file.size>5*1024*1024)throw Error('Ukuran maksimal 5 MB.');notice('Mengunggah dokumen…');const r=await fetch(base+'/'+current.id+'/files',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Filename':encodeURIComponent(file.name),'X-Payroll-Version':String(current.version)},body:file});const result=await r.json();if(!r.ok)throw Error(result.error);render(result);notice('Dokumen pendukung tersimpan.');}finally{$('#file').value='';}});};

$('#print').onclick=()=>{if(dirty)return notice('Simpan perubahan sebelum mencetak.',true);window.open(current?'/finance/payroll/print/'+current.id:'/finance/payroll/print-preview?period='+encodeURIComponent(form.elements.period.value),'_blank','noopener');};

window.addEventListener('beforeunload',e=>{if(dirty||paymentDirty){e.preventDefault();e.returnValue='';}});

function renderPayments(){

 const r=current;$('#payments').hidden=!r||r.status!=='approved';paymentForm.hidden=!r||r.status!=='approved'||!user.operator||r.remaining===0;paymentToken=crypto.randomUUID();

 if(!r||r.status!=='approved')return;

 $('#payment-summary').textContent=(r.payment_status==='paid'?'Lunas':r.payment_status==='partial'?'Dibayar sebagian':'Belum dibayar')+' · Dibayar '+money(r.paid||0)+' · Sisa '+money(r.remaining??r.total);

 $('#payment-list').innerHTML=(r.payments||[]).map(p=>'<article class="file"><strong>'+esc(p.paid_date)+' · '+money(p.amount)+'</strong><p>Ref. '+esc(p.reference)+'</p>'+p.allocations.map(a=>esc(a.name)+': '+money(a.amount)).join('<br>')+'<p>'+p.proof_ids.map(fid=>'<a href="'+base+'/'+r.id+'/files/'+fid+'">Bukti transfer</a>').join(' · ')+'</p></article>').join('');

 paymentForm.reset();paymentForm.elements.paid_date.value=localToday();paymentForm.elements.source_account.value=bankData?.account||defaults?.bankAccount||'';

 $('#payment-allocations').innerHTML=r.items.map(i=>{const id=staffId(i),paid=(r.payments||[]).flatMap(p=>p.allocations).filter(a=>a.staff_id===id).reduce((s,a)=>s+a.amount,0),left=i.net-paid;return '<label>'+esc(i.name)+' · Sisa '+money(left)+'<input data-payment-staff="'+esc(id)+'" type="number" min="0" max="'+left+'" step="1" value="0"></label>';}).join('');

 const used=new Set((r.payments||[]).flatMap(p=>p.proof_ids));$('#payment-proofs').innerHTML=(r.files||[]).filter(f=>f.purpose==='payment').map(f=>'<label class="proof-choice"><input type="checkbox" value="'+f.id+'"'+(!used.has(f.id)?' checked':'')+'><span>'+esc(f.filename)+(used.has(f.id)?' (sudah pernah ditautkan)':'')+'</span></label>').join('')||'<p class="muted">Unggah bukti transfer sebelum menyimpan pembayaran.</p>';paymentSum();

}

function paymentSum(){const total=[...$('#payment-allocations').querySelectorAll('input')].reduce((s,i)=>s+Number(i.value||0),0);$('#payment-total').textContent=money(total);return total;}

paymentForm.oninput=()=>{paymentDirty=true;paymentSum();};

async function loadBank(){bankData=await api('/bank');paymentForm.elements.source_account.value=bankData.account;paymentForm.elements.bank_entry_id.innerHTML='<option value="">Transfer belum masuk register mutasi</option>'+bankData.entries.map(e=>'<option value="'+e.id+'">'+esc(e.date)+' · '+money(e.amount)+' · '+esc(e.reference)+' · '+esc(e.description)+'</option>').join('');}

$('#load-bank').onclick=()=>run(async()=>{await loadBank();notice('Mutasi dimuat sampai '+bankData.asOf+'. Pilih hanya jika sesuai bukti transfer.');});

paymentForm.elements.bank_entry_id.onchange=()=>{const entry=bankData?.entries.find(e=>e.id===paymentForm.elements.bank_entry_id.value);if(entry){paymentForm.elements.reference.value=entry.reference;paymentForm.elements.paid_date.value=entry.date;paymentDirty=true;}};

$('#payment-file').onchange=()=>{const file=$('#payment-file').files[0];if(!file)return;run(async()=>{try{

 if(file.size>5*1024*1024)throw Error('Ukuran maksimal 5 MB.');const saved=Object.fromEntries(['paid_date','source_account','reference','notes','bank_entry_id'].map(k=>[k,paymentForm.elements[k].value])),amounts=[...$('#payment-allocations').querySelectorAll('input')].map(i=>i.value);

 const r=await fetch(base+'/'+current.id+'/files',{method:'POST',headers:{'Content-Type':file.type,'X-Filename':encodeURIComponent(file.name),'X-Payroll-Version':String(current.version),'X-File-Purpose':'payment'},body:file});const data=await r.json();if(!r.ok)throw Error(data.error);render(data);for(const [k,v] of Object.entries(saved))paymentForm.elements[k].value=v;[...$('#payment-allocations').querySelectorAll('input')].forEach((i,n)=>i.value=amounts[n]||0);paymentSum();paymentDirty=true;notice('Bukti transfer tersimpan. Lengkapi rincian lalu simpan pembayaran.');

 }finally{$('#payment-file').value='';}});};

paymentForm.onsubmit=e=>{e.preventDefault();const amount=paymentSum();if(amount<=0)return notice('Isi nominal pembayaran pada penerima yang ditransfer.',true);if(!confirm('Catat pembayaran '+money(amount)+' sesuai bukti transfer?'))return;const data={id:paymentToken,version:current.version,...Object.fromEntries(['paid_date','source_account','reference','notes','bank_entry_id'].map(k=>[k,paymentForm.elements[k].value])),allocations:[...$('#payment-allocations').querySelectorAll('input')].filter(i=>Number(i.value)>0).map(i=>({staff_id:i.dataset.paymentStaff,amount:Number(i.value)})),proof_ids:[...$('#payment-proofs').querySelectorAll('input:checked')].map(i=>i.value)};run(async()=>{render(await api('/'+current.id+'/payments','POST',data));notice('Pembayaran dan bukti transfer tercatat di laporan pembayaran gaji.');});};

run(async()=>{await loadList();try{await loadBank();}catch(e){notice(e.message,true);}const requested=new URLSearchParams(location.search).get('id');if(requested&&requests.some(r=>r.id===requested))render(await api('/'+requested));else if(requests.length)render(await api('/'+requests[0].id));else if(user.operator||user.director)await newForm(localToday().slice(0,7),user.director);});
