import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {financeLayout,applyFinanceReactShell} from '../scripts/finance-react-shell.mjs';
import worker from '../src/worker.mjs';

const layout='import "./globals.css";\nexport const metadata={metadataBase: new URL("https://old.example"),icons:{icon:"/favicon.svg"},openGraph:{images:["/og.png"]}};\nexport default function Layout({children}){return <html lang="id"><body className="finance"><a href="/" style={{background:"#123f32"}}>← Dashboard Staf YG</a>{children}</body></html>;}';
test('Finance React shell is idempotent and leaves financial source files untouched',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finance-react-shell-'));
 try{
  await mkdir(join(root,'app'));
  await writeFile(join(root,'app/layout.tsx'),layout);
  await writeFile(join(root,'app/finance-archive-dashboard.tsx'),'<img src="/logo-yayasan-gambut.png" alt="Logo Yayasan Gambut" />');
  const ledger='export default {closing:123456,entries:[{amount:9876}]};';
  await writeFile(join(root,'app/finance-ledger-2026.ts'),ledger);
  await applyFinanceReactShell(root);const once=await readFile(join(root,'app/layout.tsx'),'utf8');
  await applyFinanceReactShell(root);assert.equal(await readFile(join(root,'app/layout.tsx'),'utf8'),once);assert.equal(await readFile(join(root,'app/finance-ledger-2026.ts'),'utf8'),ledger);
  assert.equal((once.match(/<FinanceStaffTools \/>/g)||[]).length,1);assert.ok(!once.includes('Dashboard Staf YG'));assert.ok(once.includes('favicon.png'));assert.ok(once.includes('https://staff.yayasangambut.org'));
  const nav=await readFile(join(root,'app/finance-staff-tools.tsx'),'utf8');for(const path of ['/finance/invoices','/finance/payroll','/finance/email-sync'])assert.ok(nav.includes(path));assert.ok(!nav.includes('useEffect'));assert.ok((await readFile(join(root,'app/finance-staff-shell.css'),'utf8')).includes('.yg-finance-tools'));
 }finally{await rm(root,{recursive:true,force:true});}
 assert.throws(()=>financeLayout('export default ()=>null'),/anchor missing/);
});
test('staff proxy preserves Finance React HTML byte-for-byte while keeping private identity forwarding',async()=>{
 const user={id:'owner',email:'mulyadi@yayasangambut.org',role:'admin'},html='<!doctype html><html><head><link rel="icon" href="/favicon.png"></head><body><nav>React navigation</nav><main>Finance</main></body></html>';
 let calls=0;
 const env={APP_ORIGIN:'https://staff.yayasangambut.org',GOOGLE_WORKSPACE_DOMAIN:'yayasangambut.org',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',DB:{prepare(sql){return {bind(){return {async first(){return sql.includes('JOIN users')?user:null;}};}};}},FINANCE:{async fetch(req){calls++;assert.equal(req.headers.get('cookie'),null);assert.equal(req.headers.get('x-yg-finance-user'),user.email);return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}});}}};
 for(const path of ['/finance','/finance/closing-2026','/finance/projects/aramco-phase-3']){
  const response=await worker.fetch(new Request(env.APP_ORIGIN+path,{headers:{Cookie:'__Host-yg-session=test'}}),env);assert.equal(response.status,200);assert.equal(await response.text(),html);assert.equal(response.headers.get('Cache-Control'),'no-store');
 }
 assert.equal(calls,3);
});
