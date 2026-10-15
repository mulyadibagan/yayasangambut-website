import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

test('private binding imports verified files once and rejects corrupted source bytes',async()=>{
 const source=await readFile(new URL('../scripts/deploy-finance.mjs',import.meta.url),'utf8');
 const template=source.slice(source.indexOf('const bootstrap=')+'const bootstrap='.length,source.indexOf('\nawait writeFile(root',source.indexOf('const bootstrap='))).trim().replace(/;$/,'');
 const data=Buffer.from('private finance migration fixture');
 const files=[{key:'finance/test/file',size:data.length,mime:'application/pdf',path:'/source',sha:createHash('sha256').update(data).digest('hex')}];
 const code=Function('migrationFiles','digest','return '+template)(files,'test-snapshot').replace("import app from './index.js';","const app={fetch:()=>new Response('private')};");
 const app=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
 const sqlite=new DatabaseSync(':memory:');
 const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async run(){return sqlite.prepare(sql).run(...args);},async first(){return sqlite.prepare(sql).get(...args)||null;}};}};
 const objects=new Map();
 const BUCKET={async get(key){const bytes=objects.get(key);return bytes?{size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer,text:async()=>bytes.toString()}:null;},async put(key,bytes){objects.set(key,Buffer.from(bytes));},async delete(key){objects.delete(key);}};
 try{
  await DB.prepare('CREATE TABLE yg_finance_upload_events(id TEXT PRIMARY KEY,result TEXT,detail TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();
  await DB.prepare('CREATE TABLE yg_finance_upload_migrations(id TEXT PRIMARY KEY, source_hash TEXT, file_count INTEGER)').run();
  let reads=0;
  const env={DB,BUCKET,ASSETS:{fetch:async()=>{reads++;return new Response(data);}}};
  const scheduled=async()=>{let pending;app.scheduled(null,env,{waitUntil:p=>pending=p});await pending;};
  await scheduled();assert.equal(reads,1);assert.equal(await (await BUCKET.get(files[0].key)).text(),data.toString());
  await scheduled();assert.equal(reads,1);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM yg_finance_upload_migrations').first()).n,1);
  await DB.prepare('DELETE FROM yg_finance_upload_migrations').run();await BUCKET.delete(files[0].key);
  env.ASSETS.fetch=async()=>new Response(Buffer.alloc(data.length));
  await assert.rejects(scheduled,/checksum mismatch/);assert.equal(await BUCKET.get(files[0].key),null);
  assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM yg_finance_upload_migrations').first()).n,0);
 }finally{sqlite.close();}
});
