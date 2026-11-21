import {canonicalStaffName,displayStaffName} from './payroll-identity.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cents=v=>Math.round(Number(v||0)*100);
export async function savedDonations(env){
 const table=await q(env,"SELECT name FROM sqlite_master WHERE type='table' AND name='yg_donations'").first();
 return table?(await q(env,'SELECT id,seq,payload,created_at,version FROM yg_donations WHERE payload IS NOT NULL ORDER BY seq').all()).results.map(r=>({...r,payload:JSON.parse(r.payload)})):[];
}
// Add each accepted donation once to the live books. The bank register remains
// immutable. When it catches up, replace the matching source allocation instead
// of recognizing a second receipt or a second staff contribution.
export function donationReport(report,source,donations,reconciliation={staffAllocations:[]}){
 const out=structuredClone(report),staff=out.staff,issues=[];let added=0,pendingUsed=0,total=0;
 const before=staff.reduce((n,s)=>n+Math.max(0,Number(s.position)||0),0),claimed=new Set();
 out.donations=[];
 for(const row of donations){
  const p=row.payload;if(!p)continue;
  if(p.date.slice(0,4)!==source.asOf.slice(0,4)){issues.push({donation_id:row.id,message:'Donasi lintas tahun memerlukan rekonsiliasi saldo awal.'});continue;}
  const candidates=source.entries.filter(e=>String(e.date).startsWith(p.date)||dateIso(e.date)===p.date).filter(e=>cents(e.credit)===cents(p.amount)&&!e.debit);
  const exact=candidates.filter(e=>(p.bankId&&p.bankId===source.asOf.slice(0,4)+':'+e.index)||(norm(p.reference).length>=6&&norm(e.reference)===norm(p.reference)));
  const bank=exact.length===1?exact[0]:null;
  if(exact.length>1||!bank&&(candidates.length||p.date<=source.asOf)){issues.push({donation_id:row.id,message:'Donasi belum cocok dengan register bank. Tautkan mutasi agar tidak dihitung dua kali.'});continue;}
  if(bank&&claimed.has(bank.index)){issues.push({donation_id:row.id,message:'Satu mutasi digunakan oleh beberapa laporan donasi.'});continue;}
  if(bank)claimed.add(bank.index);
  const old=bank?(reconciliation.staffAllocations||[]).find(a=>a.index===bank.index):null;
  const allocations=bank?.allocations||[];
  if(bank&&allocations.some(a=>!['STAFF','STAFF_PENDING','YG'].includes(a.bucket))){issues.push({donation_id:row.id,message:'Mutasi donasi memiliki alokasi proyek; perlu rekonsiliasi sebelum mengubah saldo.'});continue;}
  if(bank&&allocations.some(a=>a.bucket==='STAFF'&&a.amount)&&!old){issues.push({donation_id:row.id,message:'Alokasi saving pada mutasi belum dapat ditelusuri. Saldo tidak ditambahkan ulang.'});continue;}
  const changes=[];
  if(old)for(const r of old.rows||[]){const live=source.rows.find(x=>x.savingId===r.savingId);if(live&&live.claimAmount)changes.push({staff:live.staff,amount:-live.claimAmount});}
  for(const a of p.allocations)if(a.kind==='salary')changes.push(a);
  if(staff.some(s=>s.position===null)){issues.push({donation_id:row.id,message:'Saldo gaji perlu direkonsiliasi sebelum donasi dapat diterapkan.'});continue;}
  for(const a of changes){const name=canonicalStaffName(a.staff);let s=staff.find(s=>canonicalStaffName(s.name)===name);
   if(!s){s={id:'staff:'+name.toLowerCase().replace(/\s+/g,'-'),name:displayStaffName(name),active:false,monthlySalary:null,opening:0,allocation:0,paid:0,usage:0,position:0,sources:[]};staff.push(s);}
   s.allocation=(cents(s.allocation)+cents(a.amount))/100;s.position=(cents(s.position)+cents(a.amount))/100;
   s.donationAmount=(cents(s.donationAmount)+cents(a.amount))/100;
   s.sources.push({id:'donation:'+row.id,program:'Donasi',amount:a.amount,url:'/finance/donations/'+row.id+'/receipt'});
  }
  if(!bank)added+=p.amount;else pendingUsed+=allocations.filter(a=>a.bucket==='STAFF_PENDING').reduce((n,a)=>n+a.amount,0);
  total+=p.amount;out.donations.push({id:row.id,amount:p.amount,date:p.date,bankMatched:!!bank,allocations:p.allocations,version:row.version});
 }
 const reserve=staff.reduce((n,s)=>n+Math.max(0,Number(s.position)||0),0);
 out.donationAdditional=added;out.donationTotal=total;out.donationPendingUsed=pendingUsed;
 if(out.bookBalance!==null)out.bookBalance=(cents(out.bookBalance)+cents(added))/100;
 if(out.generalSaving!==null)out.generalSaving=(cents(out.generalSaving)+cents(added)+cents(pendingUsed)-cents(reserve-before))/100;
 if(out.salaryReserve!==null)out.salaryReserve=reserve;
 out.issues.push(...issues);out.donationIssues=issues;
 return out;
}
function dateIso(s){const m=String(s).match(/^(\d{1,2})\s+(\w+)\s+(20\d{2})/),months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',Mei:'05',May:'05',Jun:'06',Jul:'07',Agu:'08',Aug:'08',Sep:'09',Okt:'10',Oct:'10',Nov:'11',Des:'12',Dec:'12'};return m&&months[m[2]]?m[3]+'-'+months[m[2]]+'-'+m[1].padStart(2,'0'):'';}
export async function applySavedDonations(env,report,source){
 const rows=await savedDonations(env);if(!rows.length)return {...report,donations:[],donationAdditional:0,donationTotal:0,donationIssues:[]};
 const setting=await q(env,"SELECT setting_value FROM finance_settings WHERE setting_key='finance_reconciliation_v1'").first();
 return donationReport(report,source,rows,setting?JSON.parse(setting.setting_value):undefined);
}
