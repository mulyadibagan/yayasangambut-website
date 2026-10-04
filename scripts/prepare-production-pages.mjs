import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

// GitHub Pages does not apply Cloudflare's _redirects file. Preserve the old
// public URLs with static redirect pages, while keeping existing pages intact.
const root = path.resolve('dist');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
let redirects = 0;
for (const line of (await readFile('public/_redirects', 'utf8')).split(/\r?\n/)) {
  const [from, to] = line.trim().split(/\s+/);
  if (!from?.startsWith('/') || !to?.startsWith('/') || from.includes('*')) continue;
  const file = path.resolve(root, '.' + decodeURIComponent(from), 'index.html');
  if (!file.startsWith(root + path.sep)) throw new Error('Unsafe redirect path');
  try { await stat(file); continue; } catch {}
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${escape(to)}"><link rel="canonical" href="https://yayasangambut.org${escape(to)}"><title>Yayasan Gambut</title><a href="${escape(to)}">Lanjut ke halaman baru / Continue</a></html>`);
  redirects++;
}
await writeFile(path.join(root, '.nojekyll'), '');
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    files.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}
let media = 0;
for (const file of (await walk(root)).filter(f => f.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  if (html.includes('/yayasangambut-website/')) throw new Error(`Staging path in ${file}`);
  for (const match of html.matchAll(/https?:\/\/(?:www\.)?yayasangambut\.org\/wp-content\/uploads\/[^\s"'<>\)]+/g)) {
    const url = new URL(match[0].replaceAll('&amp;', '&'));
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(root + path.sep)) throw new Error('Unsafe media path');
    await stat(target); // Fail before deployment if any legacy media is missing.
    media++;
  }
}
console.log(`Production Pages ready: ${redirects} legacy redirects; ${media} media references validated.`);
