// Verify the real Workers AI binding before deploying. Only synthetic public
// sample text is submitted; this does not publish an article or touch D1/R2.
import {spawn} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
const config='wrangler.ai-check.json',entry='src/ai-check-worker.mjs';
await writeFile(entry,`import {translateBatch} from './translation.mjs';
export default {async fetch(request,env){
 try{const values=await translateBatch(env.AI,[{id:'s0',text:'Yayasan Gambut bersama masyarakat menanam 700 bibit mangrove.'},{id:'s1',text:'Sebanyak 300 bibit masih dirawat di persemaian.'}]);
 const ok=/700/.test(values.s0)&&/Yayasan Gambut/.test(values.s0)&&/mangrove/i.test(values.s0)&&/300/.test(values.s1)&&/nurser/i.test(values.s1)&&!/sebanyak|masyarakat|ditanam/i.test(Object.values(values).join(' '));
 return Response.json({ok,translations:values},{status:ok?200:502});
 }catch(error){return Response.json({ok:false,error:error.name,status:error.status||502},{status:502});}
}};`);
await writeFile(config,JSON.stringify({name:'yg-staff-translation-check',main:entry,compatibility_date:'2026-10-01',compatibility_flags:['nodejs_compat'],ai:{binding:'AI',remote:true},account_id:process.env.CLOUDFLARE_ACCOUNT_ID}));
const child=spawn('./node_modules/.bin/wrangler',['dev','--config',config,'--port','8799','--ip','127.0.0.1'],{stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});
let logs='';child.stdout.on('data',d=>{logs=(logs+d).slice(-6000);});child.stderr.on('data',d=>{logs=(logs+d).slice(-6000);});
try{
 let result;
 for(let i=0;i<40;i++){
  if(child.exitCode!==null)throw Error('AI check runtime did not start. '+logs);
  try{result=await fetch('http://127.0.0.1:8799/',{signal:AbortSignal.timeout(90000)});if(result.ok)break;if(result.status<500||i>=7)break;await result.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,2000));}catch(e){if(e.name==='TimeoutError')throw e;await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 if(!result?.ok)throw Error('Live Workers AI translation check failed (HTTP '+result?.status+'). '+logs);
 const data=await result.json();if(!data.ok)throw Error('Translation validation failed.');
 console.log('Live Workers AI translation check passed:',JSON.stringify(data.translations));
}finally{child.kill('SIGTERM');await Promise.all([rm(config,{force:true}),rm(entry,{force:true})]);}
