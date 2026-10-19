import {fail} from './core.mjs';
export const staffKey=name=>'staff:'+String(name).trim().toLowerCase().replace(/\s+/g,'-');
export const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
export function dateKey(value){
 const s=String(value||'');if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})/i),months={jan:'01',feb:'02',mar:'03',apr:'04',mei:'05',may:'05',jun:'06',jul:'07',agu:'08',aug:'08',sep:'09',okt:'10',oct:'10',nov:'11',des:'12',dec:'12'};
 return m&&months[m[2].slice(0,3).toLowerCase()]?`${m[3]}-${months[m[2].slice(0,3).toLowerCase()]}-${m[1].padStart(2,'0')}`:'';
}
export function validDate(value){if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail(400,'Tanggal tidak valid.');return value;}
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export async function payrollSource(env,u){
 if(!env.FINANCE)fail(503,'Sumber alokasi gaji belum tersambung.');
 const r=await env.FINANCE.fetch(new Request(env.APP_ORIGIN+'/finance/api/payroll-source',{headers:{'x-yg-finance-user':u.email,'oai-authenticated-user-email':u.email,'oai-authenticated-user-id':u.id}}));
 if(!r.ok)fail(503,'Data alokasi gaji belum dapat dimuat. Coba kembali.');const data=await r.json();
 if(!data.policy||!Array.isArray(data.rows)||!Array.isArray(data.entries)||!data.bank?.account||!Number.isFinite(data.bank.closing)||!data.asOf)fail(503,'Sumber alokasi gaji belum lengkap.');return data;
}
function baseStaff(source){
 const result=new Map();for(const [name,p] of Object.entries(source.policy))result.set(staffKey(name),{id:staffKey(name),name,active:p.active,monthlySalary:p.monthlySalary,opening:0,allocation:0,paid:0,usage:0,position:0,sources:[]});
 const sourceYear=Number(source.asOf.slice(0,4));
 for(const r of source.rows){if(Number(r.year)!==sourceYear||dateKey(r.expenseDate)>source.asOf)continue;const id=staffKey(r.staff),s=result.get(id)||{id,name:r.staff,active:false,monthlySalary:null,opening:0,allocation:0,paid:0,usage:0,position:0,sources:[]};s.opening+=Number(r.carryForward||0);s.allocation+=Number(r.claimAmount||0);s.paid+=Number(r.paidAmount||0);s.usage+=Number(r.usageAmount||0);if(r.claimAmount||r.carryForward)s.sources.push({id:r.savingId,program:r.project,amount:Number(r.claimAmount||r.carryForward),url:r.sourceUrl||''});result.set(id,s);}
 for(const r of result.values())r.position=r.opening+r.allocation-r.paid-r.usage;return result;
}
export const bankId=(source,e)=>'bank:'+source.asOf.slice(0,4)+':'+e.index;
export function resolveBank(source,payment){
 if(payment.source_account!==source.bank.account)return {entry:null,issue:'Rekening sumber berbeda dari register bank.'};
 const candidates=source.entries.filter(e=>dateKey(e.date)===payment.paid_date&&Number(e.debit)===payment.amount&&Number(e.credit)===0);
 if(payment.bank_entry_id){const selected=source.entries.find(e=>bankId(source,e)===payment.bank_entry_id);return selected&&candidates.includes(selected)&&String(selected.reference).trim()===payment.reference?{entry:selected,issue:null}:{entry:null,issue:'Mutasi yang ditautkan berubah atau tidak cocok.'};}
 const exact=candidates.filter(e=>String(e.reference).trim()===payment.reference&&!['','-'].includes(payment.reference));
 if(exact.length===1)return {entry:exact[0],issue:null};
 if(exact.length>1||candidates.length)return {entry:null,issue:'Ada kandidat mutasi. Perlu pencocokan referensi.'};
 return {entry:null,issue:payment.paid_date<=source.asOf?'Pembayaran dalam periode bank belum ditemukan pada mutasi.':null};
}
export function paymentReport(source,payments){
 const staff=baseStaff(source),resolved=[],issues=[],claimedEntries=new Set();let totalPaid=0,bankMatched=0,bankAdditional=0;
 const salaryAvailable=new Map();
 for(const r of source.rows){if(Number(r.year)!==Number(source.asOf.slice(0,4))||!r.paidAmount||dateKey(r.expenseDate)>source.asOf)continue;const k=dateKey(r.expenseDate)+'|'+staffKey(r.staff);salaryAvailable.set(k,(salaryAvailable.get(k)||0)+Number(r.paidAmount));}
 const initialReserve=[...staff.values()].reduce((sum,s)=>sum+Math.max(0,s.position),0);
 for(const payment of payments){
  const p={...payment,allocations:typeof payment.allocations==='string'?JSON.parse(payment.allocations):payment.allocations,proof_ids:typeof payment.proof_ids==='string'?JSON.parse(payment.proof_ids):payment.proof_ids};
  let {entry,issue}=resolveBank(source,p);if(p.paid_date.slice(0,4)!==source.asOf.slice(0,4))issue='Tahun pembayaran berbeda dari tahun sumber. Perlu rekonsiliasi lintas tahun.';const id=entry?bankId(source,entry):null;
  if(id&&claimedEntries.has(id)){issue='Satu mutasi tertaut ke lebih dari satu pembayaran.';entry=null;}if(entry)claimedEntries.add(id);
  totalPaid+=p.amount;if(entry)bankMatched+=p.amount;else bankAdditional+=p.amount;
  for(const a of p.allocations){
   const s=staff.get(a.staff_id)||{id:a.staff_id,name:a.name,active:false,monthlySalary:null,opening:0,allocation:0,paid:0,usage:0,position:0,sources:[]};
   const key=p.paid_date+'|'+a.staff_id,available=salaryAvailable.get(key)||0;
   const recognized=entry?Math.min(a.amount,available):0;salaryAvailable.set(key,available-recognized);
   const extra=a.amount-recognized;s.paid+=extra;s.position-=extra;s.newPaid=(s.newPaid||0)+extra;staff.set(a.staff_id,s);
   if(entry&&extra>0)issue='Mutasi sudah ada, alokasi pembayaran staf belum sepenuhnya tercakup dalam sumber saving.';
  }
  if(issue)issues.push({payment_id:p.id,message:issue});resolved.push({...p,resolved_bank_id:entry?id:null,bank_status:entry?'Cocok mutasi':issue?'Perlu diperiksa':'Menunggu mutasi',issue});
 }
 const reserve=[...staff.values()].reduce((sum,s)=>sum+Math.max(0,s.position),0),reserveUsed=initialReserve-reserve;
 return {sourceAsOf:source.asOf,sourceMode:source.mode,sourceUrl:source.sourceUrl,bankAccount:source.bank.account,bankBalance:source.bank.closing,bookBalance:issues.length?null:source.bank.closing-bankAdditional,totalPaid,bankMatched,bankAdditional,staff:[...staff.values()].map(s=>issues.length?{...s,position:null,paid:null}:s),salaryReserve:issues.length?null:reserve,generalSaving:issues.length?null:source.generalSaving-(bankAdditional-reserveUsed),issues,payments:resolved};
}
export async function payrollReport(env,u,source){
 source ||=await payrollSource(env,u);
 const payments=(await q(env,'SELECT p.*,r.period,r.form_meta FROM yg_payroll_payments p JOIN yg_payroll_requests r ON r.id=p.request_id ORDER BY p.paid_date,p.created_at,p.id').all()).results;
 return paymentReport(source,payments);
}
export async function payrollDefaults(env,u,period){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period||''))fail(400,'Periode gaji tidak valid.');
 const source=await payrollSource(env,u),report=await payrollReport(env,u,source);
 const previous=(await q(env,'SELECT items FROM yg_payroll_requests ORDER BY created_at DESC LIMIT 100').all()).results,known=new Map();
 for(const r of previous)for(const item of JSON.parse(r.items)){const id=item.staff_id||staffKey(item.name);if(!known.has(id))known.set(id,item);}
 const items=report.staff.filter(s=>s.active&&Number.isSafeInteger(s.monthlySalary)&&s.monthlySalary>0).map(s=>{
  const profile=source.profiles?.profiles?.[s.name]||{},old={...profile,...(known.get(s.id)||{})};return {staff_id:s.id,name:s.name,program:'Saving gaji',budget_code:old.budget_code||'',description:old.description||'Gaji '+s.name,bank:old.bank||profile.bank||'',account:old.account||profile.account||'',account_name:old.account_name||profile.account_name||s.name,remarks:old.remarks||'',base:s.monthlySalary,allowance:0,deduction:0,net:s.monthlySalary,allocation_snapshot:{asOf:source.asOf,position:s.position,monthlySalary:s.monthlySalary,source_ids:s.sources.map(x=>x.id)}};
 });
 if(!items.length)fail(503,'Kebijakan gaji staf aktif belum tersedia.');
 return {items,sourceAsOf:source.asOf,sourceMode:source.mode,sourceUrl:source.sourceUrl,bankAccount:source.bank.account,form_meta:{date:today(),applicant:source.profiles?.applicant||u.name,title:source.profiles?.title||'Bendahara/Tenaga Teknis',purpose:'Pembayaran Gaji Pengurus YG '+new Date(period+'-01T12:00:00+07:00').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'Asia/Jakarta'}),place:source.profiles?.place||'Tangerang Selatan',number:'',allocation_as_of:source.asOf,adjustment_note:''},warnings:period<source.asOf.slice(0,7)?['Periode lebih lama dari kebijakan saat ini. Periksa nominal sebelum diajukan.']:[]};
}
