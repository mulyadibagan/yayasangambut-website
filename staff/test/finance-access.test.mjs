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

test('email sync keeps owner and origin checks and forwards only the existing intake operation',async()=>{
 const path='/finance/email-sync',owner={id:'owner',email:'mulyadi@yayasangambut.org',role:'admin'};
 assert.equal((await worker.fetch(request(path,false),env(null))).status,401);
 assert.equal((await worker.fetch(request(path),env({...owner,role:'staff'}))).status,403);
 const e=env(owner);const calls=[];
 e.FINANCE={async fetch(req){calls.push(req);return Response.json({sync:{status:'success',scannedCount:2,imported:1,error:'secret'},candidates:[{title:'<script>bad</script>',amount:10}]});}};
 let r=await worker.fetch(request(path),e);const html=await r.text();
 assert.equal(r.status,200);assert.equal(calls[0].url,origin+'/finance/api/email-intake');
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('secret'));
 const post=site=>new Request(origin+path,{method:'POST',headers:{Cookie:'__Host-yg-session=test',Origin:site}});
 assert.equal((await worker.fetch(post('https://evil.example'),e)).status,403);assert.equal(calls.length,1);
 r=await worker.fetch(post(origin),e);assert.equal(r.status,200);
 assert.equal(calls[1].url,origin+'/finance/api/email-intake?scan=1');
 assert.equal(calls[1].method,'GET');assert.equal(calls[1].headers.get('cookie'),null);
 assert.equal(calls[1].headers.get('oai-authenticated-user-email'),owner.email);
});

test('Riena reaches Finance pages and APIs with her own trusted identity',async()=>{
 const user={id:'finance',email:'rienaprasiddha@yayasangambut.org',role:'staff'};
 const e=env(user);e.FINANCE={async fetch(req){assert.equal(req.headers.get('oai-authenticated-user-email'),user.email);assert.equal(req.headers.get('cookie'),null);return new Response('ok');}};
 for(const path of ['/finance','/finance/closing-2026','/finance/api/requests','/finance/assets/app.js']){
  assert.equal((await worker.fetch(request(path),e)).status,200);
  assert.equal((await worker.fetch(request(path),env({...user,disabled:1}))).status,403);
 }
 const spoof=request('/finance');spoof.headers.set('oai-authenticated-user-email',user.email);
 assert.equal((await worker.fetch(spoof,env({id:'other',email:'other@yayasangambut.org',role:'admin'}))).status,403);
});

test('Finance browser navigation redirects missing and expired sessions to sign-in',async()=>{
 for(const path of ['/finance','/finance/closing-2026','/finance/payroll','/finance/payroll/report']){
  for(const cookie of ['', '__Host-yg-session=expired']){
   const r=await worker.fetch(new Request(origin+path,{headers:{Accept:'text/html',Cookie:cookie}}),env(null));
   assert.equal(r.status,302);assert.equal(r.headers.get('location'),origin+'/');assert.equal(r.headers.get('cache-control'),'no-store');
  }
 }
 for(const path of ['/finance/api/requests','/finance/payroll/api/report','/api/finance']){
  const r=await worker.fetch(new Request(origin+path,{headers:{Accept:'text/html'}}),env(null));assert.equal(r.status,401);
 }
 const write=await worker.fetch(new Request(origin+'/finance/payroll',{method:'POST',headers:{Accept:'text/html',Origin:origin}}),env(null));assert.equal(write.status,401);
 const denied=await worker.fetch(new Request(origin+'/finance',{headers:{Accept:'text/html',Cookie:'__Host-yg-session=other'}}),env({id:'other',email:'other@yayasangambut.org',role:'staff'}));assert.equal(denied.status,403);
});

test('Finance login redirect remembers the requested page and query in a short-lived secure cookie',async()=>{
 const path='/finance/payroll/report?period=2026-10';
 const r=await worker.fetch(new Request(origin+path,{headers:{Accept:'text/html'}}),env(null));
 assert.equal(r.status,302);assert.equal(r.headers.get('location'),origin+'/');
 const cookie=r.headers.get('set-cookie');
 assert.ok(cookie.includes('__Host-yg-finance-return='+encodeURIComponent(path)));
 for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/','Max-Age=600'])assert.ok(cookie.includes(flag));
});
