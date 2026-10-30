import {fail,now} from './core.mjs';
import {canonicalStaffName,displayStaffName} from './payroll-identity.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export async function staffTerms(env){return (await q(env,'SELECT * FROM yg_payroll_staff_terms ORDER BY effective_month,name').all()).results;}
export function salaryTermInput(b){
 const name=displayStaffName(b?.name),salary=b?.monthlySalary,period=b?.effectiveMonth,source=b?.fundingSource,notes=b?.notes||'';
 if(typeof b?.name!=='string'||!name||name.length>160||!Number.isSafeInteger(salary)||salary<=0||salary>10000000000||typeof period!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||typeof source!=='string'||!source.trim()||source.length>200||typeof notes!=='string'||notes.length>1000)fail(400,'Periksa nama, gaji, bulan mulai, dan sumber pendanaan.');
 return {name,staffKey:canonicalStaffName(name).toLowerCase(),monthlySalary:salary,effectiveMonth:period,fundingSource:source.trim(),notes:notes.trim()};
}
export async function saveStaffTerm(env,u,b){
 const d=salaryTermInput(b);if(await q(env,'SELECT id FROM yg_payroll_staff_terms WHERE staff_key=? AND effective_month=?',d.staffKey,d.effectiveMonth).first())fail(409,'Data staf untuk bulan efektif ini sudah tercatat.');
 await q(env,'INSERT INTO yg_payroll_staff_terms VALUES(?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),d.staffKey,d.name,d.monthlySalary,d.effectiveMonth,d.fundingSource,d.notes,u.id,now()).run();return d;
}
export function applyStaffTerms(source,terms,period){
 const groups=new Map();for(const t of terms){if(!groups.has(t.staff_key))groups.set(t.staff_key,[]);groups.get(t.staff_key).push(t);}
 const policy={...source.policy};
 for(const list of groups.values()){
  list.sort((a,b)=>a.effective_month.localeCompare(b.effective_month));const applicable=list.filter(t=>t.effective_month<=period).at(-1),chosen=applicable||list[0],key=canonicalStaffName(chosen.name);
  if(!applicable&&policy[key])continue;
  policy[key]={...(policy[key]||{}),active:!!applicable,monthlySalary:chosen.monthly_salary,effectiveMonth:chosen.effective_month,fundingSource:chosen.funding_source,fundingStatus:'Rencana pendanaan; penerimaan dicatat terpisah',notes:chosen.notes};
 }
 return {...source,policy};
}
export function staffTermsPage(){return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Data Gaji Staf · YG Finance</title><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/payroll.css"><script type="module" src="/payroll-staff.js"></script></head><body class="payroll-page"><header class="topbar"><a class="brand" href="/finance">YG Finance</a><nav><a href="/finance/payroll">Pengajuan gaji</a><a href="/finance">Ringkasan keuangan</a></nav></header><main><h1>Data gaji staf</h1><p>Gaji bulanan mengikuti bulan mulai berlaku. Sumber pendanaan di sini merupakan rencana; pencatatan ini tidak menambah saldo kas atau menyatakan gaji telah dibayar.</p><p id="message" role="status"></p><section class="panel"><h2>Ketentuan gaji tambahan</h2><div id="terms">Memuat…</div></section><section class="panel" id="editor" hidden><h2>Tambah data gaji</h2><form id="staff-form"><label>Nama staf<input name="name" maxlength="160" required></label><label>Gaji per bulan (Rp)<input name="salary" type="number" min="1" step="1" required></label><label>Berlaku mulai<input name="effective" type="month" required></label><label>Sumber pendanaan<input name="source" maxlength="200" required></label><label>Catatan<textarea name="notes" maxlength="1000"></textarea></label><button type="submit">Simpan data gaji</button></form></section></main></body></html>`;}
