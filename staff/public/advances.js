const $=s=>document.querySelector(s),api='/finance/advances/api';
let me,rows=[],current=null,busy=false,dirty=false;
const labels={draft:'Draf UM',returned:'UM dikembalikan',submitted:'Pemeriksaan Keuangan',checked:'Persetujuan Direktur',approved:'Siap dicairkan',disbursed:'Menunggu PJUM',pjum_draft:'Draf PJUM',pjum_returned:'PJUM dikembalikan',pjum_submitted:'Pemeriksaan PJUM',pjum_checked:'Persetujuan PJUM',settlement:'Penyelesaian selisih',closed:'Selesai',cancelled:'Dibatalkan'};
const money=n=>n===null?'Belum tersedia':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
const date=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
function el(tag,text,attrs={}){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;Object.assign(e,attrs);return e;}
function notice(s){$('#notice').textContent=s;}
async function request(path='',method='GET',data){const response=await fetch(api+path,{method,headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});const out=await response.json();if(!response.ok)throw Error(out.error||'Permintaan belum dapat diproses.');return out;}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);notice('');try{await fn();}catch(e){notice(e.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);if(current)permissions();}}
function own(){return current?.creator===me.id;}
function editable(){return !current||own()&&['draft','returned'].includes(current.status);}
function reportEditable(){return current&&own()&&['disbursed','pjum_draft','pjum_returned'].includes(current.status);}
function list(){const term=$('#search').value.toLowerCase(),status=$('#filter').value;$('#requests').replaceChildren();for(const row of rows.filter(r=>(!$('#overview-project').value||r.payload.project_id===$('#overview-project').value)&&(!status||r.status===status)&&[r.number,r.payload.activity,r.payload.project,r.creator_name].join(' ').toLowerCase().includes(term))){const b=el('button',row.payload.activity,{className:'record'+(current?.id===row.id?' active':'')});b.append(el('small',row.number+' · '+row.creator_name),el('small',labels[row.status]+' · '+money(row.total)));b.onclick=()=>run(async()=>{if(dirty&&!confirm('Ada perubahan yang belum disimpan. Buka pengajuan lain?'))return;current=await request('/'+row.id);dirty=false;render();});$('#requests').append(b);}if(!$('#requests').children.length)$('#requests').append(el('p','Belum ada pengajuan sesuai filter.'));const active=rows.filter(r=>!['closed','cancelled'].includes(r.status));$('#summary').replaceChildren();for(const [name,value] of [['Pengajuan aktif',active.length],['Menunggu pemeriksaan',rows.filter(r=>['submitted','pjum_submitted'].includes(r.status)).length],['Menunggu persetujuan',rows.filter(r=>['checked','pjum_checked'].includes(r.status)).length],['UM aktif',money(active.reduce((n,r)=>n+r.total,0))]]){const a=el('article',name);a.append(el('strong',value));$('#summary').append(a);}}
function addItem(target,row={},report=false){const tr=el('tr');tr.append(el('td'));const fields=report?['receipt_no','date','description','quantity','unit','times','days','rate']:['activity_code','description','quantity','unit','times','days','rate'];for(const key of fields){const td=el('td'),numeric=['quantity','days','times','rate'].includes(key),input=el('input',undefined,{type:key==='date'?'date':numeric?'number':'text',required:!['activity_code'].includes(key),value:row[key]??(key==='activity_code'?$('#activity-choice').value:undefined)??({date:date(),quantity:1,times:1,days:1,rate:0,unit:'unit'}[key]||'')});input.dataset.key=key;input.setAttribute('aria-label',key+' '+(document.querySelector(target).children.length+1));if(numeric){input.min=key==='rate'&&report?'0':key==='quantity'?'0.01':'1';input.step=key==='quantity'?'0.01':'1';}else if(key!=='date')input.maxLength=key==='description'?500:60;input.oninput=()=>{dirty=true;totals();};td.append(input);if(report&&key==='description'){const recipient=el('input',undefined,{value:row.recipient||'',placeholder:'Nama penerima',required:true,maxLength:240});recipient.dataset.key='recipient';recipient.oninput=()=>dirty=true;td.append(recipient);const activity=el('input',undefined,{type:'hidden',value:row.activity_code||''});activity.dataset.key='activity_code';td.append(activity);}if(report&&key==='receipt_no'){const select=el('select',undefined,{'aria-label':'Berkas bukti'});select.dataset.key='file_id';select.append(el('option','Pilih bukti',{value:''}),...(current?.files||[]).filter(receiptFile).map(f=>el('option',f.filename,{value:f.id})));select.value=row.file_id||'';select.onchange=()=>dirty=true;const page=el('input',undefined,{type:'number',min:'1',max:'100',step:'1',value:row.page||'',placeholder:'Halaman',required:true});page.dataset.key='page';page.oninput=()=>dirty=true;td.append(select,page);}tr.append(td);}tr.append(el('td','',{className:'subtotal'}));const td=el('td'),remove=el('button','×',{type:'button',className:'quiet',title:'Hapus baris'});remove.onclick=()=>{tr.remove();dirty=true;totals();};td.append(remove);tr.append(td);$(target).append(tr);totals();}
function items(target){return [...$(target).children].map(tr=>Object.fromEntries([...tr.querySelectorAll('input,select')].map(i=>[i.dataset.key,['quantity','days','times','rate','page'].includes(i.dataset.key)?Number(i.value):i.value])));}
function totals(){for(const [target,out] of [['#um-items','#um-total'],['#pjum-items','#pjum-total']]){let sum=0;[...$(target).children].forEach((tr,i)=>{tr.firstChild.textContent=i+1;const vals=Object.fromEntries([...tr.querySelectorAll('input,select')].map(x=>[x.dataset.key,x.value]));const n=Math.round(Number(vals.quantity)*Number(vals.days)*Number(vals.times||1)*Number(vals.rate));tr.querySelector('.subtotal').textContent=money(n);sum+=n||0;});$(out).textContent=money(sum);if(target==='#pjum-items'&&current){const diff=current.total-sum;$('#difference').textContent=diff>0?'Sisa UM yang harus dikembalikan: '+money(diff):diff<0?'Kekurangan pembayaran: '+money(-diff):'Realisasi sama dengan UM yang dicairkan.';}}}
function render(){
 $('#empty').hidden=true;$('#detail').hidden=false;const data=current?.payload||{project:'',activity:'',location:'',start:date(),end:date(),notes:'',items:[{}]};
 $('#number').textContent=current?.number||'NOMOR OTOMATIS SETELAH DRAF DISIMPAN';$('#title').textContent=current?.payload.activity||'Pengajuan UM baru';$('#identity').textContent=(current?.creator_name||me.name)+' · '+(current?.creator_email||me.email);$('#status').textContent=labels[current?.status||'draft'];$('#review-note').hidden=!current?.note;$('#review-note').textContent=current?.note||'';
 $('#steps').textContent='Draf UM → Pemeriksaan Riena → Persetujuan Direktur → Pencairan → PJUM → Pemeriksaan & persetujuan → Penyelesaian';
 for(const name of ['project_id','project','activity','location','start','end','notes','bank','account','account_name'])$('#um-form').elements[name].value=current?.legacy_id&&['start','end'].includes(name)?'':data[name]||'';$('#um-items').replaceChildren();for(const row of data.items)addItem('#um-items',row);
 $('#pjum-items').replaceChildren();for(const row of current?.report?.items||[])addItem('#pjum-items',row,true);$('#pjum-form').elements.notes.value=current?.report?.notes||'';$('#pjum-form').elements.report_number.value=current?.report?.report_number||'';$('#pjum-form').elements.report_date.value=current?.report?.report_date||date();renderChecks();$('#evidence-reviewed').checked=false;
 $('#files').replaceChildren();for(const file of current?.files||[]){const d=el('div',undefined,{className:'file-row'}),a=el('a',file.filename,{href:api+'/'+current.id+'/files/'+file.id,target:'_blank',rel:'noopener'});d.append(a,el('small',({um:'Pengajuan UM',pjum:'Bukti PJUM',payment:'Bukti pencairan',settlement:'Bukti penyelesaian'}[file.purpose])+' · '+file.actor_email));$('#files').append(d);}if(!current?.files?.length)$('#files').append(el('p','Belum ada lampiran.'));
 $('#events').replaceChildren();const eventNames={created:'Draf dibuat',updated:'Draf diperbarui',submit:'UM diajukan',check:'UM diperiksa',approve:'UM disetujui',return:'UM dikembalikan',disburse:'Pencairan dicatat',report:'Draf PJUM disimpan',report_submit:'PJUM diajukan',report_check:'PJUM diperiksa',report_approve:'PJUM disetujui',report_return:'PJUM dikembalikan',settle:'Selisih diselesaikan',cancel:'Pengajuan dibatalkan',file_added:'Lampiran ditambahkan'};
 for(const event of current?.events||[]){const p=el('div',eventNames[event.action]||event.action,{className:'event'});p.append(el('small',event.actor_email+' · '+new Date(event.created_at).toLocaleString('id-ID')));if(event.snapshot.note)p.append(el('p',event.snapshot.note));$('#events').append(p);}
 $('#payment-date').value=date();$('#payment-reference').value='';$('#action-note').value='';$('#upload').value='';$('#settlement-amount').value=current?Math.abs(current.total-(current.actual??current.total)):0;totals();permissions();list();
}
function permissions(){
 const edit=editable(),rep=reportEditable(),s=current?.status,manager=me.finance||me.director;$('#um-form').querySelectorAll('input,textarea,button').forEach(e=>e.disabled=!edit);$('#save').hidden=!edit;$('#add-um').hidden=!edit;
 $('#pjum-section').hidden=!current||!['disbursed','pjum_draft','pjum_returned','pjum_submitted','pjum_checked','settlement','closed'].includes(s);$('#pjum-form').querySelectorAll('input,textarea,button,select').forEach(e=>e.disabled=!rep);$('#save-pjum').hidden=!rep;$('#excel-import-box').hidden=!rep;$('#scan-receipts').hidden=!(rep||me.finance&&s==='pjum_submitted');$('#evidence-review-label').hidden=!(me.finance&&s==='pjum_submitted');$('#add-pjum').hidden=!rep;
 const purposes=[];if(current&&edit)purposes.push(['um','Document UM']);if(rep)purposes.push(['pjum','Bukti PJUM']);if(me.finance&&s==='approved')purposes.push(['payment','Bukti pencairan']);if(me.finance&&s==='settlement')purposes.push(['settlement','Bukti penyelesaian']);$('#purpose').replaceChildren(...purposes.map(([v,t])=>el('option',t,{value:v})));$('#upload-box').hidden=!purposes.length;
 $('#review').hidden=!(manager&&['submitted','checked','pjum_submitted','pjum_checked'].includes(s));$('#payment').hidden=!(me.finance&&['approved','settlement'].includes(s));$('#payment-title').textContent=s==='settlement'?(current.total>current.actual?'Catat pengembalian sisa UM':'Catat pelunasan kekurangan'):'Catat pencairan '+money(current?.total);$('#settlement-amount-label').hidden=s!=='settlement';
 $('#actions').replaceChildren();const add=(action,label)=>{const b=el('button',label);b.onclick=()=>run(()=>act(action));$('#actions').append(b);};
 if(current&&own()){if(['draft','returned'].includes(s)){add('submit','Ajukan UM');add('cancel','Batalkan draf');}if(s==='pjum_draft')add('report_submit','Kirim PJUM untuk diperiksa');}
 if(me.finance){if(s==='submitted'){add('check','Selesai diperiksa');add('return','Kembalikan UM');}if(s==='approved')add('disburse','Simpan pencairan');if(s==='pjum_submitted'){add('report_check','PJUM selesai diperiksa');add('report_return','Kembalikan PJUM');}if(s==='settlement')add('settle','Simpan penyelesaian');}
 if(me.director){if(s==='checked'){add('approve','Setujui UM');add('return','Kembalikan UM');}if(s==='pjum_checked'){add('report_approve','Setujui PJUM');add('report_return','Kembalikan PJUM');}}
 $('#print').hidden=!current;$('#excel').hidden=!current||!!current.legacy_id;if(current)$('#excel').href=api+'/'+current.id+'/excel';
 $('#um-form').querySelectorAll('select').forEach(e=>e.disabled=!edit);
}
async function reload(){rows=await request();list();}
async function saveUm(){if(!$('#um-form').reportValidity())return;const form=$('#um-form'),data=Object.fromEntries(['project_id','project','activity','location','start','end','notes','bank','account','account_name'].map(k=>[k,form.elements[k].value]));data.items=items('#um-items');current=await request(current?'/'+current.id:'',current?'PUT':'POST',{...data,...(current?{version:current.version}:{})});dirty=false;await reload();render();notice('Draf UM tersimpan.');}
async function act(action){if(dirty)throw Error('Simpan perubahan draf sebelum melanjutkan.');const data={version:current.version,note:$('#action-note').value,evidence_reviewed:$('#evidence-reviewed').checked};if(['return','report_return'].includes(action)&&!data.note.trim())throw Error('Isi catatan perbaikan terlebih dahulu.');if(['disburse','settle'].includes(action)){data.date=$('#payment-date').value;data.reference=$('#payment-reference').value;if(action==='settle')data.amount=Number($('#settlement-amount').value);}if(action==='cancel'&&!confirm('Batalkan draf UM ini? Arsip tetap disimpan.'))return;if(['approve','report_approve'].includes(action)&&!confirm('Setujui '+(action==='approve'?'UM '+money(current.total):'PJUM '+money(current.actual))+' ini?'))return;current=await request('/'+current.id+'/'+action,'POST',data);dirty=false;await reload();render();notice('Status pengajuan diperbarui.');}
$('#new').onclick=()=>run(async()=>{if(dirty&&!confirm('Ada draf belum disimpan. Buat pengajuan baru?'))return;current=null;dirty=false;render();});$('#refresh').onclick=()=>run(async()=>{if(dirty&&!confirm('Muat ulang dan abaikan perubahan belum disimpan?'))return;await reload();if(current){current=await request('/'+current.id);dirty=false;render();}});$('#search').oninput=list;$('#filter').onchange=list;
$('#add-um').onclick=()=>{addItem('#um-items');dirty=true;};$('#add-pjum').onclick=()=>{addItem('#pjum-items',{},true);dirty=true;};$('#um-form').onsubmit=e=>{e.preventDefault();run(saveUm);};$('#um-form').addEventListener('input',()=>dirty=true);$('#pjum-form').addEventListener('input',e=>{if(e.target.type!=='file')dirty=true;});
$('#pjum-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!$('#pjum-form').reportValidity())return;current=await request('/'+current.id+'/report','POST',{version:current.version,items:items('#pjum-items'),report_date:$('#pjum-form').elements.report_date.value,report_number:$('#pjum-form').elements.report_number.value,notes:$('#pjum-form').elements.notes.value});dirty=false;await reload();render();notice('Draf PJUM tersimpan.');});};
$('#upload').onchange=()=>run(async()=>{const file=$('#upload').files[0];if(!file)return;if(dirty)throw Error('Simpan draf sebelum mengunggah lampiran.');if(file.size>5*1024*1024)throw Error('Berkas maksimal 5 MB.');const response=await fetch(api+'/'+current.id+'/files?'+new URLSearchParams({purpose:$('#purpose').value,name:file.name,version:current.version}),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});const out=await response.json();if(!response.ok)throw Error(out.error||'Unggah belum berhasil.');current=out;render();notice('Dokumen tersimpan.');});
$('#print').onclick=()=>{if(dirty){notice('Simpan draf sebelum mencetak.');return;}window.print();};window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
run(async()=>{me=await request('/me');$('#account').textContent=me.name;$('#dashboard').hidden=!me.dashboard;$('#payroll').hidden=!me.payroll;await reload();await setupProjects();$('#legacy-panel').hidden=!(me.director||me.finance);$('#new').disabled=false;}).catch(e=>notice(e.message));

let projects=[],activeBudget=null;
function projectLink(p){const a=$('#project-detail');a.hidden=!p?.url;if(p?.url)a.href=p.url;}
async function setupProjects(){
 projects=await request('/projects');
 for(const id of ['#project-choice','#overview-project'])$(id).replaceChildren(el('option','Pilih proyek',{value:''}),...projects.map(p=>el('option',p.name+(p.closed?' · ditutup':''),{value:p.id,disabled:id==='#project-choice'&&p.closed})));
 const params=new URLSearchParams(location.search),id=params.get('project');
 if(projects.some(p=>p.id===id)){$('#overview-project').value=id;await loadOverview();if(params.get('activity'))await chooseActivity(id,params.get('activity'));}
}
async function loadBudget(){
 const id=$('#project-choice').value;if(!id){activeBudget=null;$('#budget-info').textContent='';return;}
 activeBudget=await request('/project?'+new URLSearchParams({id,exclude:current?.id||''}));
 $('#um-form').elements.project.value=activeBudget.name;projectLink(activeBudget);
 $('#activity-choice').replaceChildren(el('option','Pilih kegiatan',{value:''}),...activeBudget.activities.filter(a=>!a.management).map(a=>el('option',a.code+' · '+a.name+' · sisa '+money(a.remaining),{value:a.code,disabled:activeBudget.closed||(a.remaining!==null&&a.remaining<=0)})));
 $('#budget-info').textContent=activeBudget.unconfigured||activeBudget.missingBudget?'RAB lengkap belum tersedia. Daftar kegiatan mengikuti arsip terdahulu; isi kode untuk kegiatan baru dan lampirkan dasar anggarannya. Pengajuan akan diperiksa Bagian Keuangan.':'Pilih kode kegiatan. Sisa pagu memperhitungkan komitmen lama serta pengajuan baru yang sudah dikirim.';
}
async function loadOverview(){
 const id=$('#overview-project').value,out=$('#activity-overview');out.replaceChildren();list();if(!id)return;
 const data=await request('/project?'+new URLSearchParams({id}));
 if(data.closed)out.append(el('p','Proyek sudah ditutup; pengajuan UM baru tidak tersedia.'));if(data.missingBudget||data.unconfigured)out.append(el('p','RAB lengkap belum tersedia. Pagu dan sisa yang belum diajukan belum dapat ditentukan; kegiatan baru perlu dasar anggaran untuk diperiksa.'));if(data.unconfigured)return;
 const table=el('table'),head=el('tr');for(const label of ['Kegiatan','Pagu','UM / realisasi terdahulu','Draf baru','Sedang diproses','Sudah dicairkan','Sisa belum diajukan',''])head.append(el('th',label));table.append(head);
 for(const a of data.activities){const tr=el('tr');tr.append(el('th',a.code+' · '+a.name));for(const value of [a.budget,a.legacyCommitted,a.draft,a.pending,a.disbursed,a.remaining])tr.append(el('td',money(value)));
 const td=el('td');if(!data.closed&&!a.management&&(a.remaining===null||a.remaining>0)){const b=el('button','Ajukan UM',{type:'button',className:'secondary'});b.onclick=()=>run(()=>chooseActivity(id,a.code));td.append(b);}else td.textContent=a.management?'Pengajuan gaji':'Pagu terkomitmen';tr.append(td);table.append(tr);}
 const scroll=el('div',undefined,{className:'scroll'});scroll.append(table);out.append(scroll);
}
async function chooseActivity(project,code){
 if(dirty&&!confirm('Buka draf baru dan abaikan perubahan yang belum disimpan?'))return;
 current=null;dirty=false;render();$('#project-choice').value=project;await loadBudget();$('#activity-choice').value=code;fillActivity();$('#um-form').scrollIntoView({behavior:'smooth',block:'start'});
}
function fillActivity(){
 const code=$('#activity-choice').value,a=activeBudget?.activities.find(x=>x.code===code);if(!a)return;
 const f=$('#um-form'),codes=[...$('#um-items').querySelectorAll('[data-key="activity_code"]')];const empty=codes.find(input=>!input.value);if(empty)empty.value=code;else if(!codes.some(input=>input.value===code))addItem('#um-items',{activity_code:code});
 const selected=[...new Set([...$('#um-items').querySelectorAll('[data-key="activity_code"]')].map(input=>input.value).filter(Boolean))];
 f.elements.activity.value=selected.map(key=>key+' · '+(activeBudget.activities.find(x=>x.code===key)?.name||key)).join('; ').slice(0,240);
 $('#budget-info').textContent='Pagu '+money(a.budget)+' · Terdahulu '+money(a.legacyCommitted)+' · Sedang diproses '+money(a.pending)+' · Sudah dicairkan '+money(a.disbursed)+' · Sisa '+money(a.remaining);dirty=true;
}
$('#project-choice').onchange=()=>run(loadBudget);$('#activity-choice').onchange=fillActivity;$('#overview-project').onchange=()=>run(loadOverview);
$('#excel').onclick=e=>{if(dirty){e.preventDefault();notice('Simpan perubahan draf sebelum mengunduh Excel.');}};

function receiptFile(f){return f.purpose==='pjum'&&['application/pdf','image/jpeg','image/png'].includes(f.mime);}
function renderChecks(){
 const out=$('#receipt-checks');out.replaceChildren();const checks=current?.checks;if(!checks){out.append(el('p','Simpan rincian PJUM untuk melihat kelengkapan bukti.'));return;}
 out.append(el('p',checks.rows.length+' rincian; '+checks.matched+' cocok otomatis; '+checks.rows.filter(r=>r.issues.length).length+' belum lengkap.'));
 for(const r of checks.rows){const line=el('details'),summary=el('summary','Kuitansi '+r.receipt_no+' — '+r.status);line.append(summary);for(const issue of [...r.issues,...r.warnings])line.append(el('p',issue));const item=current.report.items[r.index],file=current.files.find(f=>f.id===item.file_id);if(file){const a=el('a','Buka '+file.filename+' · halaman '+item.page,{href:api+'/'+current.id+'/files/'+file.id+'#page='+item.page,target:'_blank',rel:'noopener'});line.append(a);}if(r.result&&!r.result.error)line.append(el('p','Terbaca: '+[r.result.receipt_no,r.result.recipient,r.result.date,money(r.result.amount),r.result.description].filter(Boolean).join(' · ')));out.append(line);}
 if(checks.unused.length)out.append(el('p',checks.unused.length+' halaman bukti belum ditautkan ke rincian.'));
}
async function sendFile(file,purpose='pjum'){
 if(file.size>5*1024*1024)throw Error('Berkas maksimal 5 MB.');
 const response=await fetch(api+'/'+current.id+'/files?'+new URLSearchParams({purpose,name:file.name,version:current.version}),{method:'POST',body:file});const out=await response.json();if(!response.ok)throw Error(out.error||'Unggah belum berhasil.');current=out;
}
$('#import-pjum').onchange=()=>run(async()=>{
 const file=$('#import-pjum').files[0];if(!file)return;if(dirty)throw Error('Simpan perubahan sebelum mengimpor Excel.');
 if(file.size>5*1024*1024)throw Error('Excel maksimal 5 MB.');
 const response=await fetch(api+'/'+current.id+'/import_excel?version='+current.version,{method:'POST',body:file}),parsed=await response.json();if(!response.ok)throw Error(parsed.error||'Excel belum dapat dibaca.');
 if(current.report?.items.length&&!confirm('Ganti rincian draf dengan isi Excel ini?'))return;
 await sendFile(file);render();const proofs=current.files.filter(receiptFile),only=proofs.length===1?proofs[0].id:'';
 $('#pjum-items').replaceChildren();for(const item of parsed.items)addItem('#pjum-items',{...item,file_id:only},true);$('#pjum-form').elements.report_number.value=parsed.report_number;dirty=true;permissions();notice(parsed.items.length+' rincian diimpor, total '+money(parsed.total)+'. Periksa halaman bukti, isi tanggal laporan, lalu simpan draf.');
});
$('#scan-receipts').onclick=()=>run(async()=>{
 if(dirty)throw Error('Simpan rincian PJUM sebelum memeriksa kuitansi.');
 const mapped=current.report?.items||[];if(!mapped.length)throw Error('Isi dan simpan rincian PJUM terlebih dahulu.');
 $('#pjum-form').querySelectorAll('input,textarea,select').forEach(e=>e.disabled=true);const pages=[...new Map(mapped.filter(i=>i.file_id&&i.page).map(i=>[i.file_id+':'+i.page,i])).values()];
 if(!pages.length)throw Error('Tautkan bukti dan halaman pada rincian.');
 for(let i=0;i<pages.length;i+=3){
  const batch=pages.slice(i,i+3);$('#scan-progress').textContent='Membaca bukti '+(i+1)+'–'+Math.min(i+3,pages.length)+' dari '+pages.length+'. Tetap buka halaman ini.';
  current=await request('/'+current.id+'/scan','POST',{version:current.version,pages:batch.map(item=>({file_id:item.file_id,page:item.page}))});renderChecks();
 }
 $('#scan-progress').textContent='Pemeriksaan otomatis selesai. Baca catatan setiap kuitansi sebelum mengirim.';await reload();render();
});
let selectedLegacy=null;
$('#load-legacy').onclick=()=>run(async()=>{
 const records=await request('/legacy'),out=$('#legacy-list');out.replaceChildren();
 for(const r of records){const b=el('button',r.number+' · '+r.title+' · '+money(r.amount),{className:'record',type:'button'});b.onclick=()=>run(async()=>{
  if(dirty&&!confirm('Abaikan perubahan draf yang belum disimpan?'))return;
  if(r.linked){current=await request('/'+r.linked.id);dirty=false;render();return;}
  selectedLegacy=r;const f=$('#legacy-form');f.hidden=false;$('#legacy-title').textContent=r.title;f.elements.paid_date.value=r.paid_date;f.elements.reference.value=r.reference;f.elements.confirmed.checked=false;f.elements.owner_email.value=/riena/i.test(r.applicant)?'rienaprasiddha@yayasangambut.org':/zamhar|ariel/i.test(r.applicant)?'zamharier@yayasangambut.org':'mulyadi@yayasangambut.org';
 });out.append(b);}if(!records.length)out.append(el('p','UM arsip belum tersedia.'));
});
$('#legacy-form').onsubmit=e=>{e.preventDefault();run(async()=>{const f=e.target;if(!f.reportValidity())return;current=await request('/legacy','POST',{id:selectedLegacy.id,owner_email:f.elements.owner_email.value,paid_date:f.elements.paid_date.value,reference:f.elements.reference.value,confirm_existing_payment:f.elements.confirmed.checked});dirty=false;f.hidden=true;await reload();render();notice('UM lama terhubung. Unggah PDF kuitansi dan impor Excel PJUM.');});};
