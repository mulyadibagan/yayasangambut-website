// One-off archive translation. Produces a reviewable artifact only; never pushes
// content or changes the live staff database. Uses the existing Workers AI account.
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {load} from 'js-yaml';
import {createSatteriMarkdownProcessor} from '@astrojs/markdown-satteri';
import {translationSegments} from '../staff/src/translation.mjs';
const out='archive-translations';await mkdir(out,{recursive:true});
const renderer=await createSatteriMarkdownProcessor({syntaxHighlight:false});
const split=s=>{const m=s.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);if(!m)throw Error('Invalid frontmatter');return {data:load(m[1]),body:m[2],frontmatter:m[1]};};
const hash=s=>createHash('sha256').update(s).digest('hex');
const entries=[];
for(const filename of await readdir('src/content/articles/id')){
 if(!filename.startsWith('wp-')||!filename.endsWith('.md'))continue;
 const path='src/content/articles/id/'+filename,source=await readFile(path,'utf8'),entry=split(source);
 if(entry.data.status==='published')entries.push({path,filename,source,...entry});
}
entries.sort((a,b)=>new Date(b.data.date)-new Date(a.data.date));
const english=await Promise.all((await readdir('src/content/articles/en')).filter(f=>f.endsWith('.md')).map(async filename=>({filename,...split(await readFile('src/content/articles/en/'+filename,'utf8'))})));
const pending=entries.filter(e=>!english.some(en=>en.data.originalId===e.data.originalId||en.data.translationKey==='wordpress-'+e.data.originalId));
console.log('Missing English archive editions:',pending.length);
const config='staff/wrangler.archive-check.json',worker='staff/src/archive-check-worker.mjs';
await writeFile(worker,`import {translateBatch} from './translation.mjs';\nexport default {async fetch(request,env){if(request.method==='GET')return Response.json({ready:true});try{const {segments}=await request.json();return Response.json(await translateBatch(env.AI,segments));}catch{return Response.json({error:'Translation failed'},{status:502});}}};`);
await writeFile(config,JSON.stringify({name:'yg-archive-translation',main:'src/archive-check-worker.mjs',compatibility_date:'2026-10-01',compatibility_flags:['nodejs_compat'],ai:{binding:'AI',remote:true},account_id:process.env.CLOUDFLARE_ACCOUNT_ID}));
const child=spawn('./node_modules/.bin/wrangler',['dev','--config','wrangler.archive-check.json','--port','8798','--ip','127.0.0.1'],{cwd:'staff',stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});
let logs='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',d=>{logs=(logs+d).slice(-5000);});
const changes=[],report=[];
async function translate(entry){
 const html=(await renderer.render(entry.body)).code;
 const p={title:entry.data.title,summary:entry.data.summary,category:entry.data.category,image_alt:entry.data.imageAlt||'',body:html};
 const plan=translationSegments(p),values={};let batch=[],size=0;const batches=[];
 for(const segment of plan.segments){if(batch.length&&(size+segment.text.length>4500||batch.length>=25)){batches.push(batch);batch=[];size=0;}batch.push(segment);size+=segment.text.length;}if(batch.length)batches.push(batch);
 for(const segments of batches){
  const cache=out+'/batch-'+hash(JSON.stringify(segments))+'.json';let data;
  try{data=JSON.parse(await readFile(cache,'utf8'));}catch{
   for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch('http://127.0.0.1:8798/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({segments}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Model response rejected');data=await r.json();break;}catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,2000));}
   }
   await writeFile(cache,JSON.stringify(data));
  }
  Object.assign(values,data);
 }
 const translated=plan.assemble(values);
 const key='wordpress-'+entry.data.originalId;
 const slug=translated.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110)+'-'+entry.data.originalId;
 const data={...entry.data,title:translated.title,summary:translated.summary,category:translated.category,imageAlt:translated.image_alt,slug,language:'en',translationKey:key};
 const content='---\n'+Object.entries(data).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n\n'+translated.body+'\n';
 const target='src/content/articles/en/wp-'+entry.data.originalId+'-english.md';
 const idContent=entry.source.replace(/^---\n/,'---\ntranslationKey: '+JSON.stringify(key)+'\n');
 // Both translations must retain the exact image/link references and numeric tokens.
 const refs=s=>[...s.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
 if(JSON.stringify(refs(html))!==JSON.stringify(refs(translated.body)))throw Error('References changed');
 changes.push({path:entry.path,content:idContent},{path:target,content});
 report.push({source:entry.path,sourceHash:hash(entry.source),target,title:translated.title,idTitle:entry.data.title,date:entry.data.date,slug,segments:plan.segments.length,batches:batches.length,status:'translated'});
 await writeFile(out+'/article-'+entry.data.originalId+'.json',JSON.stringify({changes:[{path:entry.path,content:idContent},{path:target,content}],report:report.find(r=>r.source===entry.path)},null,2));
 console.log('Translated:',entry.data.originalId,translated.title);
}
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(child.exitCode!==null)throw Error('Translation runtime did not start: '+logs);
  try{ready=(await fetch('http://127.0.0.1:8798/')).ok;if(ready)break;}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 if(!ready)throw Error('Translation runtime unavailable: '+logs);
 // Two independent articles at a time, bounded to avoid provider rate bursts.
 let index=0;const failures=[];
 await Promise.all([0,1].map(async()=>{while(index<pending.length){const entry=pending[index++];try{await translate(entry);}catch(e){failures.push({source:entry.path,error:e.message});console.error('FAILED',entry.path,e.message);}}}));
 await writeFile(out+'/changes.json',JSON.stringify(changes,null,2));await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 await writeFile(out+'/failures.json',JSON.stringify(failures,null,2));
 console.log('Completed:',report.length,'Failures:',failures.length);
 if(failures.length)process.exitCode=1;
}finally{child.kill('SIGTERM');await Promise.all([rm(config,{force:true}),rm(worker,{force:true})]);}
