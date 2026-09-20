export function excerpt(value: string, maxLength = 180) {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;

  const candidate = clean.slice(0, maxLength + 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const cut = lastSpace > Math.floor(maxLength * 0.65) ? candidate.slice(0, lastSpace) : clean.slice(0, maxLength);
  return `${cut.replace(/[\s,;:.!?–—-]+$/u, '')}…`;
}

export function categoryLabel(value: string, lang: 'id' | 'en') {
  if (lang === 'id') return value;
  return value
    .replace(/Desa Buruk Bakul/gi, 'Buruk Bakul Village')
    .replace(/Berita/gi, 'News')
    .replace(/artikel/gi, 'Article');
}
