/** Register sendPjumReview in the existing authenticated doPost dispatcher.
 * After verifying webhookSecret:
 * if (payload.action === 'sendPjumReview') return json_(sendPjumReview_(payload));
 * Publish a new version of the existing web app deployment; retain its URL.
 */
function sendPjumReview_(p) {
 const recipient='rienaprasiddha@yayasangambut.org';
 if(p.recipient!==recipient||!/^pjum:[a-f0-9-]{36}$/.test(p.notificationKey)||!/^[a-f0-9-]{36}$/.test(p.requestId)||
 p.reviewUrl!=='https://staff.yayasangambut.org/finance/advances?id='+p.requestId||typeof p.number!=='string'||p.number.length>160||/[\r\n]/.test(p.number))throw Error('Notifikasi PJUM tidak valid.');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
 const properties=PropertiesService.getScriptProperties(),key='YG_'+p.notificationKey,prior=JSON.parse(properties.getProperty(key)||'{}'),marker='YG_PJUM_'+p.notificationKey.slice(5);
 const recover=()=>{
 const threads=GmailApp.search('in:sent "'+marker+'"',0,10);
 for(const thread of threads)for(const m of thread.getMessages()){
 const to=(m.getTo().toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g)||[]);
 if(to.length===1&&to[0]===recipient&&!m.getCc()&&!m.getBcc()&&m.getPlainBody().includes(marker)&&m.getPlainBody().includes(p.reviewUrl)){
 const state={messageId:m.getId()};properties.setProperty(key,JSON.stringify(state));return {ok:true,sent:true,recipient:recipient,messageId:state.messageId};
 }}
 return null;
 };
 if(prior.messageId)return {ok:true,sent:true,recipient:recipient,messageId:prior.messageId};
 const recovered=recover();if(recovered)return recovered;
 if(prior.startedAt)return {ok:false,sent:false,code:'uncertain'};
 properties.setProperty(key,JSON.stringify({startedAt:new Date().toISOString()}));
 GmailApp.sendEmail(recipient,'[YG Finance] PJUM untuk diperiksa - '+p.number,
 ['Yth. Bu Riena,','','Laporan PJUM '+p.number+' telah diajukan untuk pemeriksaan.','Buka laporan, Excel, kuitansi, dan catatan hasil analisis di YG Finance:',p.reviewUrl,'','Silakan masuk dengan akun Finance yang berwenang. Pengajuan ini belum merupakan persetujuan PJUM.','','Referensi: '+marker].join('\n'),{name:'YG Finance'});
 return recover()||{ok:false,sent:false,code:'uncertain'};
 } finally {lock.releaseLock();}
}
