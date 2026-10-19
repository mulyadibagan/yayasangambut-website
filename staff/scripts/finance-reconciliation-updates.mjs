import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const cents=n=>Math.round(Number(n)*100);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sameRow=(a,b)=>a&&['savingId','staff','expenseDate','year','claimAmount','paidAmount','usageAmount','carryForward','sourceType','sourceUrl'].every(k=>a[k]===b[k]);
const fail=()=>{throw Error('Private reconciliation rejected; financial values are not logged.');};
const sum=(rows,key)=>rows.reduce((n,r)=>n+cents(r[key]||0),0)/100;

// Reclassify existing bank entries, never append a bank transaction.
export function reconcileStaffAllocations(closing,salary,updates){
 const c=structuredClone(closing),s=structuredClone(salary);
 if(!Array.isArray(updates)||updates.length>1000)fail();
 const seen=new Set();
 for(const u of updates){
  if(seen.has(u.index))fail();seen.add(u.index);
  const e=c.entries.find(e=>e.index===u.index);
  if(!e||e.reference!==u.reference||e.date!==u.date||cents(e.debit)!==cents(u.debit)||cents(e.credit)!==cents(u.credit)||!Array.isArray(u.rows)||!u.rows.length)fail();
  if(u.allocations!==undefined&&(!Array.isArray(u.allocations)||new Set(u.allocations.map(a=>a.bucket)).size!==u.allocations.length||u.allocations.some(a=>!['STAFF','YG'].includes(a.bucket)||!Number.isFinite(a.amount))||cents(sum(u.allocations,'amount'))!==cents(e.credit)-cents(e.debit)))fail();
  if(sum(u.rows,'paidAmount')!==e.debit||sum(u.rows,'claimAmount')!==e.credit)fail();
  const ids=new Set();
  for(const r of u.rows){
   if(!r.savingId||ids.has(r.savingId)||!c.staff.some(x=>x.name===r.staff)||r.currency!=='IDR'||r.status!=='AVAILABLE'||!r.sourceDescription||!r.sourceUrl||![r.claimAmount,r.paidAmount,r.usageAmount,r.carryForward].every(n=>Number.isFinite(n)&&n>=0)||r.usageAmount||r.carryForward)fail();
   ids.add(r.savingId);
   if(!['PAYMENT_CONFIRMED','DONATION_CONFIRMED','SALARY_CONFIRMED'].includes(r.sourceType))fail();
  }
  const existing=u.rows.map(r=>s.rows.find(x=>x.savingId===r.savingId));
  if((u.allocations===undefined&&!e.allocations.some(a=>a.bucket==='STAFF_PENDING'))||same(e.allocations,u.allocations)){
   if(existing.some((r,i)=>!sameRow(r,u.rows[i])))fail();
   continue;
  }
  if(!same(e.allocations,[{bucket:'STAFF_PENDING',amount:e.credit-e.debit}])||existing.some(Boolean))fail();
  for(const r of u.rows){
   if(s.rows.some(x=>x.staff===r.staff&&x.expenseDate===r.expenseDate&&cents(x.claimAmount)===cents(r.claimAmount)&&cents(x.paidAmount)===cents(r.paidAmount)))fail();
  }
  const beforeReserve=sum(c.staff,'cash');
  for(const r of u.rows){
   const staff=c.staff.find(x=>x.name===r.staff);
   staff.claim=(cents(staff.claim)+cents(r.claimAmount))/100;staff.paid=(cents(staff.paid)+cents(r.paidAmount))/100;
   staff.position=(cents(staff.carry)+cents(staff.claim)-cents(staff.paid)-cents(staff.usage))/100;
   staff.net=staff.position;staff.cash=Math.max(0,staff.position);
   staff.newAdvance=Math.max(0,-staff.position-(staff.oldAdvance||0));
   s.rows.push(r);
  }
  const reserveDelta=cents(sum(c.staff,'cash'))-cents(beforeReserve);
  // The bank receipt already exists. Restore the negative staff position first;
  // only the excess becomes staff cash. Never append a second bank/transfer row.
  const generalDelta=cents(e.credit)-cents(e.debit)-reserveDelta;
  const allocations=u.allocations??[{bucket:'STAFF',amount:reserveDelta/100},{bucket:'YG',amount:generalDelta/100}];
  if(reserveDelta!==cents(sum(allocations.filter(a=>a.bucket==='STAFF'),'amount'))||generalDelta!==cents(sum(allocations.filter(a=>a.bucket==='YG'),'amount')))fail();
  c.staffCash=(cents(c.staffCash)+reserveDelta)/100;
  c.ygCash=(cents(c.ygCash)+generalDelta)/100;
  c.pendingStaffCash=(cents(c.pendingStaffCash)-cents(e.credit)+cents(e.debit))/100;
  e.bankAllocations??=structuredClone(e.allocations);
  e.allocations=allocations;e.allocationNote=u.note;
 }
 c.calculated=(cents(c.staffCash)+cents(c.ygCash)+cents(c.projectCash)+cents(c.pendingStaffCash))/100;
 c.difference=(cents(c.bankClosing)-cents(c.calculated))/100;
 if(c.difference!==0||cents(sum(c.staff,'cash'))!==cents(c.staffCash))fail();
 const positions=new Map();
 for(const r of s.rows){const k=r.staff+'|'+r.year;positions.set(k,(positions.get(k)||0)+r.carryForward+r.claimAmount-r.paidAmount-r.usageAmount);}
 s.rows=s.rows.map(r=>({...r,balance:positions.get(r.staff+'|'+r.year),balanceStatus:positions.get(r.staff+'|'+r.year)>0?'PLUS':positions.get(r.staff+'|'+r.year)<0?'MINUS':'NOL'}));
 s.total=sum(s.rows,'claimAmount');
 const aggregate=select=>{const m=new Map();for(const r of s.rows){const label=select(r),v=m.get(label)||{label,amount:0,recordCount:0};v.amount+=r.claimAmount;v.recordCount++;m.set(label,v);}return [...m.values()].sort((a,b)=>b.amount-a.amount||a.label.localeCompare(b.label));};
 s.byStaff=aggregate(r=>r.staff);s.byProject=aggregate(r=>r.projectGroup);s.byYear=aggregate(r=>String(r.year));
 const groups=new Map();for(const r of s.rows.filter(r=>r.claimAmount!==0)){const k=[r.year,r.projectGroup,r.project,r.staff].join('|'),v=groups.get(k)||{staff:r.staff,project:r.project,projectGroup:r.projectGroup,year:r.year,amount:0,recordCount:0};v.amount+=r.claimAmount;v.recordCount++;groups.set(k,v);}s.grouped=[...groups.values()];
 return {closing:c,salary:s};
}

function replaceOnce(source,from,to){if(source.includes(to))return source;if(source.split(from).length!==2)fail();return source.replace(from,()=>to);}
export async function applyPrivateReconciliationUpdates(root,config){
 if(!config||!Array.isArray(config.staffAllocations)||!Array.isArray(config.recordLinks))fail();
 const read=async f=>(await readFile(resolve(root,f),'utf8')).replace(/\r\n/g,'\n');
 const closing=JSON.parse(await read('app/closing-august-2026.json'));
 const salary=JSON.parse(await read('app/salary-savings-snapshot.json'));
 const result=reconcileStaffAllocations(closing,salary,config.staffAllocations);
 const seenLinks=new Set();
 const historical=await read('app/gmail-2025-records.ts');
 for(const link of config.recordLinks){
  if(seenLinks.has(link.record?.id)||![2025,2026].includes(link.year||2026))fail();seenLinks.add(link.record?.id);
  let base=0;
  if(link.originalBankAmount!==undefined){
   const line=historical.split('\n').find(line=>line.includes('id: '+JSON.stringify(link.record.id)+','));
   base=Number(line?.match(/bankAmount: ([\d_]+)/)?.[1]?.replaceAll('_',''));
   if(link.year!==2025||link.record.type!=='UM'||base!==link.originalBankAmount||!Number.isFinite(base))fail();
  }
  const e=result.closing.entries.find(e=>e.index===link.index);
  if(!e||e.reference!==link.reference||e.date!==link.date||!link.record?.id||!['UM','PJUM','GAJI','DONASI'].includes(link.record.type)||link.record.bankStatus!=='Cocok'||cents(link.record.bankAmount-base)!==cents(link.record.type==='UM'||link.record.type==='GAJI'?e.debit:e.credit))fail();
 }
 const recordWrites={};
 const linkOnlyIds=[];
 for(const year of [2025,2026]){
  const file=`app/gmail-${year}-records.ts`;
  let records=await read(file);
  const marker='\n// Private verified record links.\n';
  if(records.includes(marker))records=records.slice(0,records.indexOf(marker));
  const links=config.recordLinks.filter(x=>(x.year||2026)===year).map(x=>x.record);
  if(year===2026)for(const record of links)if(!records.includes(JSON.stringify(record.id)))linkOnlyIds.push(record.id);
  records+=marker+'for(const record of '+JSON.stringify(links)+` as ${year===2025?'Finance2025Record':'GmailFinanceRecord'}[]){const old=gmail${year}Records.find(r=>r.id===record.id);if(old)Object.assign(old,record);else gmail${year}Records.push(record);}`+'\n';
  recordWrites[file]=records;
 }
 let api=await read('app/api/salary-savings/route.ts');
 api=replaceOnce(api,'const connected=(dashboard:SalarySavingsDashboard)=>','bankConfirmedRows.push(...(snapshot as SalarySavingsDashboard).rows.filter(row=>'+JSON.stringify(config.staffAllocations.flatMap(u=>u.rows.map(r=>r.savingId)))+'.includes(row.savingId)));\nconst connected=(dashboard:SalarySavingsDashboard)=>');
 let requests=await read('app/api/requests/route.ts');
 // Metadata for live records must not create requests in an older database snapshot.
 requests=replaceOnce(requests,'const seedAndRepairStatements = [\n    ...systemRecords.map((record) =>','const seedAndRepairStatements = [\n    ...systemRecords.filter(record=>!'+JSON.stringify(linkOnlyIds)+'.includes(record.id)).map((record) =>');
 requests=replaceOnce(requests,'ORDER BY created_at DESC LIMIT 100`','ORDER BY created_at DESC`');
 let dashboard=await read('app/finance-archive-dashboard.tsx');
 dashboard=replaceOnce(dashboard,'window.setTimeout(() => controller.abort(), 5_000)','window.setTimeout(() => controller.abort(), 30_000)');
 let monitor=await read('app/um-monitor-panel.tsx');
 monitor=replaceOnce(monitor,'<small className="um-return-note">Belum cocok bank</small>','<small className="um-return-note">{row.pendingReturn > 1 ? "Belum cocok bank" : row.confirmedReturn > 0 ? "Pengembalian sudah cocok" : "Tidak ada sisa yang perlu dikembalikan"}</small>');
 let payroll=await read('app/payroll-bank-links.ts');
 payroll=replaceOnce(payroll,"if(!buckets.every(bucket=>['STAFF','STAFF_PENDING'].includes(bucket)))return false;","if(!buckets.every(bucket=>['STAFF','STAFF_PENDING','YG'].includes(bucket)) || (buckets.includes('YG') && !salaryRecordForMutation(mutation,records)))return false;");
 const writes={'app/closing-august-2026.json':JSON.stringify(result.closing,null,2)+'\n','app/salary-savings-snapshot.json':JSON.stringify(result.salary,null,2)+'\n',...recordWrites,'app/api/salary-savings/route.ts':api,'app/api/requests/route.ts':requests,'app/finance-archive-dashboard.tsx':dashboard,'app/um-monitor-panel.tsx':monitor};
 writes['app/payroll-bank-links.ts']=payroll;
 let summary=await read('app/closing-august-panel.tsx');
 summary=replaceOnce(summary,'Saldo positif · alokasi September belum lengkap','Saldo positif · {linked.pendingStaffCash ? "alokasi belum lengkap" : "alokasi sudah direkonsiliasi"}');
 summary=replaceOnce(summary,'· umum + gaji + alokasi belum lengkap','· umum + gaji{linked.pendingStaffCash ? " + alokasi belum lengkap" : ""}');
 summary=summary.replace(/ygAdvance:[\d_]+/, 'ygAdvance:a.staff.reduce((sum,s)=>sum+Math.max(0,-s.position),0)');
 summary=summary.replace(/Talangan baru bersih 2026 [^<]+?Total piutang aktif/, 'Talangan baru bersih mengikuti pembayaran dan pemulihan hak staf yang sudah dialokasikan, termasuk gaji dan donasi September. Total piutang aktif');
 writes['app/closing-august-panel.tsx']=summary;
 writes['app/fund-balance-details.tsx']=replaceOnce(await read('app/fund-balance-details.tsx'),'Total saldo positif sebelum alokasi yang belum lengkap','Total saldo positif staf');
 for(const [file,value] of Object.entries(writes))await writeFile(resolve(root,file),value);
 console.log('Private reconciliation verified; bank entries preserved and staff reserves reconcile.');
}
