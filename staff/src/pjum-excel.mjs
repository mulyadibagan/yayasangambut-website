import {unzipSync,strFromU8} from 'fflate';
import {fail} from './core.mjs';
const decode=s=>String(s||'').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);/gi,e=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[e]||String.fromCodePoint(Math.min(0x10ffff,e.startsWith('&#x')?parseInt(e.slice(3,-1),16):Number(e.slice(2,-1))))));
const attr=(s,key)=>decode(s.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'))?.[1]||'');
const texts=s=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');

// Only the YG PJUM table is read. Macros, external links and formula evaluation
// are deliberately excluded; totals are recalculated from numeric factors.
export function importPjumExcel(bytes){
 if(bytes.length>5*1024*1024)fail(413,'Excel maksimal 5 MB.');
 let files,expanded=0;try{files=unzipSync(bytes,{filter:f=>{const keep=/^(?:xl\/(?:workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml))$/.test(f.name);if(keep){expanded+=f.originalSize;if(f.originalSize>8*1024*1024||expanded>16*1024*1024)throw Error('size');}return keep;}});}catch{fail(400,'Excel tidak valid atau terlalu besar.');}
 const doc=p=>{if(!files[p])fail(400,'Struktur Excel tidak lengkap.');const text=strFromU8(files[p]);if(/<!DOCTYPE|<!ENTITY/i.test(text))fail(400,'Deklarasi XML tidak didukung.');return text;};
 const ss=files['xl/sharedStrings.xml']?[...doc('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(x=>texts(x[1])):[];
 const workbook=doc('xl/workbook.xml');if(/date1904="(?:1|true)"/.test(workbook))fail(400,'Gunakan kalender Excel 1900.');
 const sheets=[...workbook.matchAll(/<sheet\s([^>]+)\/?\s*>/g)].map(m=>m[1]),relationships=[...doc('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s([^>]+)\/?\s*>/g)].map(m=>m[1]);
 const readSheet=sheet=>{const rel=relationships.find(r=>attr(r,'Id')===attr(sheet,'r:id'));
 const target=attr(rel||'','Target');if(!/^\/?(?:xl\/)?worksheets\/sheet\d+\.xml$/.test(target))fail(400,'Lokasi sheet tidak didukung.');
 return new Map([...doc(target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target).matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c=>{const content=c[2]||'',v=content.match(/<v>([^<]*)<\/v>/)?.[1];return [attr(c[1],'r'),attr(c[1],'t')==='s'?ss[Number(v)]:attr(c[1],'t')==='inlineStr'?texts(content):v];}));};
 const sheet=sheets.find(s=>attr(s,'name').toUpperCase()==='PJUM');if(!sheet)fail(400,'Sheet PJUM tidak ditemukan.');const cells=readSheet(sheet),pumSheet=sheets.find(s=>['PUM','UM'].includes(attr(s,'name').toUpperCase())),pum=pumSheet?readSheet(pumSheet):null;
 const get=(col,r)=>cells.get(col+r),items=[],warnings=[];let activity='';
 for(let r=1;r<=2000;r++){
  const code=String(get('A',r)||'').trim().match(/^(\d+(?:\.\d+)+)\.?(?:\s|$)/);if(code)activity=code[1];
  if(!/^\d+(?:\.\d+)?$/.test(get('A',r)||'')||!get('B',r))continue;
  const serial=Number(get('A',r));if(serial<36526||serial>73050)continue;
  if(!get('K',r))fail(400,'Nomor kuitansi belum diisi pada baris '+r+'.');
  const description=String(get('B',r)),rate=Number(get('C',r)),quantity=Number(get('D',r)||1),times=Number(get('F',r)||1),days=Number(get('H',r)||1),subtotal=Math.round(rate*quantity*times*days);
  if(!Number.isSafeInteger(subtotal)||subtotal<0)fail(400,'Nominal Excel tidak valid pada baris '+r+'.');
  if(Number(get('J',r))!==subtotal)fail(400,'Jumlah Excel berbeda dari faktor biaya pada baris '+r+'. Periksa rumusnya.');
  const recipient=description.match(/a\.n\.?\s+(.+?)(?=\s+desa\b|$)/i)?.[1]||'';
  items.push({date:new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10),description,rate,quantity,times,days,unit:String(get('E',r)||'unit'),activity_code:activity,subtotal,receipt_no:String(get('K',r)).trim(),recipient,file_id:'',page:items.length+1});
 }
 if(!items.length||items.length>100)fail(400,'Tidak ditemukan 1–100 rincian bertanggal dengan kolom No Receipt pada sheet PJUM.');
 const numbers=items.map(i=>i.receipt_no.toLowerCase());if(new Set(numbers).size!==numbers.length)fail(400,'Nomor kuitansi pada Excel berulang.');
 warnings.push('Nomor halaman awal mengikuti urutan rincian. Periksa terhadap PDF sebelum mengirim.');
 const clean=v=>String(v||'').replace(/^:\s*/,'').trim(),rawDate=clean(cells.get('B77')).replace(/^Tgl\s*:?\s*/i,''),months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'],match=rawDate.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})$/),month=match?months.indexOf(match[2])+1:0;
 const report_date=match&&month?`${match[3]}-${String(month).padStart(2,'0')}-${match[1].padStart(2,'0')}`:'';
 return {items,total:items.reduce((n,i)=>n+i.subtotal,0),um_number:clean(pum?.get('B6')),report_number:clean(cells.get('B9')),report_date,warnings};
}
