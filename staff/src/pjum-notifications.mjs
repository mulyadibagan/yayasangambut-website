export const pjumRecipient='rienaprasiddha@yayasangambut.org';
const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export function pjumNotificationStatement(env,row,event,at){
 const payload={action:'sendPjumReview',notificationKey:'pjum:'+event,requestId:row.id,number:row.number||row.id,recipient:pjumRecipient,reviewUrl:'https://staff.yayasangambut.org/finance/advances?id='+encodeURIComponent(row.id)};
 return q(env,"INSERT INTO yg_pjum_notifications(id,request_id,payload,next_attempt_at,created_at) SELECT ?,id,?,?,? FROM yg_advance_requests WHERE id=? AND last_event=? AND status='pjum_submitted'",payload.notificationKey,JSON.stringify(payload),at,at,row.id,event);
}
export async function pjumNotificationStatus(env,id){
 return await q(env,'SELECT status,sent_at,error FROM yg_pjum_notifications WHERE request_id=? ORDER BY created_at DESC LIMIT 1',id).first();
}
export async function sendPjumNotifications(env,id=null,fetcher=fetch){
 const at=new Date().toISOString();
 const rows=(await q(env,"SELECT * FROM yg_pjum_notifications WHERE status!='sent' AND attempts<5 AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<?)"+(id?' AND request_id=?':'')+' LIMIT 5',at,at,...(id?[id]:[])).all()).results;
 for(const row of rows){
 const lease=new Date(Date.now()+90000).toISOString();
 const claim=await q(env,"UPDATE yg_pjum_notifications SET lease_until=?,attempts=attempts+1 WHERE id=? AND status!='sent' AND attempts=? AND (lease_until IS NULL OR lease_until<?)",lease,row.id,row.attempts,at).run();if(!claim.meta.changes)continue;
 let result=null,error='Email belum terkonfirmasi terkirim. Laporan tetap tersedia di Finance.';
 try{
 const settings=(await q(env,"SELECT setting_key,setting_value FROM finance_settings WHERE setting_key IN ('webhook_url','webhook_secret')").all()).results;
 const config=Object.fromEntries(settings.map(s=>[s.setting_key,s.setting_value])),url=new URL(config.webhook_url);
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/(?:a\/macros\/yayasangambut\.org\/s|macros\/s)\/[^/]+\/exec$/.test(url.pathname)||!config.webhook_secret)throw Error('configuration');
 const response=await fetcher(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(row.payload),webhookSecret:config.webhook_secret}),signal:AbortSignal.timeout(25000)}),data=await response.json();
 if(response.ok&&data.ok===true&&data.sent===true&&data.recipient===pjumRecipient&&typeof data.messageId==='string'&&data.messageId)result=data;
 else if(data.code==='unsupported')error='Layanan email perlu pembaruan untuk notifikasi PJUM.';
 }catch{}
 await q(env,'UPDATE yg_pjum_notifications SET status=?,sent_at=?,message_id=?,error=?,lease_until=NULL,next_attempt_at=? WHERE id=? AND lease_until=?',result?'sent':row.attempts>=4?'failed':'pending',result?new Date().toISOString():null,result?.messageId||null,result?null:error,new Date(Date.now()+300000).toISOString(),row.id,lease).run();
 }
}
