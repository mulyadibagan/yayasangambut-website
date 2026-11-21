import {staffNames,canonicalStaffName,displayStaffName} from './payroll-identity.mjs';
import {staffTerms} from './payroll-staff.mjs';
export function donationStaffList(terms=[],month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}).slice(0,7)){
 const people=new Map(Object.entries(staffNames).map(([id,name])=>[id.toLowerCase(),{id,name}]));
 for(const term of terms){
  if(term.effective_month>month)continue;
  const id=canonicalStaffName(term.name),key=id.toLowerCase();
  if(id&&!people.has(key))people.set(key,{id,name:displayStaffName(term.name)});
 }
 return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
export async function donationStaff(env){
 const table=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='yg_payroll_staff_terms'").first();
 return donationStaffList(table?await staffTerms(env):[]);
}
