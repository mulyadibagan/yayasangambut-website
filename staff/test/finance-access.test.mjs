import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
const origin='https://staff.yayasangambut.org';
function env(user){return {
 APP_ORIGIN:origin,GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',
 DB:{prepare(sql){return {bind(){return {async first(){return sql.includes('JOIN users')?user:null;}};}};}},
 ASSETS:{fetch(){throw new Error('Finance route must never fall through to public assets');}}
};}
const request=(path,loggedIn=true)=>new Request(origin+path,{headers:loggedIn?{Cookie:'__Host-yg-session=test'}:{}});
test('finance entry requires a session and rejects staff, editors and other administrators',async()=>{
 for(const path of ['/finance','/finance/report.pdf','/api/finance','/api/finance/requests']){
  assert.equal((await worker.fetch(request(path,false),env(null))).status,401);
  for(const role of ['staff','editor','admin']){
   const r=await worker.fetch(request(path),env({id:'other',email:'other@yayasangambut.org',role}));
   assert.equal(r.status,403);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('cache-control'),'no-store');
  }
 }
});
test('only active Mulyadi administrator gets the private existing finance entry',async()=>{
 const owner={id:'owner',email:'mulyadi@yayasangambut.org',role:'admin'};
 const r=await worker.fetch(request('/finance'),env(owner));
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://yg-finance-system.fpur.chatgpt.site');
 assert.equal((await worker.fetch(request('/finance'),env({...owner,disabled:1}))).status,403);
 assert.equal((await worker.fetch(request('/finance'),env({...owner,role:'editor'}))).status,403);
 assert.equal((await worker.fetch(request('/api/finance/requests'),env(owner))).status,404);
});
