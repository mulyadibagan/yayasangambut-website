import {fail} from './core.mjs';
import {advanceProjects} from './advance-projects.mjs';

export function archiveDate(value){
 const s=String(value||'').trim();if(/^20\d{2}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})/);if(!m)return '';
 const months=['jan','feb','mar','apr','mei','jun','jul','agu','sep','okt','nov','des'],month=months.indexOf(({may:'mei',aug:'agu',oct:'okt',dec:'des'}[m[2].slice(0,3)]||m[2].slice(0,3)))+1;
 return month?`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
}

export function legacyAdvances(records){
 if(!Array.isArray(records))fail(503,'Format arsip UM belum dapat dibaca.');
 return records.filter(r=>String(r.type||r.request_type||'').toUpperCase()==='UM').map(r=>{
  const number=String(r.documentNumber||r.code||r.number||r.requestNumber||r.request_number||r.document_number||r.title||''),title=String(r.title||r.description||number),project=String(r.projectCode||r.project_code||r.project||'');
  return {id:String(r.id),number,title,code:String(r.code||''),amount:Number(r.advanceAmount??r.advance_amount??r.amount),project:advanceProjects.find(p=>p.name.toLowerCase()===project.toLowerCase())?.id||project,
   applicant:String(r.submitter||r.applicant||r.requesterName||r.requester_name||r.created_by_name||r.requester||''),
   date:archiveDate(r.submittedAt||r.date||r.request_date||r.created_at),
   paid_date:archiveDate(r.bankDate||r.bank_date||r.payment_date),status:String(r.status||''),bank_amount:Number(r.bankAmount??r.bank_amount??0),
   bank_status:String(r.bankStatus||r.bank_status||''),
   reference:String(r.bankReference||r.bank_reference||r.payment_reference||''),
   reported:records.filter(p=>String(p.type||p.request_type).toUpperCase()==='PJUM'&&(p.parentUmId||p.parent_um_id)===r.id&&(p.submissionVerified===true||['Menunggu Persetujuan','Dilaporkan ke Riena','Disetujui','Selesai'].includes(p.status))).reduce((n,p)=>n+Number(p.actualAmount??p.actual_amount??p.amount??0),0)};
 }).filter(r=>r.id&&r.id!=='undefined'&&Number.isSafeInteger(r.amount)&&r.amount>0&&(r.status==='Dicairkan'||r.bank_status==='Cocok'&&r.bank_amount===r.amount));
}
export async function legacySource(env,u){
 if(!env.FINANCE)fail(503,'Arsip UM belum terhubung.');
 const r=await env.FINANCE.fetch(new Request(env.APP_ORIGIN+'/finance/api/requests',{headers:{'x-yg-finance-user':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-email':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-id':u.id}}));
 if(!r.ok)fail(503,'Arsip UM belum dapat dimuat.');
 const data=await r.json();return legacyAdvances(data.requests);
}
