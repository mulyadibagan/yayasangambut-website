import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {cleanDocument,plainDocument,escapeText} from '../public/letter-content.js';
const content=r=>r.data.bodyFormat==='rich-v1'?cleanDocument(r.data.bodyDoc):plainDocument(r.data.body);
const xml=escapeText;
export function richWord(r,dateLabel){
 let num=0;const numbering=[];
 const run=(r,size=22)=>`<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${size}"/>${r.bold?'<w:b/>':''}${r.italic?'<w:i/>':''}${r.underline?'<w:u w:val="single"/>':''}</w:rPr>${r.text.split('\n').map(t=>t.split('\t').map(v=>`<w:t xml:space="preserve">${xml(v)}</w:t>`).join('<w:tab/>')).join('<w:br/>')}</w:r>`;
 const p=(p,extra={})=>`<w:p><w:pPr><w:widowControl/>${extra.keep?'<w:keepNext/>':''}<w:jc w:val="${p.align==='justify'?'both':p.align||'left'}"/><w:spacing w:after="${(p.space??6)*20}" w:before="${extra.before||0}" w:line="276" w:lineRule="auto"/><w:ind w:left="${(p.indent||0)*360+(extra.num?360:0)}"${extra.num?' w:hanging="360"':''}/>${extra.num?`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${extra.num}"/></w:numPr>`:''}${extra.tabs?'<w:tabs><w:tab w:val="left" w:pos="1500"/><w:tab w:val="right" w:pos="9026"/></w:tabs>':''}</w:pPr>${p.runs.map(r=>run(r,extra.size||22)).join('')}</w:p>`;
 const simple=(text,attrs={},extra={})=>p({align:'left',space:6,runs:[{text}],...attrs},extra);
 function block(b){if(b.type==='paragraph')return p(b);
  if(b.type==='list'){const id=++num;numbering.push(`<w:num w:numId="${id}"><w:abstractNumId w:val="${b.ordered?0:1}"/>${b.ordered?`<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${b.start}"/></w:lvlOverride>`:''}</w:num>`);return b.items.map(item=>p(item,{num:id})).join('');}
  const widths=b.widths.map(w=>Math.round(w/100*9026));widths[widths.length-1]+=9026-widths.reduce((a,n)=>a+n,0);
  const border=['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="${b.border==='none'?'nil':'single'}" w:sz="4" w:color="AAB5AF"/>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="9026" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar>${['top','left','bottom','right'].map(side=>`<w:${side} w:w="${b.border==='none'?0:60}" w:type="dxa"/>`).join('')}</w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${b.rows.map(row=>'<w:tr>'+row.map((cell,i)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${cell.map(c=>p(c)).join('')}</w:tc>`).join('')+'</w:tr>').join('')}</w:tbl>`;
 }
 let body=r.status==='issued'?'':simple('DRAFT - BELUM TERBIT',{runs:[{text:'DRAFT - BELUM TERBIT',bold:true}]});
 if(r.data.kind==='PNY')body+=simple(r.data.subject,{align:'center',space:6,runs:[{text:r.data.subject,bold:true}]},{size:26,keep:true})+simple('Nomor: '+(r.number||'Belum dialokasikan'),{align:'center',space:12},{keep:true});
 else{body+=simple(`Nomor Surat\t: ${r.number||'Belum dialokasikan'}\t${dateLabel(r.data.date)}`,{space:0},{tabs:true,keep:true})+simple('Perihal\t: '+r.data.subject,{space:0},{tabs:true,keep:true})+simple('Lampiran\t: '+(r.data.attachments||'-'),{space:15},{tabs:true,keep:true});for(const t of ['Kepada Yth.',r.data.recipient,r.data.institution,r.data.address||'Di tempat'].filter(Boolean))body+=simple(t,{space:0},{keep:true});body+=simple('',{space:10});}
 body+=content(r).blocks.map(block).join('');
 const statement=r.data.kind==='PNY',align=statement?'right':'left';
 body+=simple(statement?`${r.data.statementPlace||'Pekanbaru'}, ${dateLabel(r.data.date)}`:'Hormat kami,',{align,space:70},{before:180,keep:true});
 body+=simple('Mulyadi',{align,runs:[{text:'Mulyadi',bold:true}],space:0},{keep:true})+simple('Direktur Yayasan Gambut',{align,space:0});
 const abstract=(id,ordered)=>`<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${ordered?'decimal':'bullet'}"/><w:lvlText w:val="${ordered?'%1.':'&#8226;'}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum>`;
 return {body,numbering:`<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${abstract(0,true)+abstract(1,false)+numbering.join('')}</w:numbering>`};
}

export async function richPdf(r,logoBytes,letterhead,signatureBytes,dateLabel){
 const doc=await PDFDocument.create(),fonts={normal:await doc.embedFont(StandardFonts.Helvetica),bold:await doc.embedFont(StandardFonts.HelveticaBold),italic:await doc.embedFont(StandardFonts.HelveticaOblique),both:await doc.embedFont(StandardFonts.HelveticaBoldOblique)};
 const head=await doc.embedPng(letterhead||logoBytes),signature=r.status==='issued'&&signatureBytes?await doc.embedPng(signatureBytes):null;
 const left=72,right=523.28,width=right-left,size=11,leading=14,bottom=50,top=715.89;let page,y;
 const safe=text=>[...String(text)].map(c=>{try{fonts.normal.encodeText(c);return c;}catch{return c==='\t'?'    ':'?';}}).join('');
 const face=r=>r.bold&&r.italic?fonts.both:r.bold?fonts.bold:r.italic?fonts.italic:fonts.normal;
 function start(){page=doc.addPage([595.28,841.89]);page.drawImage(head,letterhead?{x:-7.2,y:660.09,width:607.6,height:201}:{x:left,y:740,width:55,height:55});y=top;}
 const ensure=h=>{if(y-h<bottom)start();};
 function lines(p,available){const fs=p.fontSize||size,out=[];let line=[],used=0;const flush=()=>{while(line.length&&/^ +$/.test(line.at(-1).text))line.pop();out.push(line);line=[];used=0;};
  for(const run of p.runs){const f=face(run);for(const part of run.text.split(/(\n|[\t ]+)/).filter(Boolean)){if(part==='\n'){flush();continue;}const text=safe(part),w=f.widthOfTextAtSize(text,fs);if(/^ +$/.test(text)&&!line.length)continue;if(w>available){for(const ch of text){const cw=f.widthOfTextAtSize(ch,fs);if(used+cw>available&&line.length)flush();line.push({...run,text:ch,font:f,fontSize:fs,width:cw});used+=cw;}continue;}if(used+w>available&&line.length)flush();if(/^ +$/.test(text)&&!line.length)continue;line.push({...run,text,font:f,fontSize:fs,width:w});used+=w;}}
  if(line.length||!out.length)flush();return out;
 }
 function draw(line,p,x,at,available,last=true){if(p.align!=='justify'||last){const compact=[];for(const r of line){const prior=compact.at(-1);if(prior&&prior.font===r.font&&prior.underline===r.underline){prior.text+=r.text;prior.width=prior.font.widthOfTextAtSize(prior.text,prior.fontSize||size);}else compact.push({...r});}line=compact;}const used=line.reduce((s,r)=>s+r.width,0),spaces=line.reduce((s,r)=>s+(/^ +$/.test(r.text)?r.text.length:0),0);let cursor=x+(p.align==='center'?(available-used)/2:p.align==='right'?available-used:0);const extra=p.align==='justify'&&!last&&spaces?(available-used)/spaces:0;
  for(const r of line){page.drawText(r.text,{x:cursor,y:at-(r.fontSize||size),size:r.fontSize||size,font:r.font,color:rgb(0,0,0)});const w=r.width+(/^ +$/.test(r.text)?extra*r.text.length:0);if(r.underline&&r.text.trim())page.drawLine({start:{x:cursor,y:at-(r.fontSize||size)-1.3},end:{x:cursor+w,y:at-(r.fontSize||size)-1.3},thickness:.6,color:rgb(0,0,0)});cursor+=w;}
 }
 function paragraph(p,{marker,x=left,available=width}={}){const lineHeight=p.fontSize?Math.max(leading,p.fontSize*1.15):leading,indent=(p.indent||0)*18+(marker?18:0),lineSet=lines(p,available-indent);if(lineSet.length<=3)ensure(lineSet.length*lineHeight);lineSet.forEach((line,i)=>{ensure((lineSet.length>3&&(i===0||i===lineSet.length-2)?2:1)*lineHeight);if(marker&&i===0)page.drawText(safe(marker),{x:x+(p.indent||0)*18,y:y-size,size,font:fonts.normal});draw(line,p,x+indent,y,available-indent,i===lineSet.length-1);y-=lineHeight;});y-=p.space??6;}
 const simple=(text,attrs={},opts={})=>paragraph({align:'left',indent:0,space:6,runs:[{text}],...attrs},opts);
 function table(b){const padding=b.border==='none'?0:3,ws=b.widths.map(w=>w/100*width);
  for(const row of b.rows){const queues=row.map((cell,i)=>cell.flatMap(p=>[...lines(p,Math.max(25,ws[i]-padding*2-(p.indent||0)*18)).map((line,j,all)=>({line,p,last:j===all.length-1,height:leading})),...(p.space?[{height:p.space}]:[])]));
   const height=Math.max(...queues.map(q=>q.reduce((s,n)=>s+n.height,0)))+padding*2;if(height<=top-bottom)ensure(height);
   while(queues.some(q=>q.length)){ensure(leading+padding*2);const available=y-bottom-padding*2,parts=queues.map(q=>{const taken=[];let h=0;while(q.length&&h+q[0].height<=available){const item=q.shift();taken.push({...item,offset:h});h+=item.height;}return {taken,height:h};});const h=Math.max(...parts.map(p=>p.height))+padding*2;let x=left;
    parts.forEach((part,i)=>{if(b.border!=='none')page.drawRectangle({x,y:y-h,width:ws[i],height:h,borderWidth:.5,borderColor:rgb(.66,.7,.68)});for(const item of part.taken)if(item.line)draw(item.line,item.p,x+padding+(item.p.indent||0)*18,y-padding-item.offset,ws[i]-padding*2-(item.p.indent||0)*18,item.last);x+=ws[i];});y-=h;if(queues.some(q=>q.length))start();
   }
  }y-=6;
 }
 start();if(r.status!=='issued')simple('DRAFT - BELUM TERBIT',{runs:[{text:'DRAFT - BELUM TERBIT',bold:true}]});
 if(r.data.kind==='PNY'){simple(r.data.subject,{align:'center',fontSize:13,runs:[{text:r.data.subject,bold:true}],space:6});simple('Nomor: '+(r.number||'Belum dialokasikan'),{align:'center',space:12});}
 else{const date=dateLabel(r.data.date);page.drawText(date,{x:right-fonts.normal.widthOfTextAtSize(date,size),y:y-size,size,font:fonts.normal});simple('Nomor Surat: '+(r.number||'Belum dialokasikan'),{space:0},{available:width-115});simple('Perihal: '+r.data.subject,{space:0});simple('Lampiran: '+(r.data.attachments||'-'),{space:15});for(const t of ['Kepada Yth.',r.data.recipient,r.data.institution,r.data.address||'Di tempat'].filter(Boolean))simple(t,{space:0});y-=10;}
 for(const b of content(r).blocks){if(b.type==='paragraph')paragraph(b);else if(b.type==='list')b.items.forEach((item,i)=>paragraph(item,{marker:b.ordered?(b.start+i)+'.':'\u2022'}));else table(b);}
 const statement=r.data.kind==='PNY',x=statement?right-225:left,w=statement?225:width,closing=statement?`${r.data.statementPlace||'Pekanbaru'}, ${dateLabel(r.data.date)}`:'Hormat kami,';ensure(10+lines({runs:[{text:closing}]},w).length*leading+84+leading*2);y-=10;
 simple(closing,{align:statement?'right':'left',space:0},{x,available:w});
 if(signature)page.drawImage(signature,{x:statement?right-105:left-6,y:y-88,width:105,height:105});y-=84;
 simple('Mulyadi',{align:statement?'right':'left',space:0,runs:[{text:'Mulyadi',bold:true}]},{x,available:w});simple('Direktur Yayasan Gambut',{align:statement?'right':'left',space:0},{x,available:w});
 doc.setTitle(r.data.subject);doc.setAuthor('Yayasan Gambut');return doc.save();
}
