import { readFile, writeFile } from 'node:fs/promises';

// Only non-secret resource identifiers enter the generated configuration.
const id = process.env.STAFF_D1_DATABASE_ID;
if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '')) {
  throw new Error('Set STAFF_D1_DATABASE_ID to the dedicated yg-staff database UUID.');
}
const source = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
if (!source.includes('REPLACE_WITH_D1_DATABASE_ID')) throw new Error('Unexpected database configuration; review before deployment.');
await writeFile(new URL('../wrangler.deploy.jsonc', import.meta.url), source.replace('REPLACE_WITH_D1_DATABASE_ID', id), {mode: 0o600});
console.log('Dedicated staff deployment configuration prepared.');
