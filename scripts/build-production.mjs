// Production indexing is deliberately enabled only through this script.
// A direct/default Astro build remains a safe, noindex preview.
process.env.PUBLIC_SITE_ENV = 'production';

const { build } = await import('astro');
await build({ mode: 'production' });
