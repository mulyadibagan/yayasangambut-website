import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../src/content/programs/', import.meta.url);
const languages = ['id', 'en'];
const requiredFields = ['slug', 'translationKey', 'language', 'status', 'order', 'reviewedAt'];
const entries = [];

function parseFrontmatter(source, file) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: frontmatter tidak ditemukan`);

  const data = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, '');
    data[key] = value;
  }
  for (const field of requiredFields) {
    if (!data[field]) throw new Error(`${file}: field ${field} wajib diisi`);
  }
  return data;
}

for (const language of languages) {
  const directory = new URL(`${language}/`, root);
  for (const name of (await readdir(directory)).filter((file) => file.endsWith('.md'))) {
    const file = join('src/content/programs', language, name);
    const data = parseFrontmatter(await readFile(new URL(name, directory), 'utf8'), file);
    if (data.language !== language) throw new Error(`${file}: language harus ${language}`);
    if (Number.isNaN(Number(data.order))) throw new Error(`${file}: order harus berupa angka`);
    if (Number.isNaN(Date.parse(data.reviewedAt))) throw new Error(`${file}: reviewedAt tidak valid`);
    entries.push({ file, ...data, order: Number(data.order) });
  }
}

for (const language of languages) {
  const published = entries.filter((entry) => entry.language === language && entry.status === 'published');
  for (const field of ['slug', 'order']) {
    const values = published.map((entry) => entry[field]);
    if (new Set(values).size !== values.length) throw new Error(`Program ${language}: ${field} harus unik`);
  }
}

const published = entries.filter((entry) => entry.status === 'published');
for (const key of new Set(published.map((entry) => entry.translationKey))) {
  const pair = published.filter((entry) => entry.translationKey === key);
  const pairLanguages = pair.map((entry) => entry.language).sort().join(',');
  if (pair.length !== 2 || pairLanguages !== 'en,id') {
    throw new Error(`Program ${key}: wajib memiliki tepat satu versi id dan satu versi en`);
  }
}

console.log(`Program content valid: ${published.length} halaman, ${published.length / 2} pasangan bahasa.`);
