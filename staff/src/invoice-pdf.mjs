import {invoiceBankLines} from './invoice-bank.mjs';
import {invoiceSignatureEligible} from './document-signature.mjs';
import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
import {invoiceLanguage} from './invoice-language.mjs';
export const invoiceMoney=n=>new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(n);
const clean=s=>String(s??'').replace(/[–—−]/g,'-').replace(/\u00a0/g,' ').replace(/\r/g,'');
export async function invoicePdf(r,logoBytes,signatureBytes){
 const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),logo=logoBytes?await doc.embedPng(logoBytes):null;
 const signature=signatureBytes&&invoiceSignatureEligible(r)?await doc.embedPng(signatureBytes):null;
 doc.setTitle('Invoice '+r.number);doc.setAuthor('Yayasan Gambut');
 const d=r.data,L=invoiceLanguage(d),money=L.money,left=42,width=511.28,green=rgb(.07,.3,.23),ink=rgb(.12,.15,.14),line=rgb(.55,.63,.58),pale=rgb(.94,.97,.95);let page,y;
 const draw=(s,x,top,size=10,font=regular,color=ink)=>page.drawText(clean(s),{x,y:top-size,size,font,color});
 function wrap(value,w,size=10,font=regular){const out=[];for(const p of clean(value).split('\n')){let cur='';for(const word of p.split(/\s+/)){if(font.widthOfTextAtSize(word,size)>w){if(cur){out.push(cur);cur='';}for(const c of word){if(font.widthOfTextAtSize(cur+c,size)>w){out.push(cur);cur='';}cur+=c;}}else if(cur&&font.widthOfTextAtSize(cur+' '+word,size)>w){out.push(cur);cur=word;}else cur+=(cur?' ':'')+word;}out.push(cur);}return out;}
 function start(){
  page=doc.addPage([595.28,841.89]);const top=794,tx=left+82,tw=width-82;
  page.drawRectangle({x:left,y:702,width,height:110,color:rgb(1,.965,.91)});
  page.drawSvgPath('M 150 0 L 511.28 0 L 511.28 110 Z',{x:left,y:812,color:rgb(1,.88,.66)});
  page.drawSvgPath('M 310 0 L 511.28 0 L 511.28 110 Z',{x:left,y:812,color:rgb(.97,.58,.24),opacity:.65});
  page.drawRectangle({x:left,y:812,width,height:3,color:rgb(.93,.46,.14)});
  if(logo)page.drawImage(logo,{x:left,y:top-62,width:62,height:62});
  draw('YAYASAN GAMBUT',tx,top,18,bold,green);
  let hy=top-30;for(const s of wrap(d.organization_address||'Yayasan Gambut',tw,9)){draw(s,tx,hy,9);hy-=13;}
  hy-=4;for(const s of wrap(d.organization_contact||'yayasangambut.org',tw,8.5)){draw(s,tx,hy,8.5);hy-=12;}
  y=Math.min(top-88,hy-13);page.drawLine({start:{x:left,y},end:{x:left+width,y},thickness:1.2,color:green});
  y-=24;draw('INVOICE',left,y,22,bold,green);if(r.status!=='issued')draw(L.draft,left+280,y+2,11,bold,rgb(.55,.33,.13));y-=38;
 }

 function ensure(h){if(y-h<55)start();}
 function paragraph(s,w=width,size=10,font=regular,x=left){for(const t of wrap(s,w,size,font)){ensure(size+5);draw(t,x,y,size,font);y-=size+5;}}
 function boxRow(label,value,heading=false,ref=''){const a=wrap(label,width-194,10,heading?bold:regular),b=wrap(value,130,10,bold),h=Math.max(a.length,b.length)*13+12;ensure(h);page.drawRectangle({x:left,y:y-h,width,height:h,borderColor:line,borderWidth:.6,...(heading?{color:pale}:{})});page.drawLine({start:{x:left+width-140,y},end:{x:left+width-140,y:y-h},thickness:.6,color:line});page.drawLine({start:{x:left+40,y},end:{x:left+40,y:y-h},thickness:.6,color:line});draw(ref,left+9,y-7,9,bold);a.forEach((s,i)=>draw(s,left+48,y-6-i*13,10,heading?bold:regular));b.forEach((s,i)=>draw(s,left+width-8-bold.widthOfTextAtSize(s,10),y-6-i*13,10,bold));y-=h;}
 start();
 const date=L.date(d.date);
 const meta='INV NO: '+r.number;draw(meta,left+width-bold.widthOfTextAtSize(meta,10),y,10,bold);draw(L.dateLabel+date,left+width-regular.widthOfTextAtSize(L.dateLabel+date,9),y-19,9);
 paragraph(L.to,280,10,bold);paragraph(d.customer,280);if(d.customer_address)paragraph(d.customer_address,280);if(d.contract_ref)paragraph(L.contract+d.contract_ref,280,9);y-=18;
 boxRow(L.remarks,'TOTAL (IDR)',true,'REF');
 const detail=d.description+'\n'+L.installment(d.percentage,d.contract_amount)+'\n\n'+L.payment+'\n'+invoiceBankLines(d).join('\n');
 const detailLines=wrap(detail,width-204);let n=0;while(n<detailLines.length){if(y<95){start();boxRow(L.remarks+L.continued,'TOTAL (IDR)',true,'REF');}const count=Math.max(1,Math.floor((y-65)/13)-1);boxRow(detailLines.slice(n,n+count).join('\n'),n===0?money(r.amount):'',false,n===0?'1':'');n+=count;}
 if(d.tax_mode==='added')boxRow(L.vatAdded,money(d.vat));if(d.tax_mode==='included')boxRow(L.vatIncluded,money(d.vat));if(d.withholding)boxRow(L.withholding,'-'+money(d.withholding));boxRow('TOTAL',money(r.total),true);y-=16;paragraph(L.wordsLabel+L.words(r.total),width,9,bold);
 y-=10;if(d.notes){y-=8;paragraph(d.notes,width,9);}y-=20;ensure(140);paragraph(L.closing,width,10);paragraph('Yayasan Gambut',width,10);if(signature){page.drawImage(signature,{x:left,y:y-70,width:105,height:70});y-=74;}else y-=74;paragraph('Mulyadi',width,10,bold);paragraph(L.director,width,9);if(r.status!=='issued')paragraph(L.draftNote,width,8);
 if(r.invoice_preview){for(const p of doc.getPages()){p.drawText('PRATINJAU',{x:110,y:410,size:58,font:bold,color:rgb(.65,.12,.08),opacity:.12,rotate:degrees(32)});p.drawText('PRATINJAU - BELUM DISETUJUI / DITERBITKAN',{x:left,y:40,size:9,font:bold,color:rgb(.65,.12,.08)});}}
 const pages=doc.getPages();pages.forEach((p,i)=>p.drawText('YG Finance | '+r.number+' | '+(i+1)+'/'+pages.length,{x:left,y:25,size:7,font:regular,color:rgb(.45,.5,.47)}));return doc.save();
}
