import {financeOwner,financeDashboardAccess} from './finance-access.mjs';

export async function financeNotifications(env,user){
 if(!financeDashboardAccess(user))return [];
 if(!financeOwner(user)){
  const {results}=await env.DB.prepare(`SELECT id,seq,payload,updated_at FROM yg_donations WHERE payload IS NOT NULL AND updated_at>=datetime('now','-30 days') ORDER BY updated_at DESC,seq DESC LIMIT 50`).all();
  return results.map(row=>{const p=JSON.parse(row.payload);return {id:'donation-'+row.id,kind:'donation',number:String(row.seq),applicant:p.donor,total:p.amount,note:'',checkedAt:row.updated_at,title:'Penerimaan donasi dari '+p.donor,actionLabel:'Buka penerimaan donasi',href:'/finance/donations?id='+encodeURIComponent(row.id)};});
 }
 const {results}=await env.DB.prepare(`
  SELECT r.id,r.seq,r.legacy_id,r.created_at AS requested_at,r.payload,r.creator_name,r.total,r.note,e.actor_email,e.created_at
  FROM yg_advance_requests r
  JOIN yg_advance_events e ON e.request_id=r.id AND e.action='report_check'
  WHERE r.status='pjum_checked'
   AND e.version=(SELECT MAX(version) FROM yg_advance_events WHERE request_id=r.id AND action='report_check')
  ORDER BY e.created_at DESC,r.id DESC
 `).all();
 return results.map(row=>{
  const data=JSON.parse(row.payload);
  return {id:row.id,number:row.legacy_id?data.legacy.number:'UM-'+row.requested_at.slice(0,4)+'-'+String(row.seq).padStart(5,'0'),applicant:row.creator_name,total:row.total,
   reviewer:row.actor_email,checkedAt:row.created_at,note:row.note,
   href:'/finance/advances?id='+encodeURIComponent(row.id)+'&view=review'};
 });
}
