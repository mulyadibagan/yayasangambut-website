export function financeSyncStatus(sync={},now=Date.now()){
 const metric=value=>value!==null&&value!==''&&Number.isSafeInteger(Number(value))&&Number(value)>=0?String(Number(value)):'Belum dilaporkan';
 const last=typeof sync.lastSuccess==='string'?Date.parse(sync.lastSuccess):NaN;
 const stale=Number.isFinite(last)&&now-last>7*24*60*60*1000;
 return {metric,stale,scanConfirmed:sync.scanned===true,
  title:{idle:'Belum dijalankan',running:'Sedang memindai email',success:'Eksekusi integrasi berhasil',failed:'Pemindaian gagal','not-configured':'Integrasi Gmail belum dikonfigurasi'}[sync.status]||'Status belum tersedia',
  coverage:typeof sync.queryAfter==='string'&&/^\d{4}\/\d{2}\/\d{2}$/.test(sync.queryAfter)?`Pencarian Gmail mulai ${sync.queryAfter}. Hasil mengikuti aturan dokumen keuangan dan batas pemindai.`:'Periode email yang tercakup belum dilaporkan oleh integrasi.',
  warning:sync.status==='success'&&metric(sync.scannedCount)==='0'?'Eksekusi berhasil dengan 0 pesan dipindai. Kelengkapan arsip belum dapat disimpulkan.':''};
}
