import {SignJWT,importPKCS8} from '../../staff/node_modules/jose/dist/webapi/index.js';
const key=await importPKCS8(process.env.GA_SERVICE_ACCOUNT_KEY,'RS256');
async function token(scope){
 const assertion=await new SignJWT({scope}).setProtectedHeader({alg:'RS256'}).setIssuer(process.env.GA_SERVICE_ACCOUNT_EMAIL).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!r.ok)throw Error('TOKEN_EXCHANGE_FAILED');
 return (await r.json()).access_token;
}
function reason(data){return String(data?.error?.details?.find(d=>d.reason)?.reason||data?.error?.status||'UNKNOWN').replace(/[^A-Z_]/g,'');}
const readToken=await token('https://www.googleapis.com/auth/analytics.readonly');
const probe=await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries',{headers:{Authorization:'Bearer '+readToken}});
const data=await probe.json();
if(probe.ok){console.log('ADMIN_API_ALREADY_ACTIVE');}
else{
 const info=data?.error?.details?.find(d=>d.reason==='SERVICE_DISABLED'&&d.metadata?.service==='analyticsadmin.googleapis.com');
 const consumer=info?.metadata?.consumer;
 if(!/^projects\/\d+$/.test(consumer||'')){console.log('ACTIVATION_BLOCKED: '+reason(data));process.exit(1);}
 console.log('ACTIVATION_PROJECT: '+consumer);
 console.log('ACTIVATION_URL: https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project='+consumer.slice(9));
 const adminToken=await token('https://www.googleapis.com/auth/service.management');
 const r=await fetch('https://serviceusage.googleapis.com/v1/'+consumer+'/services/analyticsadmin.googleapis.com:enable',{method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:'{}'});
 const result=await r.json();
 if(!r.ok){console.log('ACTIVATION_BLOCKED: '+reason(result));process.exit(1);}
 if(result.name&&!/^operations\/[A-Za-z0-9._-]+$/.test(result.name))throw Error('INVALID_OPERATION');
 let op=result;
 for(let i=0;!op.done&&i<12;i++){
  await new Promise(resolve=>setTimeout(resolve,5000));
  const poll=await fetch('https://serviceusage.googleapis.com/v1/'+result.name,{headers:{Authorization:'Bearer '+adminToken}});
  if(!poll.ok)throw Error('OPERATION_CHECK_FAILED');
  op=await poll.json();
 }
 if(!op.done||op.error){console.log('ACTIVATION_PENDING');process.exit(1);}
 console.log('ADMIN_API_ACTIVATED');
}
await import('../../staff/scripts/check-webgis-analytics.mjs');
