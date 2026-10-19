export const payrollRecipients=Object.freeze(['hisamsetiawan@yayasangambut.org','serena@gec.org.my','rienaprasiddha@yayasangambut.org']);
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export async function payrollEmailService(env){
 try{
  const settings=(await q(env,"SELECT setting_key,setting_value FROM finance_settings WHERE setting_key IN ('webhook_url','webhook_secret')").all()).results;
  const config=Object.fromEntries(settings.map(s=>[s.setting_key,s.setting_value]));
  const url=new URL(config.webhook_url);
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/(?:a\/macros\/yayasangambut\.org\/s|macros\/s)\/[^/]+\/exec$/.test(url.pathname)||!config.webhook_secret)return {configured:false,ready:false};
  const response=await fetch(url.href,{signal:AbortSignal.timeout(15000)}),data=await response.json();
  return {configured:true,ready:response.ok&&data.payrollNotifications===true,deploymentId:url.pathname.split('/').at(-2)};
 }catch{return {configured:false,ready:false};}
}
export function payrollNotificationStatement(env,row,event,at){
 const meta=JSON.parse(row.form_meta||'{}'),id='payroll:'+event;
 const payload={action:'sendPayrollApproval',notificationKey:id,requestId:row.id,period:row.period,number:meta.number||row.id,total:row.total,approvedAt:at,approvedBy:'mulyadi@yayasangambut.org',recipients:payrollRecipients};
 return q(env,"INSERT INTO yg_payroll_notifications(id,request_id,approval_event,payload,next_attempt_at,created_at) SELECT ?,id,?,?,?,? FROM yg_payroll_requests WHERE id=? AND last_event=? AND status='approved'",id,event,JSON.stringify(payload),at,at,row.id,event);
}
export async function payrollNotificationStatus(env,id){
 return (await q(env,'SELECT status,attempts,sent_at,message_id,error FROM yg_payroll_notifications WHERE request_id=? ORDER BY created_at DESC LIMIT 1',id).first())||null;
}
// Apps Script independently deduplicates by notificationKey. An uncertain send
// is recovered from Gmail, never blindly re-sent after an interrupted request.
export async function sendPayrollNotifications(env,requestId=null,fetcher=fetch){
 const at=new Date().toISOString();
 const rows=(await q(env,"SELECT * FROM yg_payroll_notifications WHERE status!='sent' AND attempts<5 AND (lease_until IS NULL OR lease_until<?) AND next_attempt_at<=?"+(requestId?' AND request_id=?':'')+' ORDER BY created_at LIMIT 5',at,at,...(requestId?[requestId]:[])).all()).results;
 for(const row of rows){
  const lease=new Date(Date.now()+90000).toISOString();
  const claim=await q(env,"UPDATE yg_payroll_notifications SET status='sending',attempts=attempts+1,lease_until=? WHERE id=? AND status!='sent' AND attempts=? AND (lease_until IS NULL OR lease_until<?)",lease,row.id,row.attempts,at).run();
  if(!claim.meta.changes)continue;
  let result=null,error='Pengiriman belum terkonfirmasi. Sistem akan memeriksa kembali dengan penanda yang sama.';
  try{
   const settings=(await q(env,"SELECT setting_key,setting_value FROM finance_settings WHERE setting_key IN ('webhook_url','webhook_secret')").all()).results;
   const config=Object.fromEntries(settings.map(s=>[s.setting_key,s.setting_value]));
   const url=new URL(config.webhook_url);
   if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/(?:a\/macros\/yayasangambut\.org\/s|macros\/s)\/[^/]+\/exec$/.test(url.pathname)||!config.webhook_secret)throw Error('configuration');
   const response=await fetcher(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(row.payload),webhookSecret:config.webhook_secret}),signal:AbortSignal.timeout(25000)});
   const data=await response.json();
   if(response.ok&&data.ok===true&&data.sent===true&&typeof data.messageId==='string'&&data.messageId&&Array.isArray(data.recipients)&&[...data.recipients].sort().join(',')===[...payrollRecipients].sort().join(','))result=data;
   else if(data.code==='unsupported')error='Layanan email perlu pembaruan. Persetujuan tetap tersimpan.';
   else if(data.code==='uncertain')error='Pengiriman perlu verifikasi di Gmail; sistem tidak mengirim ulang secara buta.';
  }catch{/* Never expose integration secrets or upstream error bodies. */}
  await q(env,'UPDATE yg_payroll_notifications SET status=?,sent_at=?,message_id=?,error=?,lease_until=NULL,next_attempt_at=? WHERE id=? AND lease_until=?',result?'sent':row.attempts>=4?'failed':'pending',result?new Date().toISOString():null,result?.messageId||null,result?null:error,new Date(Date.now()+300000).toISOString(),row.id,lease).run();
 }
}
