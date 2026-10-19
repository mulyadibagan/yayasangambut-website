import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'staff/public/website-preview');
await mkdir(out,{recursive:true});
// Use the built public site so its actual header, footer and scoped styles stay in sync.
for(const [lang,section,label] of [['id','cerita','Cerita Lapangan'],['en','field-stories','Field Stories']]){
 const dir=join(root,'dist',lang,section);
 const entries=await readdir(dir,{withFileTypes:true});
 const sample=entries.find(e=>e.isDirectory());if(!sample)throw Error('No public article available for preview template');
 let html=await readFile(join(dir,sample.name,'index.html'),'utf8');
 const article=html.match(/<article\b[^>]*class="detail"[^>]*>[\s\S]*?<\/article>/);
 if(!article)throw Error('Public article layout changed; update preview builder');
 const scope=article[0].match(/data-astro-cid-[\w-]+/g)?.[0];if(!scope)throw Error('Missing article style scope');
 const a=' '+scope;
 const content=`<article class="detail"${a}><header class="container"${a}><nav class="breadcrumb" aria-label="Breadcrumb"${a}><a href="https://yayasangambut.org/${lang}/${section}/"${a}>${label}</a><span aria-hidden="true"${a}>／</span><span aria-current="page"${a}>__YG_TITLE__</span></nav><p class="eyebrow"${a}>__YG_CATEGORY__</p><h1${a}>__YG_TITLE__</h1><p class="lede"${a}>__YG_SUMMARY__</p><p class="meta"${a}>__YG_AUTHOR__ · __YG_DATE__</p></header>__YG_COVER__<div class="container prose"${a}>__YG_BODY__</div></article>`;
 html=html.replace(article[0],()=>content).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 // Keep only essential head metadata; never retain the sample article's canonical or schema.
 const head=html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1]||'';
 const styles=[...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
 const inline=[...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 await writeFile(join(out,lang+'.css'),inline+'\n.yg-preview-notice{padding:12px 24px;background:#fff1cb;color:#543b10;text-align:center;font:600 14px/1.5 system-ui}.yg-preview-notice a{margin-left:16px}');
 html=html.replace(/<head[^>]*>[\s\S]*?<\/head>/,()=>`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; script-src 'none'"><title>__YG_TITLE__ — Pratinjau Yayasan Gambut</title><link rel="icon" href="/brand/yayasan-gambut-logo.png">${styles}<link rel="stylesheet" href="/website-preview/${lang}.css"></head>`);
 html=html.replace(/<body([^>]*)>/,`<body$1><div class="yg-preview-notice">${lang==='id'?'Pratinjau privat · Belum diterbitkan':'Private preview · Not published'}<a href="/">${lang==='id'?'Kembali ke dashboard':'Back to dashboard'}</a></div>`);
 html=html.replace(/href="\/(id|en)\//g,'href="https://yayasangambut.org/$1/');
 // Mark the cover separately so drafts without a cover have no blank image.
 html=html.replace('__YG_COVER__',`<figure class="featured"${a}>__YG_COVER_IMAGE__<figcaption${a}>__YG_CREDIT__</figcaption></figure>`);
 if(html.includes('<script'))throw Error('Preview must not contain scripts');
 await writeFile(join(out,lang+'.html'),html);
}
await cp(join(root,'dist/_astro'),join(root,'staff/public/_astro'),{recursive:true});
console.log('Generated private article preview templates (id/en) from public site build.');
