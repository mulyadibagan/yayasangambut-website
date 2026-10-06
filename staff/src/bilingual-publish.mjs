import {articleMarkdown,fail} from './core.mjs';
import {translatePost} from './translation.mjs';
const articlePath=(language,id)=>`src/content/articles/${language}/staff-${id}.md`;
function readSlug(content){const match=content?.match(/^slug: (.+)$/m);if(!match)return null;try{return JSON.parse(match[1]);}catch{return match[1].replace(/^['"]|['"]$/g,'');}}
export async function bilingualFiles(env,p,removing,readFile){
  const sourcePath=articlePath(p.language,p.id);
  if(removing){
    const files=[];
    for(const language of ['id','en']){
      const path=articlePath(language,p.id),existing=await readFile(path);
      if(existing)files.push({path,content:existing.replace(/^status:.*$/m,'status: "draft"')});
    }
    return files;
  }
  if(p.language!=='id')return [{path:sourcePath,content:articleMarkdown(p)}];
  const targetPath=articlePath('en',p.id),existing=await readFile(targetPath);
  const english=await translatePost(env,p);
  english.slug=readSlug(existing)||(english.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'field-story')+'-'+p.id.slice(0,8);
  const translationKey='staff-'+p.id;
  return [{path:sourcePath,content:articleMarkdown({...p,translationKey})},{path:targetPath,content:articleMarkdown({...english,translationKey})}];
}
// A single commit prevents a half-published language pair. Ref conflicts are
// retried against the new tree; unrelated staff or website changes are retained.
export async function commitFiles(env,access,files,message,gh){
  if(!files.length)fail(409,'Tidak ada artikel terbit yang dapat ditarik.');
  for(let attempt=0;attempt<3;attempt++){
    const ref=await gh(env,'/git/ref/heads/'+env.GITHUB_BRANCH,access);
    const head=await gh(env,'/git/commits/'+ref.object.sha,access);
    const tree=await gh(env,'/git/trees',access,'POST',{base_tree:head.tree.sha,tree:files.map(f=>({...f,mode:'100644',type:'blob'}))});
    if(tree.sha===head.tree.sha)return ref.object.sha;
    const commit=await gh(env,'/git/commits',access,'POST',{message,tree:tree.sha,parents:[ref.object.sha]});
    try{await gh(env,'/git/refs/heads/'+env.GITHUB_BRANCH,access,'PATCH',{sha:commit.sha,force:false});return commit.sha;}
    catch(e){const latest=await gh(env,'/git/ref/heads/'+env.GITHUB_BRANCH,access);if(latest.object.sha===commit.sha)return commit.sha;if(latest.object.sha===ref.object.sha||attempt===2)throw e;}
  }
}
