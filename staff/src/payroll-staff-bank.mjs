import {fail,now} from './core.mjs';
import {canonicalStaffName,displayStaffName} from './payroll-identity.mjs';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export function bankStaffKey(name){if(typeof name!=='string'||!name.trim()||name.length>160||/[\u0000-\u001f]/.test(name))fail(400,'Isi nama staf yang benar.');return canonicalStaffName(name).toLowerCase();}
export async function staffBank(e,name){return await q(e,'SELECT * FROM yg_payroll_staff_bank WHERE staff_key=?',bankStaffKey(name)).first();}
export async function staffBanks(e){return (await q(e,'SELECT * FROM yg_payroll_staff_bank').all()).results;}
export async function saveStaffBank(e,u,b){
 const key=bankStaffKey(b.name),name=displayStaffName(b.name);
 const clean=(s,max)=>typeof s==='string'&&s.trim()&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
 if(!clean(b.bank,80)||!clean(b.account_name,160)||typeof b.account!=='string'||b.account.length>80||!/^\d[\d -]*$/.test(b.account)||!Number.isSafeInteger(b.version)||b.version<0)fail(400,'Periksa bank, nomor rekening, nama pemilik, dan versi data.');
 const account=b.account.replace(/[ -]/g,'');if(!/^\d{6,40}$/.test(account))fail(400,'Nomor rekening harus berisi 6 sampai 40 angka.');
 const old=await staffBank(e,b.name);if((old?.version||0)!==b.version)fail(409,'Rekening berubah. Muat ulang sebelum menyimpan.');
 if(old&&old.bank===b.bank.trim()&&old.account===account&&old.account_name===b.account_name.trim())return old;
 const v=b.version+1,time=now(),fields=[name,b.bank.trim(),account,b.account_name.trim(),v,u.email,time];
 const write=old?q(e,'UPDATE yg_payroll_staff_bank SET name=?,bank=?,account=?,account_name=?,version=?,actor=?,updated_at=? WHERE staff_key=? AND version=?',...fields,key,b.version):q(e,'INSERT OR IGNORE INTO yg_payroll_staff_bank(name,bank,account,account_name,version,actor,updated_at,staff_key) VALUES(?,?,?,?,?,?,?,?)',...fields,key);
 const snapshot={name,bank:b.bank.trim(),account,account_name:b.account_name.trim()};
 const result=await e.DB.batch([write,q(e,'INSERT INTO yg_payroll_staff_bank_history SELECT ?,staff_key,version,?,?,? FROM yg_payroll_staff_bank WHERE staff_key=? AND changes()>0',crypto.randomUUID(),JSON.stringify(snapshot),u.email,time,key)]);
 if(!result[0].meta.changes)fail(409,'Rekening berubah. Muat ulang sebelum menyimpan.');return staffBank(e,name);
}
export function recipientBank(override,old,profile,name){return override?{bank:override.bank,account:override.account,account_name:override.account_name}:{bank:old.bank||profile.bank||'',account:old.account||profile.account||'',account_name:old.account_name||profile.account_name||name};}
