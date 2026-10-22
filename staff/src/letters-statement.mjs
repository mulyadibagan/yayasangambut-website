import {cleanDocument,documentText,para} from '../public/letter-content.js';

export const STATEMENT_LAYOUT='statement-v1';
export const layoutFor=r=>r.data.kind==='PNY'?STATEMENT_LAYOUT:'formal-v3';

// A rendition changes presentation only. Never write this projection into the
// issued surat_annual row, or replace its original body/final object keys.
export function statementData(data){
 if(data.kind!=='PNY')return data;
 if(data.bodyFormat==='rich-v1')return {...data,bodyDoc:cleanDocument(data.bodyDoc)};
 const lines=data.body.split(/\r?\n/),blocks=[];
 const identity=line=>line.match(/^(Nama|Jabatan|Lembaga|Alamat)\s*:\s*(.*)$/);
 const numbered=line=>line.match(/^(\d{1,3})\.\s+(.*)$/);
 for(let i=0;i<lines.length;i++){
  if(!lines[i].trim())continue;
  if(identity(lines[i])){const rows=[];do{const m=identity(lines[i]);rows.push([[para(m[1],{space:0})],[para(':',{space:0})],[para(m[2],{space:0})]]);i++;}while(i<lines.length&&rows.length<40&&identity(lines[i]));i--;blocks.push({type:'table',border:'none',widths:[20,3,77],rows});continue;}
  const first=numbered(lines[i]);if(first){const items=[],start=Number(first[1]);let expected=start;
   while(i<lines.length&&items.length<150){const m=numbered(lines[i]);if(!m||Number(m[1])!==expected)break;items.push(para(m[2],{align:'justify'}));expected++;i++;}i--;blocks.push({type:'list',ordered:true,start,items});continue;
  }
  blocks.push(para(lines[i],{align:blocks.length?'justify':'left'}));
 }
 const bodyDoc=cleanDocument({version:1,blocks});
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 if(normalize(documentText(bodyDoc))!==normalize(data.body))throw Error('Perapian harus mempertahankan seluruh redaksi surat.');
 return {...data,subject:data.subject.toLocaleUpperCase('id-ID'),bodyFormat:'rich-v1',bodyDoc,statementPlace:data.statementPlace||'Pekanbaru'};
}
