export const prerender = true;
export function GET() {
  const isProduction = import.meta.env.PUBLIC_SITE_ENV === 'production';
  const body = isProduction
    ? 'User-agent: *\nAllow: /\nSitemap: https://yayasangambut.org/sitemap.xml\n'
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
