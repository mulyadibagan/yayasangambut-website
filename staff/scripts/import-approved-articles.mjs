import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validatePost,imageType} from '../src/core.mjs';

// Explicitly reviewed imports only. Re-running deployment never overwrites a
// staff edit, resurrects a trashed article, or replaces an existing media row.
export async function importApprovedArticles({base,token,database}) {
  const seed=JSON.parse(await readFile(new URL('../imports/ghimbo-pamoan.json',import.meta.url),'utf8'));
  const origin='https://staff.yayasangambut.org';
  // Already-public photographs are bundled as static assets. No R2 object-write
  // permission is needed, and existing private uploads retain their access rules.
  await mkdir(resolve('public/imported-media'),{recursive:true});
  for(const media of seed.media){
    if(!/^[a-f0-9-]{36}$/.test(media.id)||!/^public\/images\/stories\/2026\/ghimbo-pamoan\/[a-z]+\.webp$/.test(media.file))throw Error('Invalid approved media path.');
    const source=resolve('..',media.file),bytes=await readFile(source);
    if(imageType(bytes)!=='image/webp'||bytes.length>2097152)throw Error('Invalid approved image.');
    await copyFile(source,resolve('public/imported-media',media.id+'.webp'));
  }
  async function sql(query,params=[]) {
    const response=await fetch(`${base}/d1/database/${database}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql:query,params})});
    const result=await response.json();
    if(!response.ok||!result.success||result.result.some(r=>!r.success))throw Error('Approved article import database operation failed.');
    return result.result[0].results;
  }
  if((await sql('SELECT id FROM posts WHERE id=?',[seed.id])).length){console.log('Approved article already managed by staff; preserving all staff changes.');return;}
  const owners=await sql("SELECT id FROM users WHERE email=? AND role='admin' AND disabled=0",[seed.ownerEmail]);
  if(owners.length!==1)throw Error('Article import requires the existing enabled YG administrator.');
  const owner=owners[0].id;
  if((await sql('SELECT id FROM posts WHERE slug=?',[seed.slug])).length)throw Error('Article slug already belongs to another staff post.');
  const p=validatePost(seed,origin,true);
  if((p.body.match(/<img /g)||[]).length!==5||seed.media.length!==6)throw Error('Approved article photo count does not match.');
  const urls=[p.cover,...[...p.body.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m=>m[1])];
  if(urls.some(url=>!seed.media.some(m=>url===origin+'/media/'+m.id)))throw Error('Unregistered article image.');
  for(const media of seed.media){
    if(!/^[a-f0-9-]{36}$/.test(media.id)||!/^public\/images\/stories\/2026\/ghimbo-pamoan\/[a-z]+\.webp$/.test(media.file))throw Error('Invalid approved media path.');
    const bytes=await readFile(resolve('..',media.file));
    if(imageType(bytes)!=='image/webp'||bytes.length>2097152)throw Error('Invalid approved image.');
    const existing=await sql('SELECT owner,filename,size,public FROM media WHERE id=?',[media.id]);
    if(existing.length){
      if(existing[0].owner!==owner||existing[0].filename!==media.filename||existing[0].size!==bytes.length||existing[0].public!==1)throw Error('Media ID collision.');
      continue;
    }
    await sql('INSERT INTO media(id,owner,filename,type,size,public,created_at,asset_path) VALUES(?,?,?,?,?,1,?,?)',[media.id,owner,media.filename,'image/webp',bytes.length,seed.published_at,'/imported-media/'+media.id+'.webp']);
  }
  await sql("INSERT INTO posts(id,owner,title,slug,language,summary,category,author,body,cover,image_alt,image_credit,status,created_at,updated_at,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?,?) ON CONFLICT(id) DO NOTHING",[seed.id,owner,p.title,seed.slug,p.language,p.summary,p.category,p.author,p.body,p.cover,p.image_alt,p.image_credit,seed.published_at,seed.published_at,seed.published_at]);
  await sql('INSERT INTO audit(actor,action,target,created_at) VALUES(?,?,?,?)',[owner,'import_approved_article',seed.id,new Date().toISOString()]);
  const check=await sql('SELECT id,title,status,cover FROM posts WHERE id=?',[seed.id]);
  if(check.length!==1||check[0].status!=='published')throw Error('Article import was not confirmed.');
  console.log('Verified: approved Ghimbo Pamoan article available in staff posts with 6 public media assets.');
}
