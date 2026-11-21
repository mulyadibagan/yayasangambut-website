import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {terbilang} from './payroll-print.mjs';
export const RECEIPT_PURPOSE='receipt-public-v2';
export async function donationPdf(row,letterhead){
 const p=row.payload,doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),page=doc.addPage([595.28,841.89]);
 const green=rgb(.08,.29,.22),ink=rgb(.16,.2,.18),muted=rgb(.4,.46,.42),left=48,width=499.28;
 const clean=s=>String(s??'').replace(/[^\x20-\x7e\xa0-\xff]/g,' ');
 const text=(s,x,y,size=11,font=regular,color=ink)=>page.drawText(clean(s),{x,y,size,font,color});
 function wrap(s,w,size=11,font=regular){const lines=[];let line='';for(const word of clean(s).split(/\s+/)){for(const part of word.match(/.{1,45}/g)||['']){if(line&&font.widthOfTextAtSize(line+' '+part,size)>w){lines.push(line);line='';}line+=(line?' ':'')+part;}}if(line)lines.push(line);return lines;}
 if(letterhead){const image=await doc.embedPng(letterhead);page.drawImage(image,{x:-7.2,y:660.09,width:607.6,height:201});}else{text('YAYASAN GAMBUT',left,780,20,bold,green);}
 const title='KWITANSI PENERIMAAN';text(title,(595.28-bold.widthOfTextAtSize(title,18))/2,658,18,bold,green);
 const number='Nomor: DON/'+row.created_at.slice(0,4)+'/'+String(row.seq).padStart(5,'0');text(number,(595.28-regular.widthOfTextAtSize(number,10))/2,637,10,regular,muted);
 let y=592;
 function field(label,value){const lines=wrap(value,339,11);text(label,left,y,10,regular,muted);lines.forEach((line,i)=>text(line,left+154,y-i*17,11,bold));y-=Math.max(1,lines.length)*17+20;}
 field('Telah diterima dari',p.donor);
 const date=new Date(p.date+'T12:00:00+07:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
 field('Tanggal penerimaan',date);field('Untuk penerimaan','Donasi kepada Yayasan Gambut');field('Cara pembayaran','Transfer bank');if(p.reference)field('Referensi transaksi',p.reference);
 y-=6;page.drawRectangle({x:left,y:y-64,width,height:64,color:rgb(.94,.97,.95),borderColor:rgb(.8,.87,.82),borderWidth:.6});text('JUMLAH DITERIMA',left+18,y-23,9,bold,muted);text('Rp '+new Intl.NumberFormat('id-ID').format(p.amount),left+18,y-49,22,bold,green);y-=93;
 text('Terbilang',left,y,10,regular,muted);for(const line of wrap(terbilang(p.amount)+' rupiah',width-154,11,bold)){text(line,left+154,y,11,bold);y-=17;}
 y-=56;text('Terima kasih atas dukungan Anda.',left,y,11);text('Yayasan Gambut',left,y-24,11,bold,green);
 page.drawLine({start:{x:left,y:80},end:{x:left+width,y:80},thickness:.6,color:rgb(.8,.87,.82)});text('Kwitansi penerimaan elektronik diterbitkan oleh Yayasan Gambut.',left,62,9,regular,muted);
 doc.setTitle('Kwitansi Penerimaan - '+number.replace('Nomor: ',''));doc.setAuthor('Yayasan Gambut');doc.setSubject('Penerimaan donasi');return doc.save();
}
