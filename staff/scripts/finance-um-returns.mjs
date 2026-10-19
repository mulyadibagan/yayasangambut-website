const fail=()=>{throw Error('UM return does not match its bank entry, project and report.');};
const cents=n=>{if(!Number.isFinite(n))fail();return Math.round(n*100);};
const aliases={ARC3:['Aramco Phase 3','Aramco Phase III'],SPMCLS:['SPM-CLS','SPM-CLS Riau','SPM-CLS 2026'],SPM25:['SPM 2025'],MAEARTH:['MaEarth','MA Earth'],PPCF:['PPCF'],PENABULU:['Penabulu','Penabulu Small Grants'],RESTO:['Restorasi Imbo Putui','Restorasi Imbo Putuih'],CORE25:['Core Fund 2025'],CORE26:['Core Fund 2026'],BPDPKS:['BPDPKS']};
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function belongs(record,project){return [project,...(aliases[project]||[])].some(name=>normalize(name)===normalize(record.project))||normalize(record.projectCode)===normalize(project);}

// Metadata projection only: the bank allocation has already restored project
// cash (and its advance). Never post a second receipt from the PJUM balance.
export function reconcileUmReturns(records,ledger,links=[]){
 if(!Array.isArray(links))fail();
 const result=structuredClone(records),byId=new Map(result.map(r=>[r.id,r]));
 const seen=new Set(),byBank=new Map(),byReport=new Map();
 for(const link of links){
  if(typeof link.evidenceUrl!=='string'||!/^https:\/\/(drive|docs)\.google\.com\//.test(link.evidenceUrl))fail();
  const key=`${link.index}:${link.pjumId}`;
  if(seen.has(key))fail();seen.add(key);
  const entry=ledger.entries.find(e=>e.index===link.index),um=byId.get(link.umId),report=byId.get(link.pjumId);
  if(records.filter(r=>r.id===link.umId).length!==1||records.filter(r=>r.id===link.pjumId).length!==1)fail();
  if(!entry||entry.reference!==link.reference||entry.date!==link.date||entry.debit!==0||entry.credit<=0||cents(link.amount)<=0||!um||um.type!=='UM'||!report||report.type!=='PJUM'||report.parentUmId!==um.id||['Ditolak','Dibatalkan'].includes(report.status)||['Ditolak','Dibatalkan'].includes(um.status)||!belongs(um,link.project)||!belongs(report,link.project)||!ledger.projects.some(p=>p.key===link.project))fail();
  if(um.bankStatus!=='Cocok'||!(um.bankAmount>0)||report.reportScope==='partial')fail();
  const bank=byBank.get(link.index)||new Map();bank.set(link.project,(bank.get(link.project)||0)+cents(link.amount));byBank.set(link.index,bank);
  const reports=byReport.get(report.id)||[];reports.push(link);byReport.set(report.id,reports);
 }
 for(const [index,amounts] of byBank){
  const entry=ledger.entries.find(e=>e.index===index);
  if([...amounts.values()].reduce((s,n)=>s+n,0)!==cents(entry.credit))fail();
  if(entry.allocations.length!==amounts.size||entry.allocations.some(a=>amounts.get(a.bucket)!==cents(a.amount)))fail();
 }
 for(const [id,receipts] of byReport){
  const report=byId.get(id),um=byId.get(report.parentUmId),total=receipts.reduce((s,l)=>s+cents(l.amount),0);
  // Links are the complete set of returns for this report, not an increment to
  // a cached bankAmount. Include earlier installments when appending a return.
  if(total>cents(report.balance)||total>cents(um.bankAmount)||total<cents(report.bankStatus==='Cocok'?(report.bankAmount||0):0))fail();
  report.bankAmount=total/100;report.bankStatus='Cocok';report.bankDate=receipts.map(r=>r.date).join(' & ');
  report.bankNote='Pengembalian cocok mutasi; sudah termasuk saldo proyek dan pemulihan talangan, tidak ditambahkan lagi.';
 }
 return result;
}

export function mergeUmReturnRegister(existing,links=[]){
 const keys={ARC3:'aramco',SPMCLS:'spm',SPM25:'spm25',MAEARTH:'maearth',PENABULU:'penabulu',PPCF:'ppcf'};
 const result=structuredClone(existing);
 for(const link of links){
  const id=`bank:${link.index}:${link.pjumId}`,project=keys[link.project]||link.project;
  const old=result.find(r=>r.bankReturnId===id||(!r.bankReturnId&&r.project===project&&r.evidenceUrl===link.evidenceUrl&&cents(r.amount)===cents(link.amount)));
  const row={bankReturnId:id,date:link.date,amount:link.amount,project,label:`Pengembalian ${link.pjumId}`,evidenceUrl:link.evidenceUrl,bankMatched:true};
  if(old)Object.assign(old,row);else result.push(row);
 }
 return result;
}

// Use only with the complete links already validated by the protected build.
// A filtered project/year view must not require unrelated UM rows to be present.
export function projectUmReturnMetadata(records,links=[]){
 return records.map(record=>{
  const receipts=links.filter(l=>l.pjumId===record.id);
  if(record.type!=='PJUM'||!receipts.length)return record;
  return {...record,bankAmount:receipts.reduce((n,l)=>n+cents(l.amount),0)/100,bankStatus:'Cocok',bankDate:receipts.map(l=>l.date).join(' & '),bankNote:'Pengembalian cocok mutasi; sudah termasuk saldo proyek dan pemulihan talangan, tidak ditambahkan lagi.'};
 });
}
