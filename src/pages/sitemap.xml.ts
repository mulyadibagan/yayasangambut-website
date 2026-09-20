import { getCollection } from 'astro:content';
export const prerender = true;
export async function GET() {
  const base = 'https://yayasangambut.org';
  const staticRoutes = ['/id/','/en/','/id/tentang-kami/','/en/about/','/id/program/','/en/programs/','/id/lokasi-kerja/','/en/where-we-work/','/id/dampak/','/en/impact/','/id/cerita/','/en/field-stories/','/id/publikasi/','/en/publications/','/id/hubungi-kami/','/en/contact/','/id/privacy/','/en/privacy/'];
  const content = [...await getCollection('programs'), ...await getCollection('articles'), ...await getCollection('publications')].filter(e => e.data.status === 'published');
  const dynamicRoutes = content.map(entry => { const lang=entry.data.language; const section=entry.collection==='programs'?(lang==='id'?'program':'programs'):entry.collection==='articles'?(lang==='id'?'cerita':'field-stories'):(lang==='id'?'publikasi':'publications'); return `/${lang}/${section}/${entry.data.slug}/`; });
  const urls = [...staticRoutes, ...dynamicRoutes].map(path => `<url><loc>${base}${path}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
