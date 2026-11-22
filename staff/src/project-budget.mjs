import {fail,now} from './core.mjs';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validDate=s=>/^20\d\d-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function budgetInput(body){
 if(!body||!Number.isInteger(body.version)||body.version<0)fail(400,'Versi anggaran tidak valid.');
 const result={};for(const k of ['contractStart','contractEnd','periodStart','periodEnd']){if(!validDate(body[k]))fail(400,'Lengkapi tanggal kontrak dan periode kegiatan.');result[k]=body[k];}
 if(result.contractEnd<result.contractStart||result.periodEnd<result.periodStart)fail(400,'Tanggal akhir harus setelah tanggal mulai.');
 for(const k of ['proposalUrl','termUrl','contractUrl']){try{const url=new URL(body[k]);if(url.protocol!=='https:'||!['docs.google.com','drive.google.com'].includes(url.hostname))throw Error();result[k]=url.href;}catch{fail(400,'Gunakan tautan dokumen Google Drive.');}}
 const text=String(body.rows||'');if(!text||text.length>60000)fail(400,'Isi tabel anggaran maksimal 60.000 karakter.');
 const codes=new Set();result.activities=text.trim().split(/\r?\n/).map(line=>{
  const [group,code,name,unit,volume,rate,annual,period]=line.split('\t').map(v=>v.trim());
  if(!['JASA','KEGIATAN'].includes(group)||!code||code.length>40||codes.has(code)||!name||name.length>500||!unit||unit.length>30)fail(400,'Periksa kelompok, kode unik, uraian, dan satuan pada tabel.');codes.add(code);
  const parse=s=>{const n=Number(s);if(!Number.isSafeInteger(n)||n<0||n>10000000000)fail(400,'Nominal dan volume harus bilangan bulat positif atau nol.');return n;};
  const annualBudget=parse(annual),periodBudget=parse(period),quantity=parse(volume),unitRate=parse(rate),management=group==='JASA';
  if(management&&(!quantity||!unitRate||quantity*unitRate!==annualBudget||periodBudget!==0))fail(400,'Jumlah jasa harus sesuai volume × tarif; jasa tidak ditambahkan pada termin kegiatan.');
  return {code,name,group,unit,quantity,rate:unitRate,annualBudget,periodBudget,budget:management?annualBudget:periodBudget,management,legacyUm:0,legacyRealized:0,legacyCommitted:0};
 });
 if(result.activities.length>100||!result.activities.some(a=>a.management)||!result.activities.some(a=>!a.management))fail(400,'Isi jasa dan kegiatan, maksimal 100 baris.');
 result.servicesTotal=result.activities.filter(a=>a.management).reduce((n,a)=>n+a.annualBudget,0);
 result.annualActivitiesTotal=result.activities.filter(a=>!a.management).reduce((n,a)=>n+a.annualBudget,0);
 result.periodTotal=result.activities.filter(a=>!a.management).reduce((n,a)=>n+a.periodBudget,0);
 return result;
}
export async function loadBudget(env){
 if(!env.DB?.prepare)return null;
 const row=await env.DB.prepare('SELECT * FROM yg_project_budgets WHERE project_id=?').bind('APRIL').first();
 return row?{...JSON.parse(row.payload),version:row.version,updatedAt:row.updated_at}:null;
}
export async function saveBudget(env,u,body){
 const data=budgetInput(body),at=now(),version=body.version+1;
 const old=await loadBudget(env);if((old?.version||0)!==body.version)fail(409,'Anggaran telah berubah. Muat ulang sebelum menyimpan.');
 if(old?.activityDetails&&old.periodStart===data.periodStart&&old.periodEnd===data.periodEnd)data.activityDetails=old.activityDetails;
 const payload=JSON.stringify(data);
 const update=body.version?env.DB.prepare('UPDATE yg_project_budgets SET version=?,payload=?,updated_by=?,updated_at=? WHERE project_id=? AND version=?').bind(version,payload,u.email,at,'APRIL',body.version):env.DB.prepare('INSERT OR IGNORE INTO yg_project_budgets(project_id,version,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind('APRIL',version,payload,u.email,at);
 const results=await env.DB.batch([update,env.DB.prepare('INSERT INTO yg_project_budget_history(project_id,version,payload,actor,created_at) SELECT project_id,version,payload,updated_by,updated_at FROM yg_project_budgets WHERE project_id=? AND version=? AND updated_at=?').bind('APRIL',version,at)]);
 if(!results[0].meta.changes)fail(409,'Anggaran telah berubah. Muat ulang sebelum menyimpan.');
 return {...data,version,updatedAt:at};
}
export function budgetPage(data,canEdit){
 const h=escape,rows=data?.activities||[],table=group=>`<table><thead><tr><th>No.</th><th>Komponen</th><th>${group==='JASA'?'Volume × tarif':'Pagu proposal 12 bulan'}</th><th>${group==='JASA'?'Jumlah':'Termin Okt–Des 2026'}</th></tr></thead><tbody>${rows.filter(a=>a.group===group).map((a,i)=>`<tr><td>${i+1}</td><th>${h(a.code)} · ${h(a.name)}</th><td>${group==='JASA'?h(a.quantity+' '+a.unit+' × '+money(a.rate)):money(a.annualBudget)}</td><td>${money(group==='JASA'?a.annualBudget:a.periodBudget)}</td></tr>`).join('')}</tbody></table>`;
 const text=rows.map(a=>[a.group,a.code,a.name,a.unit,a.quantity,a.rate,a.annualBudget,a.periodBudget].join('\t')).join('\n');
 return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anggaran APRIL Group · YG Finance</title><link rel="stylesheet" href="/advances.css"><script src="/project-budget.js" defer></script></head><body><header class="topbar"><a href="/finance">YG Finance</a><nav><a href="/finance/advances?project=APRIL">UM & PJUM</a><a href="/finance/payroll">Pengajuan gaji</a></nav></header><main style="max-width:1200px;margin:auto;padding:24px"><p class="eyebrow">YAYASAN GAMBUT · APRIL GROUP</p><h1>Anggaran Program Dayun</h1><p id="notice" role="status"></p>${data?`<p>Periode dalam dokumen kontrak: <b>${h(data.contractStart)} – ${h(data.contractEnd)}</b>. Kegiatan termin: <b>${h(data.periodStart)} – ${h(data.periodEnd)}</b>.</p><section class="panel"><h2>Jasa pendampingan · 12 bulan</h2><h3>${money(data.servicesTotal)}</h3><div class="scroll">${table('JASA')}</div><p>Alokasi jasa program mengikuti volume kerja dan tarif. Gaji bulanan serta pembayaran aktual dicatat terpisah dan tidak otomatis berubah.</p></section><section class="panel"><h2>Kegiatan · termin berjalan</h2><h3>${money(data.periodTotal)}</h3><p>Anggaran kegiatan dalam proposal 12 bulan: ${money(data.annualActivitiesTotal)}. Pagu untuk pengajuan UM mengikuti rincian termin berjalan.</p><div class="scroll">${table('KEGIATAN')}</div><p>Perubahan rincian termin tetap ditampilkan terhadap proposal. Jumlah termin tidak ditambahkan kembali pada anggaran tahunan.</p></section><section class="panel"><h2>Dokumen acuan</h2><p><a href="${h(data.proposalUrl)}" target="_blank" rel="noopener">Proposal program</a> · <a href="${h(data.termUrl)}" target="_blank" rel="noopener">Anggaran kegiatan termin</a> · <a href="${h(data.contractUrl)}" target="_blank" rel="noopener">Perjanjian versi Final</a></p><p>Tanggal mengikuti isi dokumen; nama versi Final belum merupakan verifikasi tanda tangan.</p></section>`:'<p>Anggaran APRIL belum tersedia. Finance atau Direktur dapat memasukkan rincian yang telah diperiksa.</p>'}${canEdit?`<details class="panel" ${data?'':'open'}><summary>Perbarui anggaran</summary><form id="budget-form"><input type="hidden" name="version" value="${data?.version||0}"><div class="grid">${[['contractStart','Mulai kontrak'],['contractEnd','Akhir kontrak'],['periodStart','Mulai periode kegiatan'],['periodEnd','Akhir periode kegiatan']].map(([k,l])=>`<label>${l}<input type="date" name="${k}" value="${h(data?.[k]||'')}" required></label>`).join('')}</div>${[['proposalUrl','Tautan proposal'],['termUrl','Tautan anggaran termin'],['contractUrl','Tautan kontrak']].map(([k,l])=>`<label>${l}<input type="url" name="${k}" value="${h(data?.[k]||'')}" required></label>`).join('')}<label>Tempel tabel anggaran dari Excel<textarea name="rows" rows="12" required>${h(text)}</textarea></label><p>Urutan kolom dipisahkan tab: kelompok (JASA/KEGIATAN), kode, uraian, satuan, volume, tarif, pagu proposal 12 bulan, pagu kegiatan termin. Kolom termin jasa diisi 0.</p><p>Perubahan tersimpan dalam riwayat anggaran. Tidak mencatat penerimaan, pembayaran, atau perubahan gaji staf.</p><button type="submit">Simpan anggaran</button></form></details>`:''}</main></body></html>`;
}
