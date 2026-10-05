import { getCollection } from 'astro:content';
import { pagePairs } from '../data/site';
export const prerender = true;
export async function GET() {
  const base = 'https://yayasangambut.org';
  const staticPairs = [
    ['/id/', '/en/'],
    ['/id/mitra/', '/en/partners/'],
    ['/id/tentang-kami/', '/en/about/'],
    ['/id/program/', '/en/programs/'],
    ['/id/lokasi-kerja/', '/en/where-we-work/'],
    ['/id/dampak/', '/en/impact/'],
    ['/id/cerita/', '/en/field-stories/'],
    ['/id/publikasi/', '/en/publications/'],
    ['/id/galeri/', '/en/gallery/'],
    ['/id/hubungi-kami/', '/en/contact/'],
    ['/id/privacy/', '/en/privacy/'],
  ] as const;
  const content = [...await getCollection('programs'), ...await getCollection('articles'), ...await getCollection('publications')].filter(e => e.data.status === 'published');
  const routeFor = (entry: (typeof content)[number]) => { const lang=entry.data.language; const section=entry.collection==='programs'?(lang==='id'?'program':'programs'):entry.collection==='articles'?(lang==='id'?'cerita':'field-stories'):(lang==='id'?'publikasi':'publications'); return `/${lang}/${section}/${entry.data.slug}/`; };
  const alternates = (idPath: string, enPath: string) => [
    `<xhtml:link rel="alternate" hreflang="id" href="${base}${idPath}"/>`,
    `<xhtml:link rel="alternate" hreflang="en" href="${base}${enPath}"/>`,
    `<xhtml:link rel="alternate" hreflang="x-default" href="${base}${idPath}"/>`,
  ].join('');
  const staticUrls = staticPairs.flatMap(([idPath,enPath]) => [idPath,enPath].map(path => `<url><loc>${base}${path}</loc>${alternates(idPath,enPath)}</url>`));
  const programs = content.filter(entry => entry.collection === 'programs');
  const programUrls = programs.map(entry => {
    const counterpart = programs.find(candidate => candidate.data.translationKey === entry.data.translationKey && candidate.data.language !== entry.data.language);
    const path = routeFor(entry);
    if (!counterpart) return `<url><loc>${base}${path}</loc></url>`;
    const counterpartPath = routeFor(counterpart);
    const idPath = entry.data.language === 'id' ? path : counterpartPath;
    const enPath = entry.data.language === 'en' ? path : counterpartPath;
    return `<url><loc>${base}${path}</loc>${alternates(idPath,enPath)}</url>`;
  });
  const otherUrls = content.filter(entry => entry.collection !== 'programs').map(entry => { const path=routeFor(entry); const pair=pagePairs[path]; return `<url><loc>${base}${path}</loc>${pair?alternates(entry.data.language==='id'?path:pair,entry.data.language==='en'?path:pair):''}</url>`; });
  const urls = [...staticUrls, ...programUrls, ...otherUrls].join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
