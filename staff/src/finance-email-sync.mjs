// Called after the staff session, finance owner and write-origin checks.
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function financeEmailSync(req,env,identityHeaders){
 if(!['GET','POST'].includes(req.method))return new Response('Metode tidak diizinkan.',{status:405});
 const url=new URL('/finance/api/email-intake'+(req.method==='POST'?'?scan=1':''),req.url);
 const headers=new Headers(identityHeaders);headers.delete('content-type');headers.delete('content-length');
 let data={},error='';
 try{
  const upstream=await env.FINANCE.fetch(new Request(url,{headers}));
  data=await upstream.json();
  if(!upstream.ok||data.error)throw Error('Upstream failed');
 }catch{error='Status sinkronisasi belum dapat dibaca. Coba periksa kembali.';}
 const sync=data.sync||{};
 const reportArchive=await verifiedReports(env);
 const labels={idle:'Belum dijalankan',running:'Sedang memindai email',success:'Pemindaian berhasil',failed:'Pemindaian gagal','not-configured':'Integrasi Gmail belum dikonfigurasi'};
 // Upstream errors may contain integration URLs or credentials.
 if(sync.status==='failed')error='Integrasi Gmail mengembalikan kesalahan. Periksa deployment dan konfigurasi Apps Script.';
 const count=value=>Number.isFinite(Number(value))?Number(value):0;
 const candidates=Array.isArray(data.candidates)?data.candidates:[];
 const rows=candidates.map(c=>`<tr><td>${escape(c.receivedAt)}</td><td>${escape(c.detectedType)}</td><td>${escape(c.title||c.subject)}</td><td>${escape(c.project)}</td><td>${escape(new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR'}).format(count(c.amount)))}</td></tr>`).join('');
 return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sinkronisasi Email · YG Finance</title><link rel="icon" href="/favicon.png"><style>body{font:16px system-ui;background:#f3f6f4;color:#193b30;margin:0}main{max-width:1000px;margin:40px auto;padding:24px;background:white;border-radius:16px}a{color:#175c43}button{background:#175c43;color:white;border:0;padding:14px 20px;border-radius:8px;font:inherit;cursor:pointer}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}.table{overflow:auto}.error{color:#9a2929}dl{display:grid;grid-template-columns:1fr 1fr;gap:12px}dd{margin:0;font-weight:bold}</style></head><body><main><a href="/finance">← Keuangan YG</a><h1>Sinkronisasi laporan dari email</h1><p>Pindai email keuangan dan arsipkan lampiran melalui integrasi Gmail yang sudah terpasang. Pesan yang sama diperiksa berdasarkan ID email untuk mencegah duplikasi.</p><h2>${escape(labels[sync.status]||'Status belum tersedia')}</h2>${error?`<p class="error">${escape(error)}</p>`:''}<dl><dt>Sinkronisasi terakhir berhasil</dt><dd>${escape(sync.lastSuccess||'Belum tercatat')}</dd><dt>Pesan dipindai</dt><dd>${count(sync.scannedCount)}</dd><dt>Catatan baru</dt><dd>${count(sync.imported)}</dd><dt>Catatan diperbarui</dt><dd>${count(sync.updated)}</dd><dt>Kandidat pemeriksaan baru</dt><dd>${count(sync.candidatesAdded)}</dd></dl><form method="post" action="/finance/email-sync"><button type="submit" ${sync.status==='running'?'disabled':''}>Pindai dan perbarui dari email</button></form><p><a href="/finance/email-sync">Periksa hasil terbaru ↻</a></p><p>Pemindaian tidak mengirim email persetujuan. Saldo bank tetap harus dicocokkan dengan mutasi rekening, dan laporan tidak diperlakukan sebagai pengeluaran bank kedua kali.</p><h2>Kandidat untuk diperiksa (${candidates.length})</h2><div class="table"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Dokumen</th><th>Proyek</th><th>Nominal</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Tidak ada kandidat yang menunggu pemeriksaan.</td></tr>'}</tbody></table></div>${reportArchive}</main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

async function verifiedReports(env){
 try{
  const result=await env.DB.prepare("SELECT title,project,notes,attachments_json FROM finance_email_candidates WHERE detected_type='LAPORAN' AND status='documented' ORDER BY received_at DESC LIMIT 100").all();
  const reports=result.results||[];
  const cards=reports.map(report=>{
   let files=[];try{files=JSON.parse(report.attachments_json||'[]');if(!Array.isArray(files))files=[];}catch{}
   const links=files.map(file=>{
    try{const url=new URL(file.url);if(url.protocol!=='https:'||!['drive.google.com','docs.google.com'].includes(url.hostname))return '';return '<li><a href="'+escape(url.href)+'" target="_blank" rel="noopener noreferrer">'+escape(file.name)+'</a></li>';}catch{return '';}
   }).join('');
   return '<article><h3>'+escape(report.title)+'</h3><p>'+escape(report.project)+'</p><p>'+escape(report.notes)+'</p><ul>'+links+'</ul></article>';
  }).join('');
  return '<h2>Arsip laporan terverifikasi ('+reports.length+')</h2><p>Arsip pelaporan dan konfirmasi pemeriksa. Tidak membuat permintaan dana atau persetujuan baru, dan tidak mengubah saldo bank.</p>'+cards;
 }catch{return '<h2>Arsip laporan terverifikasi</h2><p>Arsip laporan belum dapat dibaca. Periksa kembali nanti.</p>';}
}
