import {fail} from './core.mjs';

export function legacyAdvances(records){
 if(!Array.isArray(records))fail(503,'Format arsip UM belum dapat dibaca.');
 return records.filter(r=>String(r.type||r.request_type||'').toUpperCase()==='UM').map(r=>{
  const number=String(r.number||r.requestNumber||r.request_number||r.document_number||r.title||''),title=String(r.title||r.description||number);
  return {id:String(r.id),number,title,amount:Number(r.advanceAmount??r.advance_amount??r.amount),project:String(r.projectCode||r.project_code||r.project||''),
   applicant:String(r.applicant||r.requesterName||r.requester_name||r.created_by_name||r.requester||''),
   date:String(r.date||r.request_date||r.created_at||'').slice(0,10),
   paid_date:String(r.bankDate||r.bank_date||r.payment_date||'').slice(0,10),
   bank_status:String(r.bankStatus||r.bank_status||''),
   reference:String(r.bankReference||r.bank_reference||r.payment_reference||''),
   reported:records.filter(p=>String(p.type||p.request_type).toUpperCase()==='PJUM'&&(p.parentUmId||p.parent_um_id)===r.id&&p.submissionVerified===true).reduce((n,p)=>n+Number(p.actualAmount??p.actual_amount??p.amount??0),0)};
 }).filter(r=>r.id&&r.id!=='undefined'&&Number.isSafeInteger(r.amount)&&r.amount>0);
}
export async function legacySource(env,u){
 if(!env.FINANCE)fail(503,'Arsip UM belum terhubung.');
 const r=await env.FINANCE.fetch(new Request(env.APP_ORIGIN+'/finance/api/requests',{headers:{'x-yg-finance-user':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-email':env.ADMIN_EMAIL||u.email,'oai-authenticated-user-id':u.id}}));
 if(!r.ok)fail(503,'Arsip UM belum dapat dimuat.');
 const data=await r.json();return legacyAdvances(data.requests);
}
