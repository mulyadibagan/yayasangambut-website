import {fail} from './core.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPreview(template,p){
 if(!template.includes('__YG_BODY__'))fail(503,'Pratinjau website belum tersedia.');
 if(!p.cover)template=template.replace(/<figure\b[^>]*>__YG_COVER_IMAGE__[\s\S]*?<\/figure>/,'');
 const fields={TITLE:esc(p.title),CATEGORY:esc(p.category),SUMMARY:esc(p.summary.length>220?p.summary.slice(0,217)+'…':p.summary),AUTHOR:esc(p.author),DATE:esc(new Date().toLocaleDateString(p.language==='en'?'en-GB':'id-ID',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Jakarta'})),COVER_IMAGE:p.cover?'<img src="'+esc(p.cover)+'" width="1600" height="900" alt="'+esc(p.image_alt||p.title)+'">':'',CREDIT:esc(p.image_credit),BODY:p.body};
 return template.replace(/__YG_([A-Z_]+)__/g,(_,key)=>fields[key]??'');
}
