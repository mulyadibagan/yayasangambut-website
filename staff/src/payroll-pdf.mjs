import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {terbilang} from './payroll-print.mjs';
const clean=s=>String(s??'').replace(/\u00a0/g,' ').replace(/[–—−]/g,'-').replace(/\r/g,'');
const money=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(n);
const date=s=>new Date(String(s).slice(0,10)+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
export async function payrollPdf(r,logoBytes){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const stamp=new Date(r.reviewed_at||r.created_at);doc.setCreationDate(stamp);doc.setModificationDate(stamp);doc.setTitle('Form Pengajuan Gaji '+r.period);doc.setAuthor('Yayasan Gambut');
 const m=r.form_meta||{},left=36,width=523.28,cols=[24,62,193,78,166.28],ink=rgb(.08,.12,.11),line=rgb(.25,.3,.28),green=rgb(.08,.36,.28);
 let page,y;const logo=logoBytes?await doc.embedPng(logoBytes):null;
 function wrap(value,max,size=9,f=font){const result=[];for(const paragraph of clean(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(f.widthOfTextAtSize(word,size)>max){if(current){result.push(current);current='';}let segment='';for(const c of word){if(f.widthOfTextAtSize(segment+c,size)>max){result.push(segment);segment='';}segment+=c;}current=segment;}else if(current&&f.widthOfTextAtSize(current+' '+word,size)>max){result.push(current);current=word;}else current+=(current?' ':'')+word;}result.push(current);}return result;}
 const draw=(value,x,top,size=9,f=font,color=ink)=>page.drawText(clean(value),{x,y:top-size,size,font:f,color});
 function newPage(){page=doc.addPage([595.28,841.89]);y=800;if(logo)page.drawImage(logo,{x:left,y:y-44,width:44,height:44});draw('YAYASAN GAMBUT',left+(logo?58:0),y,11,bold,green);draw('Formulir Permintaan Dana',left+(logo?58:0),y-19,16,bold);draw(r.status==='approved'?'DISETUJUI':'PRATINJAU - BELUM DISETUJUI',left+(logo?58:0),y-41,9,bold,green);y-=65;page.drawLine({start:{x:left,y},end:{x:left+width,y},thickness:1,color:green});y-=14;}
 function ensure(height){if(y-height<48)newPage();}
 function paragraph(value,size=9,f=font){for(const text of wrap(value,width,size,f)){ensure(size+5);draw(text,left,y,size,f);y-=size+5;}}
 function identity(label,value){const lines=wrap(value,width-120,10);ensure(lines.length*14+4);draw(label,left,y,10);lines.forEach((t,i)=>draw((i?'':': ')+t,left+115,y-i*14,10));y-=lines.length*14+4;}
 function tableRow(values,heading=false){const lines=values.map((v,i)=>wrap(v,cols[i]-10,9,heading?bold:font)),height=Math.max(...lines.map(v=>v.length))*12+12;ensure(height);let x=left;for(let i=0;i<cols.length;i++){page.drawRectangle({x,y:y-height,width:cols[i],height,borderWidth:.5,borderColor:line,...(heading?{color:rgb(.94,.96,.95)}:{})});lines[i].forEach((t,j)=>{const tx=i===3&&!heading?x+cols[i]-5-font.widthOfTextAtSize(t,9):x+5;draw(t,tx,y-6-j*12,9,heading?bold:font);});x+=cols[i];}y-=height;}
 const headings=['No','Kode\nAnggaran','Rincian Keperluan','Jumlah\n(Rp)','Keterangan'];
 newPage();identity('No. Formulir',m.number||r.id);identity('Tanggal pengajuan',date(m.date||r.created_at));identity('Nama pengaju',m.applicant||r.creator_email);identity('Jabatan',m.title||'Finance');identity('Keperluan',m.purpose||'Pembayaran gaji '+r.period);y-=8;tableRow(headings,true);
 for(const [index,i] of r.items.entries()){
  const detail=(i.description||'Gaji '+i.name)+'\nPeriode '+r.period+(i.allowance||i.deduction?'\nPokok '+money(i.base)+' + tambahan '+money(i.allowance)+' - potongan '+money(i.deduction):'');
  const values=[String(index+1),i.budget_code||'',detail,money(i.net),'Transfer ke '+(i.account_name||i.name)+'\n'+(i.bank||'')+' '+(i.account||'')+(i.remarks?'\n'+i.remarks:'')];
  const height=Math.max(...values.map((v,n)=>wrap(v,cols[n]-10).length))*12+12;
  // Split exceptionally long rows across pages without truncating document fields.
  const blocks=values.map((v,n)=>wrap(v,cols[n]-10));let offset=0;
  while(offset<Math.max(...blocks.map(b=>b.length))){if(y<110){newPage();tableRow(headings,true);}const count=Math.max(1,Math.floor((y-60)/12)-1),part=blocks.map(b=>b.slice(offset,offset+count).join('\n'));tableRow(part);offset+=count;}
 }
 ensure(34);tableRow(['','','TOTAL',money(r.total),''],true);y-=16;
 paragraph('Dalam huruf: '+terbilang(r.total).replace(/\s+/g,' ').trim().replace(/^./,c=>c.toUpperCase())+' rupiah.',10,bold);
 if(r.notes){y-=6;paragraph(r.notes);}
 y-=12;ensure(140);paragraph((m.place?m.place+', ':'')+date(m.date||r.created_at),10);y-=10;
 const signatures=[['Diajukan oleh',m.applicant||r.creator_email,m.title||'Finance'],['Diperiksa oleh','Mulyadi, S.P.','Direktur'],['Disetujui oleh','Mulyadi, S.P.','Direktur']];
 for(const [index,[label,name,title]] of signatures.entries()){const x=left+index*178;draw(label+',',x,y,9);draw(r.status==='approved'?(index?'Persetujuan melalui akun':'Pengajuan melalui akun'):'Belum disetujui',x,y-23,8);const email=index?r.reviewer_email:r.creator_email;wrap(email||'',155,7).forEach((t,j)=>draw(t,x,y-36-j*10,7));wrap(name,155,9,bold).forEach((t,j)=>draw(t,x,y-65-j*12,9,bold));draw(title,x,y-94,8);}
 y-=114;if(r.status==='approved')paragraph('Disetujui pada '+new Date(r.reviewed_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB.',8);
 const pages=doc.getPages();for(const [i,p] of pages.entries())p.drawText('YG Finance | '+clean(m.number||r.id)+' | Halaman '+(i+1)+'/'+pages.length,{x:left,y:25,size:7,font,color:rgb(.4,.4,.4)});
 return doc.save();
}
export async function pdfHash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function savePayrollPdf(env,row,event,at){
 let logoBytes; if(env.ASSETS){const logo=await env.ASSETS.fetch(new Request(env.APP_ORIGIN+'/brand/yayasan-gambut-logo.png'));if(!logo.ok)throw Error('Logo dokumen tidak tersedia.');logoBytes=new Uint8Array(await logo.arrayBuffer());}
 const bytes=await payrollPdf(row,logoBytes),sha256=await pdfHash(bytes),object_key='payroll-private/'+row.id+'/approved-'+event+'.pdf',filename='Form-Gaji-'+row.period+'-'+event.slice(0,8)+'.pdf';
 await env.MEDIA.put(object_key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 return {object_key,filename,sha256,size:bytes.length,created_at:at};
}
