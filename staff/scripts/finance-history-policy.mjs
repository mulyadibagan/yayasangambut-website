// Read-only cash report. Integer cents keep grouped totals identical to bank totals.
export const cents=n=>{if(!Number.isFinite(n)||n<0)throw Error('Invalid bank amount');return Math.round(n*100);};
const calendar=s=>{const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Invalid calendar date');return s;};
export function isoDate(value,sourceYear){
 let s=String(value||'').trim();
 const short=s.match(/^(\d{1,2})([\s/-]+)([a-z]+|\d{1,2})([\s/-]+)(\d{2})$/i);
 if(short&&sourceYear&&String(sourceYear).endsWith(short[5]))s=short[1]+short[2]+short[3]+short[4]+sourceYear;
 if(/^20\d{2}-\d{2}-\d{2}/.test(s))return calendar(s.slice(0,10));
 const numeric=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](20\d{2})$/);
 if(numeric)return calendar(`${numeric[3]}-${numeric[2].padStart(2,'0')}-${numeric[1].padStart(2,'0')}`);
 const months=['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
 const m=s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})/);
 if(m){const key={may:'mei',aug:'agu',oct:'okt',dec:'des'}[m[2].slice(0,3)]||m[2].slice(0,3),month=months.indexOf(key)+1;if(month)return calendar(`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`);}
 throw Error('Bank report date needs an explicit adapter');
}
export function category(row){
 const s=[row.description,row.project,row.label].filter(Boolean).join(' ').toLowerCase();
 if(row.credit>0){
  if(/donasi|donat/.test(s))return 'Donasi';
  if(/sisa\s+(?:dana\s+)?um|pengembalian.*(?:um|uang muka)|(?:pj|p)um.*(?:sisa|kembali)|sisa.*pjum/.test(s))return 'Pengembalian uang muka';
  if(/angsuran|piutang|cicilan|pengembalian.*pinjaman/.test(s))return 'Pelunasan piutang';
  if(/pinjaman/.test(s))return 'Penerimaan pinjaman';
  if(/bunga|interest/.test(s))return 'Bunga bank';
  if(/pencairan|payment|pembayaran.*(?:global|gec)|termin|term\s*\d|grant|transfer dari wilmar/.test(s))return 'Penerimaan proyek';
  return 'Penerimaan lain / perlu klasifikasi';
 }
 if(/pajak.*bunga|biaya.*(?:adm|bank|cek|materai|meterai)|^pajak\b/.test(s))return 'Biaya dan pajak bank';
 if(/gaji|salary|payroll|\bthr\b/.test(s))return /peralatan|kantor.*dan|dan.*kantor/.test(s)?'Pengeluaran gabungan':'Gaji dan THR';
 if(/pinjaman|piutang/.test(s))return 'Pemberian pinjaman';
 if(/\bum\b|uang muka/.test(s))return 'Pencairan uang muka';
 if(/reimburse|penggantian/.test(s))return 'Penggantian biaya';
 if(/kantor|sewa|website|audit|peralatan|operasional|listrik|internet/.test(s))return 'Operasional lembaga';
 return 'Pengeluaran lain / perlu klasifikasi';
}
export function projectLabel(value){
 const s=String(value||'').trim(),k=s.toLowerCase().replace(/[\s_.-]+/g,'');
 const labels={arc3:'Aramco Phase 3',aramcophase3:'Aramco Phase 3',aramcophaseiii:'Aramco Phase 3',arc2:'Aramco Phase 2',aramcophase2:'Aramco Phase 2',aramcophaseii:'Aramco Phase 2',ppcf:'PPCF',spmcls:'SPM-CLS',spm25:'SPM 2025',spm2025:'SPM 2025',spm2024:'SPM 2024',penabulu:'Penabulu Small Grants',maearth:'MA Earth',core25:'Aliansi Kolibri · Core Fund 2025',core26:'Aliansi Kolibri · Core Fund 2026',resto:'Restorasi Imbo Putui',bpdpks:'BPDPKS',yg:'Operasional Yayasan',sav:'Operasional Yayasan',staff:'Gaji staf',staffpending:'Gaji staf · alokasi menunggu rincian',gaji:'Gaji staf'};
 return labels[k]||(!s||s==='–'||s==='-'?'Belum dialokasikan':s);
}
export function compileHistory(sources,closing){
 const seen=new Set(),rows=[],coverage=[];
 for(const source of sources){
  const bank=source.bank,year=String(source.year);
  if(!Array.isArray(bank.mutations)||!bank.mutations.length||seen.has(year))throw Error('Bank report source missing or duplicated');
  seen.add(year);
  for(const [i,r] of bank.mutations.entries()){
   const debit=cents(r.debit),credit=cents(r.credit);if(!debit&&!credit)continue;
   const rawDate=String(r.postedAt||r.date||'');let date='',dateIssue='';
   try{date=isoDate(rawDate,year);}catch(error){if(!source.allowUncertainDates)throw error;dateIssue='Tanggal sumber perlu verifikasi';}
   if(date&&date.slice(0,4)!==year){if(!source.allowUncertainDates)throw Error('Bank report year mismatch');dateIssue='Tahun pada tanggal berbeda dari tahun arsip';}
   const description=String(r.description||r.remark||'');
   const base={id:`${year}:${r.archiveIndex??i}`,date,rawDate,dateIssue,year,month:date&&!dateIssue?date.slice(0,7):year+' · Tanggal perlu verifikasi',description,reference:String(r.reference||''),debit,credit,project:projectLabel(r.project||r.projectLabel||r.label||r.projectCode),evidence:(r.evidence||[]).filter(e=>/^https:\/\/(?:drive|docs)\.google\.com\//.test(e.url||''))};
   const entry=year==='2026'?closing?.entries?.find(e=>e.index===(r.archiveIndex??i)):null;
   if(entry&&(cents(entry.debit)!==debit||cents(entry.credit)!==credit))throw Error('Bank report canonical link mismatch');
   const allocations=entry?.bankAllocations||entry?.allocations;
   const amount=credit||debit,sign=credit?1:-1;
   // Split only a genuine one-direction allocation. Reallocations never add cash flow.
   const splits=allocations?.filter(a=>a.amount!==0);
   if(splits?.length&&!(debit&&credit)&&splits.every(a=>Math.sign(a.amount)===sign)&&splits.reduce((n,a)=>n+Math.round(Math.abs(a.amount)*100),0)===amount){
    for(const [j,a] of splits.entries()){const part={...base,id:base.id+':'+j,debit:debit?Math.round(Math.abs(a.amount)*100):0,credit:credit?Math.round(Math.abs(a.amount)*100):0,project:projectLabel(a.bucket)};rows.push({...part,category:category({...part,debit:part.debit/100,credit:part.credit/100})});}
   }else rows.push({...base,category:category({...base,debit:debit/100,credit:credit/100})});
  }
  const list=rows.filter(r=>r.year===year),first=bank.mutations[0],last=bank.mutations.at(-1);
  const opening=Number.isFinite(bank.openingBalance)?Math.round(bank.openingBalance*100):Math.round((first.balance+first.debit-first.credit)*100);
  const ending=Number.isFinite(bank.closingBalance)?Math.round(bank.closingBalance*100):Math.round(last.balance*100);
  if(!Number.isSafeInteger(opening)||!Number.isSafeInteger(ending))throw Error('Bank report balance missing');
  const incoming=list.reduce((n,r)=>n+r.credit,0),outgoing=list.reduce((n,r)=>n+r.debit,0);
  const dated=list.filter(r=>r.date&&!r.dateIssue).map(r=>r.date).sort();
  coverage.push({year,from:dated[0]||'',to:dated.at(-1)||'',uncertainDates:list.filter(r=>r.dateIssue).length,transactions:bank.mutations.filter(r=>r.debit||r.credit).length,opening,ending,incoming,outgoing,difference:ending-opening-incoming+outgoing});
 }
 rows.sort((a,b)=>(a.date||a.year).localeCompare(b.date||b.year)||a.id.localeCompare(b.id));coverage.sort((a,b)=>a.year.localeCompare(b.year));
 for(let i=1;i<coverage.length;i++)coverage[i].carryDifference=coverage[i].opening-coverage[i-1].ending;
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Bank report identity duplicated');
 const dated=rows.filter(r=>r.date&&!r.dateIssue).map(r=>r.date).sort();
 return {rows,coverage,from:dated[0]||'',to:dated.at(-1)||''};
}
export function summarize(rows,group='category'){
 const map=new Map();for(const row of rows){const key=row[group]||'Belum dialokasikan',v=map.get(key)||{label:key,incoming:0,outgoing:0,ids:new Set()};v.incoming+=row.credit;v.outgoing+=row.debit;v.ids.add(row.id.split(':').slice(0,2).join(':'));map.set(key,v);}
 return [...map.values()].map(({ids,...v})=>({...v,count:ids.size,net:v.incoming-v.outgoing})).sort((a,b)=>b.incoming+b.outgoing-a.incoming-a.outgoing||a.label.localeCompare(b.label));
}
