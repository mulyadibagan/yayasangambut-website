// Read-only cash report. Integer cents keep grouped totals identical to bank totals.
export const cents=n=>{if(!Number.isFinite(n)||n<0)throw Error('Invalid bank amount');return Math.round(n*100);};
export function isoDate(value){
 const s=String(value||'').trim();
 if(/^20\d{2}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const months=['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'];
 const m=s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})/);
 if(m){const key={may:'mei',aug:'agu',oct:'okt',dec:'des'}[m[2].slice(0,3)]||m[2].slice(0,3),month=months.indexOf(key)+1;if(month)return `${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`;}
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
   const date=isoDate(r.postedAt||r.date);if(date.slice(0,4)!==year)throw Error('Bank report year mismatch');
   const description=String(r.description||r.remark||'');
   const base={id:`${year}:${r.archiveIndex??i}`,date,year,month:date.slice(0,7),description,reference:String(r.reference||''),debit,credit,project:projectLabel(r.project||r.projectLabel||r.label||r.projectCode),evidence:(r.evidence||[]).filter(e=>/^https:\/\/(?:drive|docs)\.google\.com\//.test(e.url||''))};
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
  coverage.push({year,from:list.map(r=>r.date).sort()[0],to:list.map(r=>r.date).sort().at(-1),transactions:bank.mutations.filter(r=>r.debit||r.credit).length,opening,ending,incoming,outgoing,difference:ending-opening-incoming+outgoing});
 }
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));coverage.sort((a,b)=>a.year.localeCompare(b.year));
 for(let i=1;i<coverage.length;i++)coverage[i].carryDifference=coverage[i].opening-coverage[i-1].ending;
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Bank report identity duplicated');
 return {rows,coverage,from:rows[0]?.date,to:rows.at(-1)?.date};
}
export function summarize(rows,group='category'){
 const map=new Map();for(const row of rows){const key=row[group]||'Belum dialokasikan',v=map.get(key)||{label:key,incoming:0,outgoing:0,ids:new Set()};v.incoming+=row.credit;v.outgoing+=row.debit;v.ids.add(row.id.split(':').slice(0,2).join(':'));map.set(key,v);}
 return [...map.values()].map(({ids,...v})=>({...v,count:ids.size,net:v.incoming-v.outgoing})).sort((a,b)=>b.incoming+b.outgoing-a.incoming-a.outgoing||a.label.localeCompare(b.label));
}
