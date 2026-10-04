import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

// The site uses root-relative links. Scope the built output to the Pages project.
const base = '/yayasangambut-website';
const origin = 'https://mulyadibagan.github.io';
async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    files.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}
const files = await walk('dist');
for (const file of files) {
  if (!/\.(html|css|js|xml)$/.test(file)) continue;
  let text = await readFile(file, 'utf8');
  text = text.replace(/(["'`])\/(?!\/)/g, (match, quote, offset, source) =>
    source.slice(offset + 1).startsWith(base + '/') ? match : quote + base + '/');
  text = text.replace(/url\(\/(?!\/)/g, 'url(' + base + '/');
  text = text.replace(/url=\/(?!\/)/gi, 'url=' + base + '/');
  text = text.replaceAll(origin + '/', origin + base + '/');
  await writeFile(file, text);
}
await writeFile('dist/.nojekyll', '');
let checked = 0;
for (const file of files.filter(file => file.endsWith('.html'))) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const url = match[1].split(/[?#]/)[0];
    if (!url.startsWith(base + '/')) continue;
    const target = path.join('dist', decodeURIComponent(url.slice(base.length)));
    try { await stat(target); }
    catch { throw new Error('Missing internal target in ' + file + ': ' + url); }
    checked++;
  }
}
console.log('GitHub Pages output prepared; checked ' + checked + ' internal links/assets.');
