import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

// Production indexing is deliberately enabled only through this script.
// Start Astro in a child process so Vite receives PUBLIC_SITE_ENV before it
// initializes import.meta.env. A direct/default Astro build remains noindex.
const require = createRequire(import.meta.url);
const astroPackage = require.resolve('astro/package.json');
const astroCli = resolve(dirname(astroPackage), 'bin/astro.mjs');
const result = spawnSync(process.execPath, [astroCli, 'build', '--mode', 'production'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_SITE_ENV: 'production' },
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
