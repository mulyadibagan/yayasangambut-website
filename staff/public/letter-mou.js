import {cleanDocument,plainDocument,para} from './letter-content.js';
export const isMou=data=>data.kind==='MOU'||data.kind==='PKS'&&/^nota\s+kesepahaman\b/i.test(data.subject||'');
export function mouDocument(data){
 const source=data.bodyFormat==='rich-v1'?cleanDocument(data.bodyDoc):plainDocument(data.body||'');
 const text=p=>p.runs.map(r=>r.text).join('');
 const blocks=source.blocks.map(b=>{
  if(b.type!=='paragraph')return b;const value=text(b).trim();
  if(/^(NOTA KESEPAHAMAN$|ANTARA |TENTANG |Nomor Yayasan Gambut:|PASAL \d+)/i.test(value))return {...b,align:'center',space:6,runs:b.runs.map(r=>({...r,bold:!/^Nomor /i.test(value)}))};
  return {...b,align:value?'justify':'left',space:6};
 });
 const first=blocks.findIndex(b=>b.type==='paragraph'&&text(b).trim()==='PIHAK PERTAMA');
 const second=blocks.findIndex((b,i)=>i>first&&b.type==='paragraph'&&text(b).trim()==='PIHAK KEDUA');
 if(first>=0&&second>first&&blocks.slice(first).every(b=>b.type==='paragraph')){
  const tail=blocks.slice(second+1).filter(b=>text(b).trim()),names=tail.findIndex(b=>text(b).trim()==='MULYADI');
  if(names>=0){
   const cell=values=>values.map((value,i)=>para(value,{align:'center',space:i===1?18:6,runs:[{text:value,bold:i===0||i===1||value==='MULYADI'||value==='[NAMA PENANDATANGAN BERWENANG]'}]}));
   const left=blocks.slice(first+1,second).map(text).filter(Boolean),right=tail.slice(0,names).map(text);
   const leftNames=tail.slice(names,names+2).map(text),rightNames=tail.slice(names+2).map(text);
   blocks.splice(first,blocks.length-first,{type:'table',border:'none',widths:[50,50],rows:[[cell(['PIHAK PERTAMA',...left,'','',...leftNames]),cell(['PIHAK KEDUA',...right,'','',...rightNames])]]});
  }
 }
 return cleanDocument({version:1,blocks});
}
