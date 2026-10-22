import {richWord,richPdf} from './letters-rich-export.mjs';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
const address='Jalan Gulama No. 8, RT 01/RW 09, Kelurahan Tangkerang Barat, Kecamatan Marpoyan Damai, Kota Pekanbaru, Riau 28282';
const contact='official@yayasangambut.org | yayasangambut.org';
export const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Small uncompressed ZIP writer shared by the OOXML document/register exports.
export function zip(files){
 const entries=[],central=[];let offset=0;const utf=new TextEncoder();
 for(const [path,value] of Object.entries(files)){const name=utf.encode(path),data=typeof value==='string'?utf.encode(value):value;let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const head=new Uint8Array(30+name.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);head.set(name,30);entries.push(head,data);
  const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=head.length+data.length;
 }
 const size=central.reduce((a,c)=>a+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);const out=new Uint8Array(offset+size+22);let pos=0;for(const a of [...entries,...central,end]){out.set(a,pos);pos+=a.length;}return out;
}
const rel=(type,target,id)=>`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
const relationships=body=>`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
const types=body=>`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${body}</Types>`;
const override=(part,type)=>`<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`;
const p=(text,bold=false,size=22,after=75)=>text?`<w:p><w:pPr><w:spacing w:after="${after}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold?'<w:b/>':''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`:'<w:p><w:pPr><w:spacing w:line="80" w:lineRule="exact" w:after="0"/></w:pPr></w:p>';
const ns='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
export const LETTER_LAYOUT='formal-v3';
export const bankField=line=>{const match=line.match(/^(Nama pemilik rekening|Nama bank|Cabang|Nomor rekening|Alamat cabang bank)\s*:\s*(.*)$/);return match?{label:match[1],value:match[2]}:null;};
export const SIGNATURE_KEY='surat-assets/ttd-yayasan-gambut.png';
const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const letterDate=date=>`${Number(date.slice(8,10))} ${months[Number(date.slice(5,7))-1]} ${date.slice(0,4)}`;
const formalP=(text,{bold=false,justify=false,keep=false,after=0,before=0,space=0,metadata=false}={})=>`<w:p><w:pPr>${keep?'<w:keepNext/>':''}<w:keepLines/><w:spacing w:before="${before}" w:after="${after}" w:line="${space||276}" w:lineRule="${space?'exact':'auto'}"/>${justify?'<w:jc w:val="both"/>':''}${metadata?'<w:tabs><w:tab w:val="left" w:pos="1500"/><w:tab w:val="right" w:pos="9026"/></w:tabs>':''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${bold?'<w:b/>':''}<w:sz w:val="22"/></w:rPr>${text.split('\t').map(t=>`<w:t xml:space="preserve">${xml(t)}</w:t>`).join('<w:tab/>')}</w:r></w:p>`;
function bankTable(rows){const cell=(value,width)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>${formalP(value)}</w:tc>`;
 return `<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="200"/><w:gridCol w:w="6426"/></w:tblGrid>${rows.map(row=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(row.label,2400)}${cell(':',200)}${cell(row.value,6426)}</w:tr>`).join('')}</w:tbl>`;
}
function formalBody(r){const d=r.data,parts=[];
 if(r.status!=='issued')parts.push(formalP('DRAFT - BELUM TERBIT',{bold:true,after:120}));
 parts.push(formalP(`Nomor Surat\t: ${r.number||'Belum dialokasikan'}\t${letterDate(d.date)}`,{metadata:true,keep:true}),formalP(`Perihal\t: ${d.subject}`,{metadata:true,keep:true}),formalP(`Lampiran\t: ${d.attachments||'-'}`,{metadata:true,after:300,keep:true}));
 const recipient=['Kepada Yth.',d.recipient,d.institution,d.address||'Di tempat'].filter(Boolean);
 recipient.forEach((t,i)=>parts.push(formalP(t,{keep:true,after:i===recipient.length-1?180:0})));
 const lines=d.body.split('\n');for(let i=0;i<lines.length;i++){const field=bankField(lines[i]);if(field){const rows=[field];while(i+1<lines.length&&bankField(lines[i+1]))rows.push(bankField(lines[++i]));parts.push(bankTable(rows));}else parts.push(formalP(lines[i],{justify:!!lines[i],space:lines[i]?0:140}));}
 parts.push(formalP('Hormat kami,',{before:180,after:1400,keep:true}),formalP('MULYADI',{bold:true,keep:true}),formalP('DIREKTUR YAYASAN GAMBUT',{bold:true}));
 return parts.join('');
}
export function letterDocx(r,logo,letterhead){
 const rich=r.data.bodyFormat==='rich-v1'||r.data.kind==='PNY'?richWord(r,letterDate):null;
 const picture=`<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="590000" cy="590000"/><wp:docPr id="1" name="Logo asli Yayasan Gambut"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="logo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="590000" cy="590000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
 const header=`<w:hdr ${ns}><w:tbl><w:tblPr><w:tblW w:w="9860" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="20" w:color="EC7929"/><w:bottom w:val="single" w:sz="10" w:color="155B43"/></w:tblBorders><w:shd w:fill="FFEFDA"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="1100"/><w:gridCol w:w="8760"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="1100" w:type="dxa"/></w:tcPr>${picture}</w:tc><w:tc><w:tcPr><w:tcW w:w="8760" w:type="dxa"/></w:tcPr>${p('YAYASAN GAMBUT',true,32).replace('<w:b/>','<w:b/><w:color w:val="155B43"/>')}${p(address,false,17)}${p(contact,false,17)}</w:tc></w:tr></w:tbl>${p('',false,10,0)}</w:hdr>`;
 const fullPicture=picture.replaceAll('590000','7716520').replaceAll('cy="7716520"','cy="2552700"').replace('<wp:inline ', '<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1" ').replace('<wp:extent','<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>-91440</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>-243840</wp:posOffset></wp:positionV><wp:extent').replace('<wp:docPr','<wp:wrapNone/><wp:docPr').replace('</wp:inline>','</wp:anchor>');
 const fullHeader=letterhead?`<w:hdr ${ns}>${fullPicture}</w:hdr>`:header;
 return zip({'[Content_Types].xml':types('<Default Extension="png" ContentType="image/png"/>'+override('word/document.xml','wordprocessingml.document.main')+override('word/header1.xml','wordprocessingml.header')+(rich?override('word/numbering.xml','wordprocessingml.numbering'):'')),'_rels/.rels':relationships(rel('officeDocument','word/document.xml','doc')),'word/_rels/document.xml.rels':relationships(rel('header','header1.xml','header')+(rich?rel('numbering','numbering.xml','numbering'):'')),'word/_rels/header1.xml.rels':relationships(rel('image','media/logo.png','logo')),...(rich?{'word/numbering.xml':rich.numbering}:{}),'word/media/logo.png':letterhead||logo,'word/header1.xml':fullHeader,'word/document.xml':`<?xml version="1.0"?><w:document ${ns}><w:body>${rich?rich.body:formalBody(r)}<w:sectPr><w:headerReference w:type="default" r:id="header"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2520" w:right="1440" w:bottom="1008" w:left="1440" w:header="518" w:footer="500"/></w:sectPr></w:body></w:document>`});
}
export async function letterPdf(r,logoBytes,letterhead,signatureBytes){
 if(r.data.bodyFormat==='rich-v1'||r.data.kind==='PNY')return richPdf(r,logoBytes,letterhead,signatureBytes,letterDate);
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const head=await doc.embedPng(letterhead||logoBytes),signature=r.status==='issued'&&signatureBytes?await doc.embedPng(signatureBytes):null;
 const left=72,right=523.28,width=right-left,size=11,leading=15;let page,y;
 const safe=s=>String(s).replace(/[^\x20-\x7e\xa0-\xff]/g,'-');
 const text=(s,x,top,f=font)=>page.drawText(safe(s),{x,y:top-size,size,font:f,color:rgb(0,0,0)});
 function start(){page=doc.addPage([595.28,841.89]);if(letterhead)page.drawImage(head,{x:-7.2,y:660.09,width:607.6,height:201});else page.drawImage(head,{x:left,y:740,width:55,height:55});y=715.89;}
 function room(height){if(y-height<50)start();}
 function wrap(value,available=width){const out=[];let line='';for(const word of safe(value).split(/ +/)){if(line&&font.widthOfTextAtSize(line+' '+word,size)>available){out.push(line);line='';}if(font.widthOfTextAtSize(word,size)>available){if(line){out.push(line);line='';}for(const ch of word){if(font.widthOfTextAtSize(line+ch,size)>available){out.push(line);line='';}line+=ch;}}else line+=(line?' ':'')+word;}out.push(line);return out;}
 function paragraph(value,justify=false,x=left,available=width){const lines=wrap(value,available);lines.forEach((line,i)=>{room(leading);const words=line.split(' ');if(justify&&i<lines.length-1&&words.length>1){const gap=(available-words.reduce((sum,w)=>sum+font.widthOfTextAtSize(w,size),0))/(words.length-1);let at=x;for(const w of words){text(w,at,y);at+=font.widthOfTextAtSize(w,size)+gap;}}else text(line,x,y);y-=leading;});}
 start();if(r.status!=='issued'){paragraph('DRAFT - BELUM TERBIT');y-=6;}
 const date=letterDate(r.data.date);text('Nomor Surat',left,y);text(': '+(r.number||'Belum dialokasikan'),147,y);text(date,right-font.widthOfTextAtSize(date,size),y);y-=leading;
 for(const [label,value] of [['Perihal',r.data.subject],['Lampiran',r.data.attachments||'-']]){text(label,left,y);paragraph(': '+value,false,147,right-147);}y-=15;
 const recipient=['Kepada Yth.',r.data.recipient,r.data.institution,r.data.address||'Di tempat'].filter(Boolean);for(const line of recipient)paragraph(line);y-=10;
 for(const line of r.data.body.split('\n')){const field=bankField(line);if(field){const valueLines=wrap(field.value,width-130);room(valueLines.length*leading);text(field.label,left,y);text(':',left+120,y);paragraph(field.value,false,left+130,width-130);}else if(line)paragraph(line,true);else y-=7;}
 room(122);y-=10;text('Hormat kami,',left,y);y-=size;
 // The supplied transparent PNG remains private and is used only for an issued electronic PDF.
 if(signature)page.drawImage(signature,{x:left-6,y:y-93,width:105,height:105});
 y-=87;text('MULYADI',left,y,bold);y-=20;text('DIREKTUR YAYASAN GAMBUT',left,y,bold);
 doc.setTitle(r.data.subject);doc.setAuthor('Yayasan Gambut');return doc.save();
}
export async function letterDocuments(r,logo,letterhead,signature){return {docx:letterDocx(r,logo,letterhead),pdf:await letterPdf(r,logo,letterhead,signature)};}
export function registerXlsx(rows){const values=[['Nomor surat','Tanggal','Jenis','Perihal','Tujuan','Pembuat','Penandatangan','Status','Arsip Word','Arsip PDF'],...rows.map(r=>[r.number||'',r.data.date,r.data.kind,r.data.subject,r.data.institution||r.data.recipient,r.owner||'',r.data.signer||'',r.status||r.data.status,...['docx','pdf'].map(ext=>r.archives?.find(f=>f.format===ext)?.web_url||'')])];
 const sheet=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${values.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
 return zip({'[Content_Types].xml':types(override('xl/workbook.xml','spreadsheetml.sheet.main')+override('xl/worksheets/sheet1.xml','spreadsheetml.worksheet')),'_rels/.rels':relationships(rel('officeDocument','xl/workbook.xml','book')),'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Register Surat" sheetId="1" r:id="sheet"/></sheets></workbook>','xl/_rels/workbook.xml.rels':relationships(rel('worksheet','worksheets/sheet1.xml','sheet')),'xl/worksheets/sheet1.xml':sheet});
}
