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
test('only active Mulyadi administrator reaches the private YG finance service',async()=>{
 const owner={id:'owner',email:'mulyadi@yayasangambut.org',role:'admin'};
 const e=env(owner);let forwarded;
 e.FINANCE={async fetch(req){forwarded=req;return new Response('YG Finance');}};
 const r=await worker.fetch(request('/finance'),e);
 assert.equal(r.status,200);assert.equal(await r.text(),'YG Finance');assert.equal(r.headers.get('location'),null);
 assert.equal(forwarded.headers.get('cookie'),null);assert.equal(forwarded.headers.get('oai-authenticated-user-email'),owner.email);
 assert.equal((await worker.fetch(request('/finance'),env(owner))).status,503);
 assert.equal((await worker.fetch(request('/finance'),env({...owner,disabled:1}))).status,403);
 assert.equal((await worker.fetch(request('/finance'),env({...owner,role:'editor'}))).status,403);
 assert.equal((await worker.fetch(request('/api/finance/requests'),env(owner))).status,404);
});

test('private assets and APIs require owner and writes require same origin',async()=>{
 const owner={id:'owner',email:'mulyadi@yayasangambut.org',role:'admin'},e=env(owner);let calls=0;
 e.FINANCE={async fetch(req){calls++;assert.equal(req.headers.get('x-yg-finance-user'),owner.email);assert.equal(req.headers.get('oai-authenticated-user-email'),owner.email);return new Response('ok');}};
 for(const path of ['/finance/api/requests','/finance/assets/dashboard.js','/finance/director-signature.png']){
  assert.equal((await worker.fetch(request(path),e)).status,200);
  assert.equal((await worker.fetch(request(path,false),e)).status,401);
 }
 const malicious=new Request(origin+'/finance/api/requests',{method:'POST',headers:{Cookie:'__Host-yg-session=test',Origin:'https://evil.example','x-yg-finance-user':'attacker'}});
 assert.equal((await worker.fetch(malicious,e)).status,403);assert.equal(calls,3);
 const valid=new Request(origin+'/finance/api/requests',{method:'POST',headers:{Cookie:'__Host-yg-session=test',Origin:origin,'oai-authenticated-user-email':'spoof@example.com','x-yg-finance-user':'attacker'},body:'{}'});
 assert.equal((await worker.fetch(valid,e)).status,200);assert.equal(calls,4);
});
