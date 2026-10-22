// Versioned, HTML-free document model shared by the editor and the server.
const alignments=new Set(['left','center','right','justify']);
export const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cleanDocument(value){
 if(!value||value.version!==1||!Array.isArray(value.blocks)||JSON.stringify(value).length>100000)throw Error('Format isi surat tidak valid.');
 let count=0,total=0;
 const tick=()=>{if(++count>1800)throw Error('Isi surat terlalu kompleks.');};
 function paragraph(p){tick();if(!p||p.type!=='paragraph'||!Array.isArray(p.runs)||p.runs.length>500)throw Error('Paragraf tidak valid.');
  const runs=p.runs.map(r=>{tick();if(!r||typeof r.text!=='string')throw Error('Teks tidak valid.');const text=r.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');total+=text.length;return {text,...(r.bold===true?{bold:true}:{}),...(r.italic===true?{italic:true}:{}),...(r.underline===true?{underline:true}:{})};});
  return {type:'paragraph',align:alignments.has(p.align)?p.align:'left',indent:Number.isInteger(p.indent)?Math.max(0,Math.min(4,p.indent)):0,space:[0,6,12,18].includes(p.space)?p.space:6,runs};
 }
 const blocks=value.blocks.map(b=>{tick();if(b?.type==='paragraph')return paragraph(b);
  if(b?.type==='list'&&Array.isArray(b.items)&&b.items.length<=150)return {type:'list',ordered:b.ordered===true,start:Number.isInteger(b.start)?Math.max(1,Math.min(999,b.start)):1,items:b.items.map(paragraph)};
  if(b?.type==='table'&&Array.isArray(b.rows)&&b.rows.length>0&&b.rows.length<=40){const cols=b.rows[0]?.length;if(!Number.isInteger(cols)||cols<2||cols>6)throw Error('Tabel harus memiliki 2 sampai 6 kolom.');
   const widths=Array.isArray(b.widths)&&b.widths.length===cols&&b.widths.every(w=>Number.isFinite(w)&&w>=2&&w<=96)?b.widths:Array(cols).fill(100/cols);
   return {type:'table',border:b.border==='none'?'none':'grid',widths:widths.map(w=>w/widths.reduce((a,n)=>a+n,0)*100),rows:b.rows.map(row=>{if(!Array.isArray(row)||row.length!==cols)throw Error('Jumlah kolom tabel tidak konsisten.');return row.map(cell=>{if(!Array.isArray(cell)||!cell.length||cell.length>30)throw Error('Sel tabel tidak valid.');return cell.map(paragraph);});})};
  }throw Error('Elemen isi surat tidak diizinkan.');
 });
 if(total>18000)throw Error('Isi surat maksimal 18000 karakter.');
 return {version:1,blocks};
}
export const para=(text='',attrs={})=>({type:'paragraph',align:'left',indent:0,space:6,runs:[{text}],...attrs});
export function plainDocument(text){
 const blocks=[],lines=String(text??'').split('\n');if(lines.length>150)return cleanDocument({version:1,blocks:[para(String(text??''),{align:'justify',space:0})]});const bank=line=>line.match(/^(Nama pemilik rekening|Nama bank|Cabang|Nomor rekening|Alamat cabang bank)\s*:\s*(.*)$/);
 for(let i=0;i<lines.length;i++){const m=bank(lines[i]);if(m){const rows=[];do{const f=bank(lines[i]);rows.push([[para(f[1],{space:0})],[para(':',{space:0})],[para(f[2],{space:0})]]);i++;}while(rows.length<40&&i<lines.length&&bank(lines[i]));i--;blocks.push({type:'table',border:'none',widths:[26.6,2.2,71.2],rows});}else blocks.push(para(lines[i],{align:'justify',space:lines[i]?0:6}));}
 return cleanDocument({version:1,blocks});
}
export function documentText(doc){return cleanDocument(doc).blocks.map(b=>b.type==='paragraph'?b.runs.map(r=>r.text).join(''):b.type==='list'?b.items.map((p,i)=>(b.ordered?(b.start+i)+'. ':'- ')+p.runs.map(r=>r.text).join('')).join('\n'):b.rows.map(row=>row.map(cell=>cell.map(p=>p.runs.map(r=>r.text).join('')).join('\n')).join(' ')).join('\n')).join('\n');}
export function documentHtml(doc){
 const p=(p,tag='p')=>`<${tag} data-align="${p.align}" data-indent="${p.indent}" data-space="${p.space}">${p.runs.map(r=>{let t=escapeText(r.text).replaceAll('\n','<br>');if(r.underline)t='<u>'+t+'</u>';if(r.italic)t='<em>'+t+'</em>';if(r.bold)t='<strong>'+t+'</strong>';return t;}).join('')||'<br>'}</${tag}>`;
 return cleanDocument(doc).blocks.map(b=>b.type==='paragraph'?p(b):b.type==='list'?`<${b.ordered?'ol':'ul'}${b.ordered?` start="${b.start}"`:''}>${b.items.map(i=>p(i,'li')).join('')}</${b.ordered?'ol':'ul'}>`:`<table data-border="${b.border}"><colgroup>${b.widths.map(w=>`<col width="${w.toFixed(3)}%">`).join('')}</colgroup><tbody>${b.rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell.map(c=>p(c)).join('')+'</td>').join('')+'</tr>').join('')}</tbody></table>`).join('');
}
