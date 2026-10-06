import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {importApprovedArticles} from '../scripts/import-approved-articles.mjs';
import {bilingualFiles} from '../src/bilingual-publish.mjs';

test('approved import registers six photos, remains editable, preserves revisions on repeat, and withdraws canonical pair',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO users VALUES('owner','mulyadi@yayasangambut.org','YG','admin',0,'2026-10-06','2026-10-06')");
 const oldFetch=globalThis.fetch,puts=[];
 globalThis.fetch=async(url,options)=>{
  const {sql,params}=JSON.parse(options.body);
  const results=db.prepare(sql).all(...params);
  return new Response(JSON.stringify({success:true,result:[{success:true,results}]}));
 };
 try{
  const args={base:'https://test.invalid',token:'test',database:'test',wrangler:a=>puts.push(a)};
  await importApprovedArticles(args);
  const p=db.prepare('SELECT * FROM posts').get();
  assert.equal(p.status,'published');assert.equal(p.slug,'kopi-liberika-ghimbo-pamoan-oktober-2026');
  assert.equal((p.body.match(/<img /g)||[]).length,5);assert.equal(puts.length,6);
  assert.equal(db.prepare('SELECT count(*) n FROM media WHERE public=1').get().n,6);
  assert(!p.body.includes('style='));assert(!p.body.includes('/images/stories/'));
  db.prepare("UPDATE posts SET title='Revisi staf',status='draft',version=2 WHERE id=?").run(p.id);
  await importApprovedArticles(args);
  assert.equal(db.prepare('SELECT title FROM posts').get().title,'Revisi staf');assert.equal(puts.length,6);
  const removed=await bilingualFiles({},p,true,async path=>readFile(new URL('../../'+path,import.meta.url),'utf8'));
  assert.equal(removed.length,2);assert(removed.every(f=>f.content.includes('status: "draft"')));
 }finally{globalThis.fetch=oldFetch;db.close();}
});
