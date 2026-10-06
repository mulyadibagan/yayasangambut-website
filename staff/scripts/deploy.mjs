import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importApprovedArticles } from './import-approved-articles.mjs';

const names = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_INSTALLATION_ID', 'GA_SERVICE_ACCOUNT_EMAIL', 'GA_SERVICE_ACCOUNT_KEY'];
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'STAFF_D1_DATABASE_ID', ...names]) {
  if (!process.env[name]?.trim()) throw new Error(`Missing configuration: ${name}`);
}
if (!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('Invalid Cloudflare account ID.');

// Verify exact dedicated resource names before any remote write.
const base = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}`;
async function readResource(path) {
  const response = await fetch(base + path, {headers: {Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`}});
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(`Cloudflare resource verification failed (${response.status}); check token permissions and resources.`);
  return body.result;
}
if (!/^[0-9a-f-]{36}$/i.test(process.env.STAFF_D1_DATABASE_ID)) throw new Error('Invalid D1 ID.');
const db = await readResource(`/d1/database/${process.env.STAFF_D1_DATABASE_ID}`);
if (db.name !== 'yg-staff') throw new Error('Refusing to migrate a database other than yg-staff.');
const bucket = await readResource('/r2/buckets/yg-staff-media');
if (bucket.name !== 'yg-staff-media') throw new Error('Dedicated private R2 bucket missing.');
await import('./setup-config.mjs');

function wrangler(args, input) {
  const result = spawnSync('./node_modules/.bin/wrangler', [...args, '--config', 'wrangler.deploy.jsonc'], {stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit', input, env: {...process.env, CI: 'true'}});
  if (result.error || result.status !== 0) throw new Error('Wrangler failed; inspect the preceding step before retrying.');
}
const folder = await mkdtemp(join(tmpdir(), 'yg-staff-'));
try {
  const path = join(folder, 'secrets.json');
  await writeFile(path, JSON.stringify(Object.fromEntries(names.map(name => [name, process.env[name]]))), {mode: 0o600});
  wrangler(['d1', 'migrations', 'apply', 'DB', '--remote'], 'y\n');
  await importApprovedArticles({base,token:process.env.CLOUDFLARE_API_TOKEN,database:process.env.STAFF_D1_DATABASE_ID,wrangler});
  // Initial deployment fails closed until Google credentials are installed.
  wrangler(['deploy']);
  wrangler(['secret', 'bulk', path]);
} finally {
  await rm(folder, {recursive: true, force: true});
  await rm('wrangler.deploy.jsonc', {force: true});
}
console.log('Deployment commands completed. Workspace login, publishing and analytics still require live acceptance checks.');
