import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Original PDFs are archived once. Visitors never fetch government/Drive APIs.
const records=JSON.parse(await readFile(new URL('../src/data/regulations.json',import.meta.url),'utf8')).filter(r=>r.fileUrl);
const version=createHash('sha256').update(records.map(r=>`${r.id}:${r.sha256}`).sort().join('\n')).digest('hex').slice(0,12);
const tag=`regulation-documents-${version}`;
const archive='regulation-documents.tar.gz';
const root=resolve(process.argv.includes('--dist')?'dist':'public');
const directory=resolve(root,'documents/regulations');
const work=resolve('.regulation-archive');
await mkdir(directory,{recursive:true});await mkdir(work,{recursive:true});
const verify=async()=>{
 for(const r of records){const b=await readFile(resolve(root,r.fileUrl.slice(1)));if(b.subarray(0,5).toString()!=='%PDF-'||b.length!==r.fileBytes||createHash('sha256').update(b).digest('hex')!==r.sha256)throw new Error(`Invalid PDF or checksum: ${r.id}`);}
 console.log(`Verified ${records.length} regulation PDFs (${tag})`);
};
if(process.argv.includes('--verify')){await verify();process.exit(0);}
const gh=(args)=>execFileSync('gh',args,{stdio:['ignore','pipe','pipe']});
const repo=process.env.GITHUB_REPOSITORY||'mulyadibagan/yayasangambut-website';
let cached=false;
try{gh(['release','download',tag,'--repo',repo,'--pattern',archive,'--dir',work,'--clobber']);cached=true;}catch(error){if(!process.argv.includes('--publish'))throw error;}
if(cached){
 const entries=execFileSync('tar',['-tzf',resolve(work,archive)],{encoding:'utf8'}).trim().split('\n');
 const allowed=new Set(records.map(r=>r.fileUrl.slice(1)));
 if(entries.some(path=>!allowed.has(path)))throw new Error('Unexpected archive entry');
 execFileSync('tar',['-xzf',resolve(work,archive),'-C',root]);
 await verify();
}else{
 for(const r of records){
  let valid=false;try{const b=await readFile(resolve(root,r.fileUrl.slice(1)));valid=createHash('sha256').update(b).digest('hex')===r.sha256;}catch{}
  if(valid)continue;
  const source=new URL(r.documentSourceUrl);if(source.protocol!=='https:'||!source.hostname.endsWith('.go.id'))throw new Error(`Non-government source: ${r.id}`);
  let failure;
  for(let attempt=0;attempt<3;attempt++){
   try{const response=await fetch(source,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const b=Buffer.from(await response.arrayBuffer());if(b.subarray(0,5).toString()!=='%PDF-'||b.length!==r.fileBytes||createHash('sha256').update(b).digest('hex')!==r.sha256)throw new Error('Source content changed; editorial review required');await writeFile(resolve(root,r.fileUrl.slice(1)),b);failure=null;break;}catch(e){failure=e;}
  }
  if(failure)throw new Error(`Cannot archive ${r.id}: ${failure.message}`);
 }
 await verify();
 execFileSync('tar',['-czf',resolve(work,archive),'-C',root,...records.map(r=>r.fileUrl.slice(1))]);
 gh(['release','create',tag,resolve(work,archive),'--repo',repo,'--target',process.env.GITHUB_SHA||'main','--title','Reviewed regulation documents','--notes','Original government PDFs used by the YG knowledge section. File checksums and source URLs are recorded in src/data/regulations.json. Preserve this archive for future deployments.','--latest=false']);
 console.log(`Created immutable media archive ${tag}`);
}
