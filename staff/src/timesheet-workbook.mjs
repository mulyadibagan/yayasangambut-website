import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
const bad=message=>{throw new Error(message);};
const decode=s=>String(s).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const attr=(s,k)=>decode(new RegExp('(?:^|\\s)'+k+'="([^"]*)"').exec(s)?.[1]||'');
const texts=s=>[...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
const placeholder=name=>/^nama progr(?:am)?\.?$/i.test(name);
export const columnName=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
export function openTimesheet(bytes){
 if(bytes.length>4*1024*1024)bad('File timesheet melebihi 4 MB.');let total=0;
 const files=unzipSync(bytes,{filter:f=>{total+=f.originalSize;if(total>24*1024*1024||f.originalSize>12*1024*1024)bad('Isi workbook terlalu besar.');return true;}});
 const xml=p=>{if(!files[p])bad('Struktur Excel tidak dikenali.');const s=strFromU8(files[p]);if(/<!DOCTYPE|<!ENTITY/i.test(s))bad('XML eksternal tidak didukung.');return s;};
 const book=xml('xl/workbook.xml'),rels=xml('xl/_rels/workbook.xml.rels');
 const strings=files['xl/sharedStrings.xml']?[...xml('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1])):[];
 const relationships=new Map([...rels.matchAll(/<Relationship\s([^>]*?)\/?\s*>/g)].map(m=>[attr(m[1],'Id'),attr(m[1],'Target')]));
 const sheets=[...book.matchAll(/<sheet\s([^>]*?)\/?\s*>/g)].map(m=>{
  const target=relationships.get(attr(m[1],'r:id'));if(!target||!/^\/?(?:xl\/)?worksheets\/sheet\d+\.xml$/.test(target))bad('Lokasi lembar Excel tidak didukung.');
  const path=target.startsWith('/xl/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target,source=xml(path),cells=new Map();
  for(const c of source.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=attr(c[1],'r'),body=c[2]||'',type=attr(c[1],'t'),raw=decode(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1]||'');
   cells.set(ref,{value:type==='s'?strings[+raw]??'':type==='inlineStr'?texts(body):raw,formula:/<f(?:\s|>)/.test(body),style:attr(c[1],'s')});
  }
  if(cells.get('A7')?.value!=='Tanggal'||cells.get('B7')?.value!=='Kegiatan'||cells.get('O7')?.value!=='Total Work')bad('Header template timesheet tidak cocok.');
  const columns={};for(let i=3;i<=14;i++){const name=cells.get(columnName(i)+'8')?.value.trim();if(name&&!placeholder(name)){if(columns[name])bad('Kolom program ganda.');columns[name]=columnName(i);}}
  const dates=new Map();for(const [ref,c] of cells){if(!/^A\d+$/.test(ref)||c.formula||!/^\d+(?:\.0+)?$/.test(c.value)||+c.value<40000)continue;const iso=new Date(Date.UTC(/date1904="(?:1|true)"/.test(book)?1904:1899,/date1904="(?:1|true)"/.test(book)?0:11,/date1904="(?:1|true)"/.test(book)?1:30)+Number(c.value)*86400000).toISOString().slice(0,10);if(dates.has(iso))bad('Tanggal ganda pada template.');dates.set(iso,+ref.slice(1));}
  return {name:attr(m[1],'name'),path,source,cells,columns,dates};
 });
 if(!sheets.length)bad('Lembar timesheet kosong.');return {files,sheets};
}
export function programColumn(program,columns){
 if(!program&&columns.Unallocated)return 'Unallocated';
 if(columns[program])return program;
 if(/april|agroforestri.*dayun/i.test(program)&&columns['APRIL-DAYUN'])return 'APRIL-DAYUN';
 if(/\bjpik\b/i.test(program)&&columns.JPIK)return 'JPIK';return null;
}
export function collectTimesheetSources(tasks,agendas){
 const rows=[];
 for(const t of tasks)rows.push({id:'task:'+t.id,date:t.due_date,program:t.program,title:'[Task deadline · execution unconfirmed] '+t.title});
 for(const a of agendas){if(a.status==='cancelled')continue;const start=a.start_at.slice(0,10),end=a.end_at.slice(0,10);let count=0;for(let day=start;day<=end;day=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10)){if(++count>366)bad('Rentang agenda terlalu panjang.');rows.push({id:'agenda:'+a.id,date:day,program:a.program,title:(a.status==='done'?'[Confirmed agenda] ':a.status==='ongoing'?'[Confirmed agenda] ':'[Planned] ')+a.title});}}
 for(const row of rows){
  if(!row.id.startsWith('agenda:'))continue;
  const agenda=agendas.find(a=>'agenda:'+a.id===row.id),start=agenda.start_at,end=agenda.end_at;
  const minute=value=>Number(value.slice(11,13))*60+Number(value.slice(14,16));
  row.startMinute=row.date===start.slice(0,10)?minute(start):0;
  row.endMinute=row.date===end.slice(0,10)?minute(end):1440;
  row.defaultHours=!start.includes('T')||!end.includes('T')||start===end||start.slice(11)==='00:00'&&end.slice(11)==='00:00';
  // A multi-day daytime agenda repeats its working window each calendar day.
  // Overnight windows still split at midnight rather than becoming 24h shifts.
  if(start.slice(0,10)!==end.slice(0,10)&&minute(end)>minute(start)){row.startMinute=minute(start);row.endMinute=minute(end);}
 }
 return rows;
}
// Allocate each occupied minute once, sharing overlap across its programs.
// Untimed agendas share only the remainder of an eight-hour daily allowance.
export function automaticAgendaHours(sources){
 const agendas=sources.filter(s=>s.id.startsWith('agenda:')),minutes=new Map(),untimed=new Set();let occupied=0;
 for(const s of agendas)if(s.defaultHours)untimed.add(s.program||'');
 for(let minute=0;minute<1440;minute++){
  const programs=[...new Set(agendas.filter(s=>!s.defaultHours&&s.startMinute<=minute&&s.endMinute>minute).map(s=>s.program||''))];
  if(!programs.length)continue;occupied++;for(const program of programs)minutes.set(program,(minutes.get(program)||0)+1/programs.length);
 }
 if(untimed.size)for(const program of untimed)minutes.set(program,(minutes.get(program)||0)+Math.max(0,480-occupied)/untimed.size);
 let rounded=0;const result=[];for(const [program,value] of [...minutes].sort(([a],[b])=>a.localeCompare(b))){const next=Math.round((rounded+value/60)*100)/100;result.push({program,hours:Math.round((next-rounded)*100)/100});rounded=next;}
 return result;
}
function setCell(xml,ref,value,style){
 const number=typeof value==='number',cell='<c r="'+ref+'"'+(style?' s="'+style+'"':'')+(number?'><v>'+value+'</v>':' t="inlineStr"><is><t xml:space="preserve">'+escape(value)+'</t></is>')+'</c>';
 const re=new RegExp('<c\\b(?=[^>]*\\br="'+ref+'")([^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)');
 if(re.test(xml))return xml.replace(re,()=>cell);
 const row=ref.replace(/^[A-Z]+/,'');let found=false;xml=xml.replace(new RegExp('(<row\\b(?=[^>]*\\br="'+row+'")[^>]*>)([\\s\\S]*?)(<\\/row>)'),(_,a,b,c)=>{found=true;return a+b+cell+c;});if(!found)bad('Baris tanggal Excel tidak ditemukan.');return xml;
}
export function patchTimesheet(bytes,sources,entries,managed={},today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'})){
 const book=openTimesheet(bytes),next={},changes=[],skippedManual=[];let outside=0;const unresolved=new Set();
 const originalTotals=new Map(book.sheets.flatMap(sheet=>Array.from({length:12},(_,i)=>{const col=columnName(i+3);return [sheet.path+'|'+col+'6',[...sheet.dates.values()].reduce((sum,row)=>sum+Number(sheet.cells.get(col+row)?.value||0),0)/8];})));
 const canonical=program=>/april|agroforestri.*dayun/i.test(program)?'APRIL-DAYUN':/\bjpik\b/i.test(program)?'JPIK':program?.trim()||'Unallocated';
 // Use only unused program columns; never rename a real program or a column
 // containing hours. Missing agenda programs remain explicitly Unallocated.
 for(const source of sources.filter(s=>s.id.startsWith('agenda:'))){const sheet=book.sheets.find(s=>s.dates.has(source.date));if(!sheet||programColumn(source.program,sheet.columns))continue;const name=canonical(source.program);if(sheet.columns[name])continue;const col=Array.from({length:12},(_,i)=>columnName(i+3)).find(col=>{const header=sheet.cells.get(col+'8');return !header?.formula&&(!header?.value||placeholder(header.value))&&[...sheet.dates.values()].every(row=>{const cell=sheet.cells.get(col+row);return !cell?.formula&&(!cell?.value||Number(cell.value)===0);});});if(!col)bad('Tidak tersedia kolom program kosong untuk '+name);const ref=col+'8',cell=sheet.cells.get(ref),key=sheet.path+'|'+ref;sheet.source=setCell(sheet.source,ref,name,cell?.style);sheet.cells.set(ref,{...cell,value:name});sheet.columns[name]=col;next[key]=name;changes.push(key);}
 const groups=new Map();for(const source of sources){const sheet=book.sheets.find(s=>s.dates.has(source.date));if(!sheet){outside++;continue;}const key=sheet.path+':'+source.date;const group=groups.get(key)||{sheet,date:source.date,sources:[],entries:[]};group.sources.push(source);groups.set(key,group);if(!programColumn(source.program,sheet.columns))unresolved.add(source.program||'Belum ditentukan');}
 for(const entry of entries){const sheet=book.sheets.find(s=>s.dates.has(entry.work_date));if(!sheet)bad('Tanggal aktual tidak tersedia pada template.');if(!sheet.columns[entry.program])bad('Program aktual belum cocok dengan kolom Excel.');const key=sheet.path+':'+entry.work_date,group=groups.get(key)||{sheet,date:entry.work_date,sources:[],entries:[]};group.entries.push(entry);groups.set(key,group);}
 for(const key of Object.keys(managed)){const [path,ref]=key.split('|'),sheet=book.sheets.find(s=>s.path===path);const date=sheet&&[...sheet.dates].find(([,n])=>n===+ref.replace(/^[A-Z]+/,''))?.[0];if(date&&!groups.has(path+':'+date))groups.set(path+':'+date,{sheet,date,sources:[],entries:[]});}
 const write=(s,ref,value)=>{const key=s.path+'|'+ref,current=s.cells.get(ref);if(current?.formula)bad('Sel tujuan memiliki rumus: '+ref);const previous=managed[key];if(previous===undefined&&current?.value!==''&&current?.value!==undefined&&current?.value!=='0'&&String(value)!==current.value)bad('Sel '+ref+' sudah diisi manual. Periksa sebelum sinkronisasi.');if(previous!==undefined&&String(current?.value??'')!==String(previous)&&String(current?.value??'')!==String(value))bad('Sel '+ref+' berubah manual. Sinkronisasi dihentikan.');next[key]=String(value);if(String(current?.value??'')===String(value))return;s.source=setCell(s.source,ref,value,current?.style);s.cells.set(ref,{...current,value:String(value)});changes.push(key);};
 for(const {sheet,date,sources:planned,entries:actual} of groups.values()){
  // Explicit actual entries replace the day's agenda estimate, avoiding double counting.
  const automatic=actual.length?[]:automaticAgendaHours(planned),automaticByProgram=new Map();
  for(const entry of automatic){const program=programColumn(entry.program,sheet.columns)||canonical(entry.program);if(sheet.columns[program])automaticByProgram.set(program,(automaticByProgram.get(program)||0)+entry.hours);}
  const row=sheet.dates.get(date),sum=actual.reduce((n,e)=>n+Number(e.hours),0);if(sum>24)bad('Total jam aktual per hari melebihi 24 jam.');
  const pending=planned.filter(s=>!actual.some(e=>e.activity===s.title.replace(/^\[[^\]]*\]\s*/,'')&&e.program===programColumn(s.program,sheet.columns)));
  const descriptions=[...new Set([...actual.map(e=>'[Actual · '+e.program+'] '+e.activity),...pending.map(s=>(s.id.startsWith('agenda:')?s.title.replace(/^\[[^\]]*\]/,date>today?'[Planned]':'[Agenda]'):s.title)+(s.program?' · '+s.program:'')),...automatic.map(e=>'['+(date>today?'Planned hours':'Agenda hours')+' · '+(e.program||'Program mapping required')+'] '+e.hours+' hours')])].join('\n');if(descriptions.length>30000)bad('Uraian kegiatan terlalu panjang.');
  if(!actual.length){
   const key=sheet.path+'|B'+row,cell=sheet.cells.get('B'+row),textConflict=cell?.value&&cell.value!=='0'&&cell.value!==descriptions&&(!(key in managed)||cell.value!==String(managed[key]));
   const hoursConflict=Object.values(sheet.columns).some(col=>{const key=sheet.path+'|'+col+row,cell=sheet.cells.get(col+row);return !cell?.formula&&((Number(cell?.value||0)>0&&!(key in managed))||(key in managed&&String(cell?.value??'')!==String(managed[key])));});
   if(textConflict||hoursConflict){skippedManual.push({date,sheet:sheet.name});for(const [key,value] of Object.entries(managed)){const [path,ref]=key.split('|');if(path===sheet.path&&Number(ref.replace(/^[A-Z]+/,''))===row)next[key]=value;}continue;}
  }
  write(sheet,'B'+row,descriptions);
  for(const [program,col] of Object.entries(sheet.columns)){const records=actual.filter(e=>e.program===program),key=sheet.path+'|'+col+row,auto=date<=today?automaticByProgram.get(program)||0:0;if(records.length||auto||key in managed)write(sheet,col+row,records.length?records.reduce((n,e)=>n+Number(e.hours),0):auto);}
  // Preserve every formula, including the template's Total Work and summary cells.
  // Confirmed-hour totals are written only to literal totals, never over formulas.
  if(actual.length||date<=today&&automatic.length||sheet.path+'|O'+row in managed){const total=Array.from({length:12},(_,i)=>Number(sheet.cells.get(columnName(i+3)+row)?.value||0)).reduce((a,b)=>a+b,0);if(!Number.isFinite(total)||total>24)bad('Total jam termasuk isian manual melebihi 24 jam.');if(!sheet.cells.get('O'+row)?.formula)write(sheet,'O'+row,total);}
 }
 for(const sheet of book.sheets)for(const [program,col] of Object.entries(sheet.columns)){if(Object.keys(next).some(k=>k.startsWith(sheet.path+'|'+col))||entries.some(e=>e.program===program&&sheet.dates.has(e.work_date))||sheet.path+'|'+col+'6' in managed){if(!sheet.cells.get(col+'6')?.formula){const key=sheet.path+'|'+col+'6',current=sheet.cells.get(col+'6');if(!(key in managed)&&current?.value&&Number(current.value)===originalTotals.get(key))managed[key]=current.value;const total=[...sheet.dates.values()].reduce((sum,row)=>sum+Number(sheet.cells.get(col+row)?.value||0),0);write(sheet,col+'6',total/8);}}}
 for(const sheet of book.sheets)if(changes.some(k=>k.startsWith(sheet.path+'|')))book.files[sheet.path]=strToU8(sheet.source);
 if(changes.length){let bookXml=strFromU8(book.files['xl/workbook.xml']);bookXml=bookXml.replace(/<calcPr\b[^>]*\/>/,'<calcPr fullCalcOnLoad="1" forceFullCalc="1"/>');book.files['xl/workbook.xml']=strToU8(bookXml);}
 return {bytes:changes.length?zipSync(book.files):bytes,managed:next,changes:changes.length,outside,skippedManual,unresolved:[...unresolved],sheets:book.sheets.map(s=>({name:s.name,programs:Object.keys(s.columns)}))};
}
