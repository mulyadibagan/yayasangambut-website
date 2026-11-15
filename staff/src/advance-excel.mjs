import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';

const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const cell=(ref,value,style=19,formula)=>`<c r="${ref}" s="${style}"${formula||typeof value==='number'?'':' t="inlineStr"'}>${formula?`<f>${xml(formula)}</f><v>${value}</v>`:typeof value==='number'?`<v>${value}</v>`:`<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`;
const day=s=>/^\d{4}-\d{2}-\d{2}/.test(s||'')?new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'';
export function advanceExcel(template,request){
 const p=request.payload,files=unzipSync(template),rows=[],merges=[];
 const row=(n,cells,height=22)=>rows.push(`<row r="${n}" ht="${height}" customHeight="1">${cells.join('')}</row>`);
 for(let n=1;n<=7;n++)row(n,[],18);
 row(8,[cell('A8','No UM',50),cell('B8',': '+request.number,51),cell('D8','Project',53),cell('E8',': '+p.project,54)],30);merges.push('E8:J8');
 row(9,[cell('A9','Tanggal',50),cell('B9',': '+day(request.created_at),51),cell('D9','Kegiatan',53),cell('E9',p.activity,71)],42);merges.push('E9:J9');
 row(10,[cell('A10','Lokasi',50),cell('B10',p.location,51),cell('D10','Periode',53),cell('E10',day(p.start)+' - '+day(p.end),71)],30);merges.push('E10:J10');
 row(12,[cell('A12','No',58),cell('B12','Deskripsi',59),cell('C12','Unit Cost',73),cell('D12','',74),cell('E12','',74),cell('F12','',74),cell('G12','',74),cell('H12','',74),cell('I12','',75),cell('J12','Jumlah',60)],32);merges.push('C12:I12');
 let n=13,total=0;const subtotalRows=[],groups=new Map();
 for(const item of p.items){const key=item.activity_code||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
 for(const [code,items] of groups){
  const allocation=p.allocations?.find(a=>a.code===code);row(n,[cell('A'+n,code,61),cell('B'+n,allocation?.name||p.activity,70)],36);merges.push('B'+n+':I'+n);n++;
  const start=n;let subtotal=0;
  for(const [i,item] of items.entries()){
   row(n,[cell('A'+n,i+1,62),cell('B'+n,item.description,63),cell('C'+n,item.rate,64),cell('D'+n,item.quantity,65),cell('E'+n,item.unit,66),cell('F'+n,item.times||1,65),cell('G'+n,'kali',66),cell('H'+n,item.days,65),cell('I'+n,'hari',66),cell('J'+n,item.subtotal,48,'ROUND(PRODUCT(C'+n+':I'+n+'),0)')],Math.max(24,Math.ceil(item.description.length/39)*16));subtotal+=item.subtotal;n++;
  }
  row(n,[cell('B'+n,'Subtotal kegiatan '+code,67),cell('J'+n,subtotal,49,'SUM(J'+start+':J'+(n-1)+')')]);merges.push('B'+n+':I'+n);subtotalRows.push(n);total+=subtotal;n++;
 }
 n++;row(n,[cell('B'+n,'TOTAL PENGAJUAN UANG MUKA',67),cell('J'+n,total,49,'SUM('+subtotalRows.map(r=>'J'+r).join(',')+')')],28);merges.push('B'+n+':I'+n);
 if(total!==request.total)throw Error('Total UM tidak sesuai rincian tersimpan.');
 const event=action=>request.events?.filter(e=>e.action===action).at(-1),checked=event('check'),approved=event('approve'),submitted=event('submit');
 n+=2;row(n,[cell('B'+n,'Diajukan oleh,',19),cell('C'+n,'Diperiksa oleh,',19),cell('E'+n,'Disetujui oleh,',20)]);merges.push('C'+n+':D'+n,'E'+n+':J'+n);
 n+=5;row(n,[cell('B'+n,'Nama: '+request.creator_name,19),cell('C'+n,'Nama: Riena Rachmatillah',18),cell('E'+n,'Nama: Mulyadi',6)],30);merges.push('C'+n+':D'+n,'E'+n+':J'+n);
 n++;row(n,[cell('B'+n,'Posisi: '+(request.creator_email.startsWith('mulyadi@')?'Direktur':request.creator_email.startsWith('riena')?'Finance':'Staf'),19),cell('C'+n,'Posisi: Finance',18),cell('E'+n,'Posisi: Direktur',6)]);merges.push('C'+n+':D'+n,'E'+n+':J'+n);
 n++;row(n,[cell('B'+n,'Tgl: '+day(submitted?.created_at),19),cell('C'+n,'Tgl: '+day(checked?.created_at),19),cell('E'+n,'Tgl: '+day(approved?.created_at),6)]);merges.push('C'+n+':D'+n,'E'+n+':J'+n);
 const statusLabels={draft:'Draf UM',returned:'Perlu perbaikan',submitted:'Menunggu pemeriksaan',checked:'Menunggu persetujuan',approved:'Disetujui',disbursed:'Sudah dicairkan',closed:'Selesai',cancelled:'Dibatalkan'};
 n++;row(n,[cell('B'+n,'Status: '+(statusLabels[request.status]||'Tahap pertanggungjawaban')+' � versi '+request.version,19)]);merges.push('B'+n+':J'+n);
 n+=2;row(n,[cell('B'+n,'PEMBAYARAN',28),cell('E'+n,'CATATAN',30)]);merges.push('E'+n+':J'+n);
 for(const [label,value] of [['Bank Transfer','Ya'],['Nama Bank',p.bank||''],['Nomor Rekening',p.account||''],['Nama Pemilik Rekening',p.account_name||'']]){n++;row(n,[cell('B'+n,label,32),cell('C'+n,': '+value,29),...(label==='Bank Transfer'?[cell('E'+n,p.notes||'',32)]:[])],label==='Bank Transfer'?40:24);merges.push('C'+n+':D'+n,...(label==='Bank Transfer'?['E'+n+':J'+n]:[]));}
 n++;row(n,[cell('B'+n,'Dokumen pengajuan uang muka Yayasan Gambut.',19)],30);merges.push('B'+n+':J'+n);
 let sheet=strFromU8(files['xl/worksheets/sheet1.xml']).replace('<sheetData></sheetData>','<sheetData>'+rows.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells>');
 files['xl/worksheets/sheet1.xml']=strToU8(sheet);files['xl/workbook.xml']=strToU8(strFromU8(files['xl/workbook.xml']).replace('PUM!$A$1:$J$43','PUM!$A$1:$J$'+n));
 return zipSync(files,{level:6});
}

