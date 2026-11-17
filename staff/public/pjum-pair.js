// The normal workflow needs exactly the workbook and the receipt bundle.
// Saving a draft and reading evidence never submit or approve the PJUM.
export async function processPjumPair({excel,receipts,refund,selected,preview,resolve,upload,save,scan,progress=()=>{}}){
 if(!excel||!receipts)throw Error('Pilih Excel PJUM dan PDF kuitansi terlebih dahulu.');
 if(!/\.xlsx$/i.test(excel.name)||!/\.pdf$/i.test(receipts.name))throw Error('Gunakan Excel (.xlsx) dan PDF kuitansi.');
 if(excel.size>5*1024*1024||receipts.size>5*1024*1024)throw Error('Setiap berkas maksimal 5 MB.');
 progress('Membaca Excel PJUM…');const parsed=await preview(excel),norm=s=>String(s||'').replace(/\s/g,'').toUpperCase();
 let row;
 if(selected){
  if(parsed.um_number&&norm(selected.number)!==norm(parsed.um_number))throw Error('Nomor UM pada Excel berbeda dari UM yang dipilih. Periksa kembali sebelum mengunggah.');
  row=selected.requiresResolve?await resolve(selected.number):selected;
 }
 else if(parsed.um_number)row=await resolve(parsed.um_number);
 else throw Error('Nomor UM asal belum ditemukan pada Excel. Pilih UM asal dari daftar, lalu proses kembali.');
 if(parsed.um_number&&norm(row.number)!==norm(parsed.um_number))throw Error('Nomor UM berbeda dari Excel.');
 progress('Menyimpan kedua berkas…');row=await upload(row,receipts);row=await upload(row,excel);
 const proof=row.files.filter(f=>f.purpose==='pjum'&&f.filename===receipts.name&&f.size===receipts.size&&f.mime==='application/pdf').at(-1);
 if(!proof)throw Error('PDF kuitansi belum tersimpan. Coba proses kembali.');
 if(!proof.pages||proof.pages!==parsed.items.length)throw Error('Jumlah halaman PDF berbeda dari rincian Excel. Berkas sudah tersimpan; periksa pemetaan kuitansi pada rincian.');
 const report={items:parsed.items.map((i,n)=>({...i,file_id:proof.id,page:n+1})),report_date:row.report?.report_date||parsed.report_date||new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}),report_number:parsed.report_number,notes:row.report?.notes||''};
 progress('Menyimpan '+report.items.length+' rincian secara otomatis…');row=await save(row,report);
 if(refund){progress('Menyimpan bukti pengembalian sisa UM.');row=await upload(row,refund,'settlement');}
 for(let i=0;i<report.items.length;i+=3){const pages=report.items.slice(i,i+3).map(({file_id,page})=>({file_id,page}));progress('Memeriksa kuitansi '+(i+1)+'–'+Math.min(i+3,report.items.length)+' dari '+report.items.length+'…');row=await scan(row,pages);}
 progress('Selesai. Draf tersimpan; periksa ringkasan sebelum mengirim.');return row;
}
