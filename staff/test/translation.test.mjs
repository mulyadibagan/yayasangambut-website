import test from 'node:test';
import assert from 'node:assert/strict';
import {translationSegments,translateBatch,translatePost} from '../src/translation.mjs';
import {bilingualFiles,commitFiles} from '../src/bilingual-publish.mjs';
const source={id:'12345678-abcd',language:'id',title:'Harapan Pesisir',summary:'700 bibit ditanam.',category:'Mangrove',image_alt:'Penanaman mangrove',author:'Raja Alpian',image_credit:'YG',cover:'https://staff.yayasangambut.org/media/abc',slug:'harapan-pesisir',body:'<p>700 bibit <i>Rhizophora</i> ditanam.</p><img src="https://staff.yayasangambut.org/media/abc" alt="Foto masyarakat" /><p><a href="https://example.org/?a=1&amp;b=2">Sumber</a></p>',published_at:'2026-10-06',updated_at:'2026-10-06'};
const fakeAI={run:async(m,input)=>({response:{translations:JSON.parse(input.messages[1].content).segments.map(s=>({...s,text:'English '+s.text}))}})};
function cacheEnv(){const rows=new Map();return {AI:fakeAI,DB:{prepare(){return {bind(id,key,result){return {first:async()=>rows.get(id+key),run:async()=>rows.set(id+key,{result})};}};}}};}
test('translation preserves HTML, photos, links and escapes provider markup',()=>{
 const plan=translationSegments(source);const values=Object.fromEntries(plan.segments.map(s=>[s.id,s.text]));assert.equal(plan.assemble(values).body,source.body);
 for(const s of plan.segments)values[s.id]='<script>bad</script>';
 const out=plan.assemble(values);assert(!out.body.includes('<script>'));assert(out.body.includes('&lt;script&gt;'));assert(out.body.includes('href="https://example.org/?a=1&amp;b=2"'));assert(out.body.includes('src="'+source.cover+'"'));
});
test('missing segments, duplicate IDs and changed figures fail closed',async()=>{
 for(const translations of [[],[{id:'s0',text:'800 seedlings'}],[{id:'wrong',text:'700 seedlings'}]])await assert.rejects(()=>translateBatch({run:async()=>({response:{translations}})},[{id:'s0',text:'700 bibit'}]));
});
test('cache prevents repeated model calls; edited text is retranslated',async()=>{
 const env=cacheEnv();let calls=0;env.AI={run:async(...args)=>{calls++;return fakeAI.run(...args);}};
 const out=await translatePost(env,source);await translatePost(env,source);assert.equal(calls,1);assert.equal(out.author,source.author);assert.equal(out.cover,source.cover);assert.equal(out.image_credit,'YG');await translatePost(env,{...source,title:'Judul baru'});assert.equal(calls,2);
});
test('republishing keeps English URL and paired ID; withdrawal needs no AI',async()=>{
 const env=cacheEnv();const files=await bilingualFiles(env,source,false,async()=> '---\nslug: "existing-english-url"\nstatus: "published"\n---\nOld English');assert.equal(files.length,2);assert(files[1].content.includes('slug: "existing-english-url"'));assert(files.every(f=>f.content.includes('translationKey: "staff-'+source.id+'"')));
 const removed=await bilingualFiles({},source,true,async path=>files.find(f=>f.path===path)?.content);assert.equal(removed.length,2);assert(removed.every(f=>f.content.includes('status: "draft"')));
});
test('article written in English requires no translation',async()=>{const files=await bilingualFiles({},{...source,language:'en'},false,async()=>null);assert.equal(files.length,1);assert(files[0].path.includes('/en/'));});
test('concurrent publication retries using the new base tree without force push',async()=>{
 let head='first',patches=0;const bases=[];
 const gh=async(env,path,access,method,body)=>{
  if(path.startsWith('/git/ref/'))return {object:{sha:head}};
  if(path.startsWith('/git/commits/'))return {tree:{sha:head+'-tree'}};
  if(path==='/git/trees'){bases.push(body.base_tree);return {sha:'new-tree'};}
  if(path==='/git/commits')return {sha:'published'};
  if(path.startsWith('/git/refs/')){assert.equal(body.force,false);if(++patches===1){head='concurrent';throw Error('Conflict');}return {};}
 };
 assert.equal(await commitFiles({GITHUB_BRANCH:'main'},'token',[{path:'one',content:'two'}],'publish',gh),'published');assert.deepEqual(bases,['first-tree','concurrent-tree']);
});
