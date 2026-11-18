const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);

export function queuePjumReviewEmail(env,row,event,at,note){
 const report=JSON.parse(row.report);
 const payload={action:'sendPjumReview',notificationKey:'pjum:'+event,requestId:row.id,recipient:row.creator_email,number:report.report_number||row.id,note};
 return q(env,`INSERT INTO yg_pjum_review_emails (id,request_id,payload,next_attempt_at)
 SELECT ?,id,?,? FROM yg_advance_requests WHERE id=? AND last_event=?`,
 event,JSON.stringify(payload),at,row.id,event);
}

export async function sendPjumReviewEmails(env,requestId=null){
 const at=new Date().toISOString();
 const rows=(await q(env,`SELECT * FROM yg_pjum_review_emails WHERE sent_at IS NULL AND attempts<5
 AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<?)`+
 (requestId?' AND request_id=?':'')+' ORDER BY next_attempt_at LIMIT 5',at,at,...(requestId?[requestId]:[])).all()).results;
 if(!rows.length)return;
 const settings=(await q(env,"SELECT setting_key,setting_value FROM finance_settings WHERE setting_key IN ('webhook_url','webhook_secret')").all()).results;
 const config=Object.fromEntries(settings.map(s=>[s.setting_key,s.setting_value]));
 let url;
 try{url=new URL(config.webhook_url);}catch{return;}
 if(url.origin!=='https://script.google.com'||!/^\/(?:a\/macros\/yayasangambut\.org\/s|macros\/s)\/[^/]+\/exec$/.test(url.pathname)||!config.webhook_secret)return;
 for(const row of rows){
  const lease=new Date(Date.now()+90000).toISOString();
  const claim=await q(env,`UPDATE yg_pjum_review_emails SET attempts=attempts+1,lease_until=?
   WHERE id=? AND sent_at IS NULL AND attempts=? AND (lease_until IS NULL OR lease_until<?)`,lease,row.id,row.attempts,at).run();
  if(!claim.meta.changes)continue;
  let delivered=false;
  try{
   const payload=JSON.parse(row.payload);
   const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,webhookSecret:config.webhook_secret}),signal:AbortSignal.timeout(25000)});
   const data=await response.json();
   delivered=response.ok&&data.ok===true&&data.sent===true&&data.notificationKey===payload.notificationKey;
  }catch{/* Retry with the same key without exposing the webhook or its response. */}
  await q(env,'UPDATE yg_pjum_review_emails SET sent_at=?,lease_until=NULL,next_attempt_at=? WHERE id=? AND lease_until=?',
   delivered?new Date().toISOString():null,new Date(Date.now()+300000).toISOString(),row.id,lease).run();
 }
}

