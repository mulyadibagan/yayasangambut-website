import test from 'node:test';
import assert from 'node:assert/strict';
import {challenge,identityScope,destination,broker} from '../src/webgis-sso.mjs';
test('PKCE RFC7636 vector',async()=>{assert.equal(await challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');});
test('KUPS never receives staff scope',()=>{const access=identityScope({email:'member@gmail.com',role:'admin'},{scope:'kups-finance'});assert.equal(access.scope,'kups-finance');assert.equal(access.role,'kups');assert.equal(destination(access.scope),'kups-finance.html');assert.throws(()=>identityScope({email:'member@gmail.com'},null));assert.throws(()=>identityScope({email:'staff@yayasangambut.org'},{disabled:1}));});
test('cross origin exchange and missing token rejected',async()=>{const env={};const url=new URL('https://staff.yayasangambut.org/api/webgis/exchange');assert.equal((await broker(new Request(url,{method:'POST',headers:{Origin:'https://example.com'}}),env,url)).status,403);const i=new URL('https://staff.yayasangambut.org/api/webgis/introspect');assert.equal((await broker(new Request(i),env,i)).status,401);});
