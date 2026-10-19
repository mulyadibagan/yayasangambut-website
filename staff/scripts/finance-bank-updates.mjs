import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const cents=n=>Math.round(n*100);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const identity=r=>JSON.stringify([r.postedAt??r.date,r.reference,cents(r.debit),cents(r.credit)]);
const fail=()=>{throw Error('Private bank update failed validation; no financial data logged.');};

export function reconcileBankUpdates(bank, snapshot, updates){
 const b=structuredClone(bank),s=structuredClone(snapshot);
 if(!Array.isArray(updates)||updates.length>1000||b.mutations.length!==s.entries.length)fail();
 const additions=[];
 for(const u of structuredClone(updates)){
  const r=u.row;
  if(!r||!Number.isInteger(r.archiveIndex)||typeof r.postedAt!=='string'||typeof r.description!=='string'||typeof r.reference!=='string'||![r.debit,r.credit,r.balance].every(n=>Number.isFinite(n)&&n>=0)||!(r.debit>0 ^ r.credit>0)||!Array.isArray(u.allocations)||!u.allocations.length)fail();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(u.asOf)||typeof u.period!=='string'||typeof u.source!=='string'||typeof u.note!=='string')fail();
  if(u.allocations.some(a=>!(a.bucket==='STAFF_PENDING'||s.projects.some(p=>p.key===a.bucket))||!Number.isFinite(a.amount))||u.allocations.reduce((n,a)=>n+cents(a.amount),0)!==cents(r.credit)-cents(r.debit))fail();
  if(new Set(u.allocations.map(a=>a.bucket)).size!==u.allocations.length)fail();
  if(r.evidence?.some(e=>typeof e.label!=='string'||!/^https:\/\/(drive|docs)\.google\.com\//.test(e.url)))fail();
  const matches=b.mutations.filter(x=>identity(x)===identity(r));
  if(matches.length){
   const e=s.entries.find(x=>x.index===r.archiveIndex),old=matches[0];
   if(matches.length!==1||old.archiveIndex!==r.archiveIndex||old.description!==r.description||cents(old.balance)!==cents(r.balance)||!e||!same(e.bankAllocations??e.allocations,u.allocations))fail();
   continue;
  }
  if(r.archiveIndex!==b.mutations.length||u.expectedCount!==b.mutations.length||cents(u.expectedBalance)!==cents(b.closingBalance)||cents(r.balance)!==cents(b.closingBalance)+cents(r.credit)-cents(r.debit)||u.asOf<s.asOf)fail();
  b.mutations.push(r);additions.push(r);
  s.entries.push({index:r.archiveIndex,date:r.postedAt,description:r.description,reference:r.reference,debit:r.debit,credit:r.credit,balance:r.balance,allocations:u.allocations});
  for(const a of u.allocations){
   if(a.bucket==='STAFF_PENDING'){
    s.pendingStaffCash=(cents(s.pendingStaffCash)+cents(a.amount))/100;
    continue;
   }
   const p=s.projects.find(p=>p.key===a.bucket);
   const before=cents(p.balance),after=before+cents(a.amount);
   const outstandingBefore=Math.max(0,-before),outstandingAfter=Math.max(0,-after);
   const recovered=Math.max(0,outstandingBefore-outstandingAfter);
   const issued=Math.max(0,outstandingAfter-outstandingBefore);
   if(recovered||issued){
    // Trace metadata only: the receipt is already in the project allocation.
    // An additional transfer to YG here would repay the same advance twice.
    s.projectAdvanceMovements??=[];
    const id=`bank:${r.archiveIndex}:${a.bucket}`;
    if(s.projectAdvanceMovements.some(m=>m.id===id))fail();
    s.projectAdvanceMovements.push({id,bankIndex:r.archiveIndex,project:a.bucket,date:r.postedAt,reference:r.reference,before:before/100,after:after/100,recovered:recovered/100,issued:issued/100});
   }
   p.incoming=(cents(p.incoming||0)+Math.max(cents(a.amount),0))/100;
   p.outgoing=(cents(p.outgoing||0)+Math.max(-cents(a.amount),0))/100;
   p.balance=(cents(p.balance)+cents(a.amount))/100;
   if(Array.isArray(p.bankIndexes))p.bankIndexes.push(r.archiveIndex);
   if(Number.isInteger(p.bankTransactionCount))p.bankTransactionCount++;
  }
  s.bankDebit=(cents(s.bankDebit)+cents(r.debit))/100;s.bankCredit=(cents(s.bankCredit)+cents(r.credit))/100;
  s.projectCash=(cents(s.projectCash)+u.allocations.filter(a=>a.bucket!=='STAFF_PENDING').reduce((n,a)=>n+cents(a.amount),0))/100;
  s.calculated=(cents(s.calculated)+cents(r.credit)-cents(r.debit))/100;
  s.bankClosing=r.balance;s.transactionCount=s.entries.length;s.difference=(cents(s.bankClosing)-cents(s.calculated))/100;
  if(s.difference!==0||cents(s.bankOpening)+cents(s.bankCredit)-cents(s.bankDebit)!==cents(s.bankClosing))fail();
  s.asOf=u.asOf;s.findings=[u.note,...(s.findings||[])];
  b.closingBalance=r.balance;b.period=u.period;b.source=u.source;
 }
 return {bank:b,snapshot:s,additions};
}

export async function applyPrivateBankUpdates(root, updates){
 if(!updates.length)return;
 const bankPath=resolve(root,'app/bank-statement-2026.ts');
 const snapshotPath=resolve(root,'app/closing-august-2026.json');
 const bank=(await import(pathToFileURL(bankPath).href)).bankStatement2026;
 const snapshot=JSON.parse(await readFile(snapshotPath,'utf8'));
 const result=reconcileBankUpdates(bank,snapshot,updates);
 if(!result.additions.length)return;
 const original=await readFile(bankPath,'utf8');
 // Values exist only in the decrypted, private build directory, never in Git or logs.
 const payload={closingBalance:result.bank.closingBalance,period:result.bank.period,source:result.bank.source};
 const appended='\n// Authorized private bank statement additions.\nObject.assign(bankStatement2026,'+JSON.stringify(payload)+');\nbankStatement2026.mutations.push(...'+JSON.stringify(result.additions)+');\n';
 await writeFile(bankPath,original+appended);
 await writeFile(snapshotPath,JSON.stringify(result.snapshot,null,2)+'\n');
 console.log('Private bank updates validated: identities, allocations, and balance reconcile.');
}
