import { getCollection } from 'astro:content';

// Resolve from published content at build time; no translation API or data fetch
// is needed when a visitor opens the public website.
export async function articlePairs(): Promise<Record<string,string>> {
  const articles=await getCollection('articles',({data})=>data.status==='published');
  const groups=new Map<string,Partial<Record<'id'|'en',string>>>();
  for(const article of articles){
    const filename=article.id.split('/').pop()!.replace(/\.md$/,'');
    const key=article.data.translationKey||(filename.startsWith('staff-')?filename:undefined);
    if(!key)continue;
    const lang=article.data.language;
    const group=groups.get(key)||{};
    group[lang]=`/${lang}/${lang==='id'?'cerita':'field-stories'}/${article.data.slug}/`;
    groups.set(key,group);
  }
  const pairs:Record<string,string>={};
  for(const {id,en} of groups.values())if(id&&en){pairs[id]=en;pairs[en]=id;}
  return pairs;
}
