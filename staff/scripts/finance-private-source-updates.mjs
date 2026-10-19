import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const allowedFiles=new Set(['app/salary-balance-enhancer.tsx']);
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=()=>{throw Error('Private Finance source update rejected; source values are not logged.');};

export function applyVerifiedSourceUpdate(source,patch){
 source=source.replace(/\r\n/g,'\n');
 if(!patch||!allowedFiles.has(patch.file)||!Array.isArray(patch.replacements)||!patch.replacements.length||patch.replacements.length>100||![patch.beforeSha256,patch.afterSha256].every(h=>/^[a-f0-9]{64}$/.test(h)))fail();
 if(hash(source)===patch.afterSha256)return source;
 if(hash(source)!==patch.beforeSha256)fail();
 for(const {from,to} of patch.replacements){
  if(typeof from!=='string'||!from||typeof to!=='string'||source.split(from).length!==2)fail();
  source=source.replace(from,()=>to);
 }
 if(hash(source)!==patch.afterSha256)fail();
 return source;
}

export async function applyPrivateSourceUpdates(root,patches){
 if(!Array.isArray(patches)||patches.length>100)fail();
 const pending=new Map();
 for(const patch of patches){
  if(!allowedFiles.has(patch?.file))fail();
  const file=resolve(root,patch.file);
  const source=pending.get(file)??await readFile(file,'utf8');
  pending.set(file,applyVerifiedSourceUpdate(source,patch));
 }
 for(const [file,source] of pending)await writeFile(file,source);
 if(pending.size)console.log('Private Finance source updates verified by before/after hashes.');
}
