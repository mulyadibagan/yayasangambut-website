import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = 'https://yayasangambut.org';
const api = `${origin}/wp-json/wp/v2`;
const root = process.cwd();

const decode = (value = '') => value
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replaceAll('&nbsp;', ' ')
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

const plain = (html = '') => decode(html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());

const excerpt = (value = '', maxLength = 280) => {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const candidate = clean.slice(0, maxLength + 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const cut = lastSpace > Math.floor(maxLength * 0.65) ? candidate.slice(0, lastSpace) : clean.slice(0, maxLength);
  return `${cut.replace(/[\s,;:.!?–—-]+$/u, '')}…`;
};

const yaml = (value) => JSON.stringify(value ?? '');

function markdownFromHtml(input = '') {
  let html = input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--.*?-->/gs, '');

  html = html.replace(/<iframe[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi,
    (_, src) => `\n\n[Media tersemat](${decode(src)})\n\n`);

  html = html.replace(/<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi,
    (_, src, alt, caption = '') => `\n\n![${plain(alt)}](${decode(src)})${caption ? `\n\n_${plain(caption)}_` : ''}\n\n`);
  html = html.replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
    (_, src, alt) => `\n\n![${plain(alt)}](${decode(src)})\n\n`);
  html = html.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `[${plain(label) || decode(href)}](${decode(href)})`);
  html = html.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  html = html.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');
  html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n\n# $1\n\n');
  html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n\n## $1\n\n');
  html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n\n### $1\n\n');
  html = html.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n#### $1\n\n');
  html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  html = html.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n\n> $1\n\n');
  html = html.replace(/<br\s*\/?\s*>/gi, '\n');
  html = html.replace(/<\/(p|div|section|ul|ol)>/gi, '\n\n');
  html = html.replace(/<(p|div|section|ul|ol)[^>]*>/gi, '');
  html = decode(html.replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return html.replace(/^# .+?\n+/, '');
}

const imageUrls = (html = '') => [...new Set([...html.matchAll(/<img[^>]+(?:src|data-src)="([^"]+)"/gi)].map(m => decode(m[1])))]
  .filter(url => url.startsWith('https://'));

function detectLanguage(text) {
  const value = ` ${plain(text).toLowerCase()} `;
  const id = [' yang ', ' dan ', ' untuk ', ' dengan ', ' masyarakat ', ' kegiatan ', ' pada ', ' dalam '].reduce((n, word) => n + (value.split(word).length - 1), 0);
  const en = [' the ', ' and ', ' for ', ' with ', ' community ', ' program ', ' from ', ' in '].reduce((n, word) => n + (value.split(word).length - 1), 0);
  return en > id * 1.25 ? 'en' : 'id';
}

async function fetchJson(path) {
  const response = await fetch(`${api}${path}`, { headers: { 'User-Agent': 'Yayasan-Gambut-content-migration/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
  return response.json();
}

async function fetchAll(type, embed = false) {
  const first = await fetch(`${api}/${type}?per_page=100${embed ? '&_embed' : ''}`, { headers: { 'User-Agent': 'Yayasan-Gambut-content-migration/1.0' } });
  if (!first.ok) throw new Error(`${first.status} ${first.statusText}: ${type}`);
  const pages = Number(first.headers.get('x-wp-totalpages') ?? 1);
  const result = await first.json();
  for (let page = 2; page <= pages; page += 1) result.push(...await fetchJson(`/${type}?per_page=100&page=${page}${embed ? '&_embed' : ''}`));
  return result;
}

async function clearGenerated(directory, prefix) {
  await mkdir(directory, { recursive: true });
  for (const name of await readdir(directory)) if (name.startsWith(prefix)) await rm(join(directory, name));
}

function categoriesFor(post) {
  return post._embedded?.['wp:term']?.[0]?.map(item => item.name) ?? [];
}

function categorySlugsFor(post) {
  return post._embedded?.['wp:term']?.[0]?.map(item => item.slug) ?? [];
}

function tagsFor(post) {
  return post._embedded?.['wp:term']?.[1]?.map(item => item.slug) ?? [];
}

function featuredFor(post) {
  return post._embedded?.['wp:featuredmedia']?.[0];
}

function articleMarkdown(post, index) {
  const title = plain(post.title.rendered);
  const bodyText = plain(post.content.rendered);
  const summary = excerpt(plain(post.excerpt.rendered || bodyText).replace(/Read More\s*»?$/i, ''));
  const media = featuredFor(post);
  const featuredImage = media?.media_details?.sizes?.large?.source_url || media?.source_url || imageUrls(post.content.rendered)[0];
  const gallery = [...new Set([featuredImage, ...imageUrls(post.content.rendered)].filter(Boolean))];
  const language = detectLanguage(`${title} ${bodyText}`);
  const category = categoriesFor(post).join(' · ') || (language === 'id' ? 'Cerita Lapangan' : 'Field Story');
  const frontmatter = [
    '---', `title: ${yaml(title)}`, `slug: ${yaml(post.slug)}`, `date: ${yaml(post.date)}`, `modified: ${yaml(post.modified)}`,
    `author: ${yaml(post.uagb_author_info?.display_name || 'Yayasan Gambut')}`, `summary: ${yaml(summary || title)}`, `category: ${yaml(category)}`,
    featuredImage ? `featuredImage: ${yaml(featuredImage)}` : null,
    `imageAlt: ${yaml(media?.alt_text || title)}`, `imageSource: ${yaml(post.link)}`, `gallery: ${JSON.stringify(gallery)}`,
    `categories: ${JSON.stringify(categorySlugsFor(post))}`, `tags: ${JSON.stringify(tagsFor(post))}`,
    `contentType: ${yaml(categorySlugsFor(post).includes('publikasi') ? 'publikasi' : categorySlugsFor(post).includes('artikel') ? 'artikel' : 'berita')}`,
    `language: ${language}`, 'status: published', `featured: ${index < 3}`,
    `originalId: ${post.id}`, `sourceUrl: ${yaml(post.link)}`, 'legacy: true', '---', '',
  ].filter(Boolean).join('\n');
  return `${frontmatter}\n\n${markdownFromHtml(post.content.rendered) || summary}\n`;
}

function teamEntries(aboutHtml) {
  const entries = [];
  const teamProfiles = {
    'Hisam Setiawan': { name: 'Hisam Setiawan', position: 'Pendiri', positionEn: 'Founder', group: 'Governance', photo: '/team/hisam-setiawan.jpeg', order: 1 },
    'Dr.Ir. Lailan Syaufina M.Sc': { name: 'Dr. Ir. Lailan Syaufina, M.Sc.', position: 'Anggota Pendiri', positionEn: 'Founding Member', group: 'Governance', photo: '/team/lailan-syaufina.jpg', order: 2 },
    'Ir. Aep Purnama M.Si': { name: 'Ir. Aep Purnama, M.Si.', position: 'Pengawas', positionEn: 'Supervisory Board Member', group: 'Governance', photo: '/team/aep-purnama.jpg', order: 3 },
    'Mulyadi S.P': { name: 'Mulyadi, S.P.', position: 'Direktur', positionEn: 'Director', group: 'Management & Program Team', photo: '/team/mulyadi.jpg', order: 4 },
    'Ir. Riena Rachmatillah P': { name: 'Ir. Riena Rachmatillah P.', position: 'Manajer Keuangan', positionEn: 'Finance Manager', group: 'Management & Program Team', photo: '/team/riena-rachmatillah.jpg', order: 5 },
    'Riandra Hamdani S.I.Kom': { name: 'Riandra Hamdani, S.I.Kom.', position: 'Program dan Hubungan Masyarakat', positionEn: 'Program and Public Relations', group: 'Management & Program Team', photo: '/team/riandra-hamdani.png', order: 6 },
    'RAVITA SAFITRI S.Si, M.Si, M.Sc': { name: 'Ravita Safitri, S.Si., M.Si., M.Sc.', position: 'Riset dan Pengembangan', positionEn: 'Research and Development', group: 'Management & Program Team', photo: '/team/ravita-safitri.jpeg', order: 7 },
    'AINUL AZIZAH S.H': { name: 'Ainul Azizah, S.H.', position: 'Administrasi dan Keuangan', positionEn: 'Administration and Finance', group: 'Management & Program Team', photo: '/team/ainul-azizah.jpeg', order: 8 },
    'ZAMHARIR, S.Pi': { name: 'Zamharir, S.Pi.', position: 'GIS dan Analisis Spasial', positionEn: 'GIS and Spatial Analysis', group: 'Management & Program Team', photo: '/team/zamharir.jpeg', order: 9 },
    'Dr.M. Amrul Khoiri, SP., MP. C.APO': { name: 'Dr. M. Amrul Khoiri, S.P., M.P., C.APO', position: 'Penasihat Pengelolaan Perkebunan Berkelanjutan', positionEn: 'Sustainable Plantation Management Advisor', group: 'Technical Advisors', photo: '/team/amrul-khoiri.jpg', order: 10 },
    'Joni Irawan, S.P., M.Si': { name: 'Joni Irawan, S.P., M.Si.', position: 'Penasihat Agroforestri', positionEn: 'Agroforestry Advisor', group: 'Technical Advisors', photo: '/team/joni-irawan.jpg', order: 11 },
  };
  const pattern = /elementor-image-box-wrapper[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h5[^>]*class="elementor-image-box-title"[^>]*>([\s\S]*?)<\/h5>[\s\S]*?<p[^>]*class="elementor-image-box-description"[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of aboutHtml.matchAll(pattern)) {
    const sourceName = plain(match[2]); const sourcePosition = plain(match[3]);
    const lower = sourcePosition.toLowerCase();
    const profile = teamProfiles[sourceName] || {
      name: sourceName,
      position: sourcePosition,
      group: /founder|supervisor/.test(lower) ? 'Governance' : /expert/.test(lower) ? 'Technical Advisors' : 'Management & Program Team',
      photo: decode(match[1]),
    };
    if (!profile.name || entries.some(item => item.name === profile.name)) continue;
    entries.push(profile);
  }
  return entries.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function galleryEntries(html) {
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = headings[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    return { title: plain(heading[1]), images: imageUrls(block), summary: plain(block).replace(/Previous|Next/g, ' ').replace(/\s+/g, ' ').trim() };
  }).filter(item => item.title && item.title.toLowerCase() !== 'yayasan gambut' && item.images.length);
}

function publicationEntries(html) {
  const titles = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map(m => plain(m[1])).filter(Boolean);
  const pdfs = [...new Set([...html.matchAll(/href="([^"]+\.pdf(?:\?[^"]*)?)"/gi)].map(m => decode(m[1])) )];
  const covers = imageUrls(html);
  return pdfs.map((fileUrl, index) => ({
    title: titles[index] || decodeURIComponent(fileUrl.split('/').pop().replace(/\.pdf.*$/i, '').replaceAll('-', ' ')),
    fileUrl,
    cover: covers[index],
  }));
}

const posts = await fetchAll('posts', true);
const pages = await fetchAll('pages', true);
const media = await fetchAll('media', false);
const categories = await fetchAll('categories', false);
const tags = await fetchAll('tags', false);
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

for (const lang of ['id', 'en']) await clearGenerated(join(root, 'src', 'content', 'articles', lang), 'wp-');
const storyPosts = posts.filter(post => ![448, 524].includes(post.id));
for (const [index, post] of storyPosts.entries()) {
  const lang = detectLanguage(`${post.title.rendered} ${post.content.rendered}`);
  const filename = `wp-${post.id}-${post.slug}.md`;
  await writeFile(join(root, 'src', 'content', 'articles', lang, filename), articleMarkdown(post, index), 'utf8');
}

const about = pages.find(page => page.slug === 'about');
const team = teamEntries(about?.content?.rendered ?? '');
for (const lang of ['id', 'en']) await clearGenerated(join(root, 'src', 'content', 'team', lang), 'wp-team-');
for (const [index, member] of team.entries()) {
  const slug = member.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = ['---', `name: ${yaml(member.name)}`, `position: ${yaml(member.position)}`, member.positionEn ? `positionEn: ${yaml(member.positionEn)}` : null,
    `group: ${yaml(member.group)}`, `photo: ${yaml(member.photo)}`, 'language: id', 'status: published', `order: ${member.order ?? index + 1}`, '---', ''].filter(Boolean).join('\n');
  await writeFile(join(root, 'src', 'content', 'team', 'id', `wp-team-${slug || index + 1}.md`), file, 'utf8');
}

const documents = pages.find(page => page.slug === 'dokumen');
const publications = publicationEntries(documents?.content?.rendered ?? '');
const pltbPost = posts.find(post => post.id === 448);
const pltbPdf = [...(pltbPost?.content?.rendered ?? '').matchAll(/href="([^"]+BUKU_PLTB_27Juli21(?:-\d+)?\.pdf)"/gi)][0]?.[1]
  || `${origin}/wp-content/uploads/2021/07/BUKU_PLTB_27Juli21.pdf`;
if (pltbPdf && !publications.some(item => item.fileUrl === pltbPdf)) publications.push({
  title: 'Pertanian Lahan Gambut Tanpa Bakar oleh Masyarakat',
  fileUrl: pltbPdf.replace(/BUKU_PLTB_27Juli21-\d+\.pdf$/i, 'BUKU_PLTB_27Juli21.pdf'),
  cover: imageUrls(pltbPost.content.rendered)[0] || `${origin}/wp-content/uploads/2021/07/pltbcrop-1024x705.png`, sourceLink: pltbPost.link,
});
for (const lang of ['id', 'en']) await clearGenerated(join(root, 'src', 'content', 'publications', lang), 'wp-pub-');
for (const [index, publication] of publications.entries()) {
  const slug = publication.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const yearMatch = publication.title.match(/20\d{2}/) || publication.fileUrl.match(/\/(20\d{2})\//);
  const year = Number(yearMatch?.[1] || yearMatch?.[0] || new Date().getFullYear());
  const category = /laporan|report/i.test(publication.title) ? 'Laporan Tahunan' : /panduan|praktik|e-book/i.test(publication.title) ? 'Panduan' : 'Publikasi';
  const summary = category === 'Laporan Tahunan'
    ? `Laporan tahunan resmi Yayasan Gambut untuk tahun ${year}, tersedia dalam format PDF berbahasa Indonesia.`
    : /pengelolaan lahan gambut berkelanjutan/i.test(publication.title)
      ? 'Panduan berbahasa Indonesia tentang pengelolaan lahan gambut berkelanjutan berbasis masyarakat.'
      : /kopi gambut/i.test(publication.title)
        ? 'Publikasi tentang kopi lahan gambut dan pendekatan restorasi berbasis masyarakat.'
        : /rspo/i.test(publication.title)
          ? 'Panduan praktik pengelolaan terbaik bagi petani sawit mandiri dalam konteks RSPO.'
          : /tanpa bakar/i.test(publication.title)
            ? 'Publikasi mengenai praktik pertanian tanpa bakar yang dilakukan bersama masyarakat di lahan gambut.'
            : `Publikasi resmi Yayasan Gambut berjudul “${publication.title}”, tersedia dalam format PDF berbahasa Indonesia.`;
  const file = ['---', `title: ${yaml(publication.title)}`, `slug: ${yaml(slug)}`, `year: ${year}`, `category: ${yaml(category)}`,
    `summary: ${yaml(summary)}`,
    publication.cover ? `cover: ${yaml(publication.cover)}` : null, `fileUrl: ${yaml(publication.fileUrl)}`, 'documentLanguage: id', 'language: id', 'status: published', `featured: ${index < 3}`,
    `sourceUrl: ${yaml(publication.sourceLink || documents.link)}`, 'legacy: true', '---', '', 'Dokumen ini merupakan bagian dari arsip publikasi resmi Yayasan Gambut.', ''].filter(Boolean).join('\n');
  await writeFile(join(root, 'src', 'content', 'publications', 'id', `wp-pub-${index + 1}-${slug}.md`), file, 'utf8');
}

const galleryPage = pages.find(page => page.slug === 'galery');
const galleries = galleryEntries(galleryPage?.content?.rendered ?? '');
const pineappleIndex = galleries.findIndex(item => /nanas/i.test(item.title) && item.images.length > 7);
if (pineappleIndex >= 0) {
  const combined = galleries[pineappleIndex];
  galleries[pineappleIndex] = { ...combined, images: combined.images.slice(0, 7), summary: '' };
  galleries.splice(pineappleIndex + 1, 0, {
    title: 'Flora Alami Ekosistem Rawa Gambut',
    images: combined.images.slice(7),
    summary: combined.summary,
  });
}
await clearGenerated(join(root, 'src', 'content', 'gallery', 'id'), 'wp-gallery-');
for (const [index, gallery] of galleries.entries()) {
  const slug = gallery.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = ['---', `title: ${yaml(gallery.title)}`, `slug: ${yaml(slug)}`, gallery.summary ? `summary: ${yaml(gallery.summary)}` : null,
    `images: ${JSON.stringify(gallery.images)}`, 'language: id', 'status: published', `order: ${index + 1}`, `sourceUrl: ${yaml(galleryPage.link)}`, '---', '', gallery.summary, ''].join('\n');
  await writeFile(join(root, 'src', 'content', 'gallery', 'id', `wp-gallery-${index + 1}-${slug}.md`), file, 'utf8');
}

const contentCategorySlugs = new Set(['artikel', 'berita', 'uncategorized', 'publikasi']);
const locationCategories = categories.filter(item => item.count > 0 && !contentCategorySlugs.has(item.slug));
await clearGenerated(join(root, 'src', 'content', 'locations', 'id'), 'wp-location-');
for (const [index, location] of locationCategories.entries()) {
  const file = ['---', `name: ${yaml(location.name)}`, `slug: ${yaml(location.slug)}`, 'province: Riau',
    `summary: ${yaml(`${location.count} artikel publik terhubung dengan lokasi ini dalam arsip cerita Yayasan Gambut.`)}`,
    'type: lokasi-arsip', `legacyCategorySlug: ${yaml(location.slug)}`, 'language: id', 'status: published', `order: ${index + 2}`,
    '---', '', `Lihat cerita lapangan yang terhubung dengan ${location.name}.`, ''].join('\n');
  await writeFile(join(root, 'src', 'content', 'locations', 'id', `wp-location-${location.slug}.md`), file, 'utf8');
}

const archive = {
  importedAt: new Date().toISOString(), source: origin,
  counts: { posts: posts.length, stories: storyPosts.length, pages: pages.length, media: media.length, categories: categories.length, tags: tags.length, team: team.length, publications: publications.length, galleries: galleries.length, locations: locationCategories.length },
  pages: pages.map(page => ({ id: page.id, date: page.date, modified: page.modified, slug: page.slug, title: plain(page.title.rendered), link: page.link, excerpt: plain(page.excerpt?.rendered), contentText: plain(page.content?.rendered), images: imageUrls(page.content?.rendered) })),
  posts: posts.map(post => ({ id: post.id, date: post.date, modified: post.modified, slug: post.slug, title: plain(post.title.rendered), link: post.link, language: detectLanguage(`${post.title.rendered} ${post.content.rendered}`), categories: categoriesFor(post), categorySlugs: categorySlugsFor(post), tags: tagsFor(post), featuredImage: featuredFor(post)?.source_url, images: imageUrls(post.content.rendered) })),
  categories: categories.map(item => ({ id: item.id, name: item.name, slug: item.slug, parent: item.parent, count: item.count, link: item.link })),
  tags: tags.map(item => ({ id: item.id, name: item.name, slug: item.slug, count: item.count, link: item.link })),
  media: media.map(item => ({ id: item.id, date: item.date, slug: item.slug, title: plain(item.title?.rendered), caption: plain(item.caption?.rendered), alt: item.alt_text, mimeType: item.mime_type, sourceUrl: item.source_url, parent: item.parent, width: item.media_details?.width, height: item.media_details?.height, sizes: Object.fromEntries(Object.entries(item.media_details?.sizes ?? {}).map(([name, data]) => [name, data.source_url])) })),
};
await mkdir(join(root, 'src', 'data'), { recursive: true });
await writeFile(join(root, 'src', 'data', 'legacy-wordpress.json'), `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
const rawArchive = { importedAt: archive.importedAt, source: origin, posts, pages, categories, tags };
await writeFile(join(root, 'src', 'data', 'legacy-wordpress-raw.json'), `${JSON.stringify(rawArchive, null, 2)}\n`, 'utf8');
const staticRedirects = [
  '/ /id/ 302', '/home/ /id/ 301', '/about/ /id/tentang-kami/ 301', '/visi-misi-yayasan/ /id/tentang-kami/#visi 301',
  '/services/ /id/program/ 301', '/program/ /id/program/#proyek 301', '/artikel/ /id/cerita/ 301',
  '/dokumen/ /id/publikasi/ 301', '/publikasi/ /id/publikasi/ 301', '/galery/ /id/galeri/ 301', '/contact/ /id/hubungi-kami/ 301',
  '/sample-page/ /id/ 301', '/donasi/ /id/ 301', '/author/ygadmin/ /id/cerita/ 301',
];
const postRedirects = posts.map(post => {
  if (post.id === 448) return `/${post.slug}/ /id/publikasi/pertanian-lahan-gambut-tanpa-bakar-oleh-masyarakat/ 301`;
  if (post.id === 524) return `/${post.slug}/ /id/publikasi/laporan-tahun-2022/ 301`;
  const lang = detectLanguage(`${post.title.rendered} ${post.content.rendered}`);
  return `/${post.slug}/ /${lang}/${lang === 'id' ? 'cerita' : 'field-stories'}/${post.slug}/ 301`;
});
const categoryById = new Map(categories.map(item => [item.id, item]));
const categoryPath = (item) => item.parent && categoryById.has(item.parent)
  ? `${categoryPath(categoryById.get(item.parent))}/${item.slug}` : item.slug;
const categoryRedirects = categories.filter(item => item.count > 0).map(item => `/category/${categoryPath(item)}/ /id/cerita/?category=${item.slug} 301`);
const tagRedirects = tags.filter(item => item.count > 0).map(item => `/tag/${item.slug}/ /id/cerita/?tag=${item.slug} 301`);
await writeFile(join(root, 'public', '_redirects'), `${[...staticRedirects, ...postRedirects, ...categoryRedirects, ...tagRedirects].join('\n')}\n`, 'utf8');
console.log(JSON.stringify(archive.counts));
