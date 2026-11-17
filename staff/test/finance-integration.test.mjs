import test from 'node:test';
import assert from 'node:assert/strict';
import {integrateFinance,financeProject,financeIntegrationRoute} from '../src/finance-integration.mjs';
import {workflowArchiveRows,applyLiveFinanceIntegration} from '../scripts/finance-live-integration.mjs';
import {stripWorkflowArchive} from '../src/finance-budget-integration.mjs';
import {projectCommitments} from '../src/advance-projects.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const bank={to:'2026-11-17',rows:[{id:'2026:1',year:'2026',project:'Aramco Phase 3',credit:100000,debit:0,reference:'IN'},{id:'2026:2',year:'2026',project:'ARC3',credit:0,debit:10000,reference:'PAY'},{id:'2026:3',year:'2026',project:'ARC3',credit:2000,debit:0,reference:'RETURN'}],coverage:[{year:'2026',opening:0,ending:92000,incoming:102000,outgoing:10000,difference:0}]};
const row={id:'r',seq:1,creator_name:'Owner',status:'pjum_draft',created_at:'2026-11-01',total:100,actual:80,payload:JSON.stringify({project_id:'ARC3',activity:'Activity'}),report:JSON.stringify({report_date:'2026-11-17',report_number:'PJUM-2026-1',total:80,items:[{subtotal:80}]}),payment_reference:'PAY',paid_date:'2026-11-01',settlement_reference:'RETURN'};
test('native UM, draft, checked and approved PJUM update the same project without changing bank cash',()=>{
 const before=JSON.stringify({row,bank});
 for(const [status,approved,underReview,outstanding]of [['pjum_draft',0,0,10000],['pjum_submitted',0,8000,10000],['pjum_checked',0,8000,10000],['settlement',8000,0,2000],['closed',8000,0,0]]){
  const r=integrateFinance([],[{...row,status}],bank);assert.equal(r.records.length,2);assert.equal(r.totals.umPaid,10000);assert.equal(r.totals.pjumApproved,approved);assert.equal(r.totals.pjumUnderReview,underReview);assert.equal(r.totals.outstanding,outstanding);assert.equal(r.totals.cashIn,102000);assert.equal(r.totals.cashOut,10000);assert.equal(r.bankClosing,92000);
 }
 assert.equal(JSON.stringify({row,bank}),before);
});
test('legacy UM and already archived completed report merge by identity and preserve the original bank metadata',()=>{
 const archive=[{id:'legacy',type:'UM',document_number:'02/YG_ARC3/11/2026',amount:100,project:'ARC3',status:'Dicairkan',bank_status:'Cocok',bank_amount:100},{id:'PJUM-WORKFLOW-r',type:'PJUM',parent_um_id:'legacy',amount:80,actual_amount:80,status:'Disetujui',project:'ARC3'}];
 const r=integrateFinance(archive,[{...row,status:'closed',legacy_id:'legacy',payload:JSON.stringify({legacy:{number:'02/YG_ARC3/11/2026'},activity:'Activity'})}],bank);
 assert.equal(r.records.length,2);assert.equal(r.totals.umPaid,10000);assert.equal(r.totals.pjumApproved,8000);assert.equal(r.totals.refundVerified,2000);assert.equal(r.totals.outstanding,0);assert.equal(r.records.find(r=>r.type==='UM').bankStatus,'Cocok');
 assert.equal(workflowArchiveRows(archive,[{...row,status:'closed',legacy_id:'legacy'}]).length,2);
});
test('receipt upload, similar bank amount or a duplicate return reference cannot manufacture a refund',()=>{
 const notMatched={...bank,rows:bank.rows.map(r=>({...r,reference:r.reference==='RETURN'?'OTHER':r.reference}))};
 const no=integrateFinance([],[{...row,status:'closed'}],notMatched);assert.equal(no.totals.refundVerified,0);assert.equal(no.totals.outstanding,2000);assert.equal(no.warnings.length,1);
 const twice=integrateFinance([],[{...row,status:'closed'},{...row,id:'r2',seq:2,status:'closed'}],bank);assert.equal(twice.totals.refundVerified,2000);assert.equal(twice.totals.outstanding,2000);assert.equal(twice.totals.cashIn,102000);
});
test('a verified reimbursement settles an overrun once without adding another bank expense',()=>{
 const history={...bank,rows:bank.rows.map(r=>r.reference==='RETURN'?{...r,credit:0,debit:2000}:r),coverage:[{year:'2026',opening:0,ending:88000,incoming:100000,outgoing:12000,difference:0}]};
 const workflow={...row,status:'closed',actual:120,report:JSON.stringify({report_number:'PJUM-2026-1',total:120,items:[]})};
 const r=integrateFinance([],[workflow],history);assert.equal(r.totals.reimbursementVerified,2000);assert.equal(r.totals.overrun,0);assert.equal(r.totals.cashOut,12000);
 const pending=integrateFinance([],[{...workflow,status:'settlement'}],history);assert.equal(pending.totals.reimbursementVerified,0);assert.equal(pending.totals.overrun,2000);
});
test('historical bank-return links and Finance review states use the existing authoritative IDs without requiring a new workflow',()=>{
 const archive=[{id:'um',type:'UM',amount:100,project:'ARC3',status:'Dicairkan'},{id:'report',type:'PJUM',amount:80,actualAmount:80,advanceAmount:100,parentUmId:'um',project:'ARC3',status:'Menunggu Persetujuan'}];
 const history={...bank,verifiedReturns:[{umId:'um',pjumId:'report',index:3,project:'ARC3',reference:'RETURN',amount:20}]};
 const r=integrateFinance(archive,[],history);assert.equal(r.totals.pjumUnderReview,8000);assert.equal(r.totals.pjumApproved,0);assert.equal(r.totals.refundVerified,2000);assert.equal(r.totals.outstanding,8000);assert.equal(r.totals.cashIn,102000);
 assert.equal(financeProject('Operasional YG'),financeProject('Operasional Yayasan'));
});
test('deduplication requires the exact official UM or PJUM number and equal amount, never only a similar title or amount',()=>{
 const a=[{id:'first',type:'UM',documentNumber:'02/YG_ARC3/11/2026',amount:100,project:'ARC3',status:'Dicairkan'},{id:'email-copy',type:'UM',documentNumber:'02/YG_ARC3/11/2026',amount:100,project:'ARC3',status:'Dicairkan'},{id:'third',type:'UM',documentNumber:'03/YG_ARC3/11/2026',amount:100,project:'ARC3',status:'Dicairkan'}];
 assert.equal(integrateFinance(a,[],bank).totals.umPaid,20000);
 const mismatch=integrateFinance(a,[{...row,legacy_id:'first',total:101}],bank);assert.ok(mismatch.warnings.some(w=>w.reason.includes('UM asal')));
 assert.equal(financeProject('YG_Sav'),'YG');assert.equal(financeProject('APRIL Group'),'APRIL');assert.equal(financeProject('Aramco Phase 3'),'ARC3');
});
test('cash totals reconcile by project, preserve legitimate repeats and fail closed for invalid or duplicate bank rows',()=>{
 const r=integrateFinance([],[],bank);assert.equal(r.projects.reduce((n,p)=>n+p.cashIn,0),r.totals.cashIn);assert.equal(r.projects.reduce((n,p)=>n+p.cashOut,0),r.totals.cashOut);assert.equal(r.totals.netCash,92000);
 assert.throws(()=>integrateFinance([],[],{...bank,rows:[...bank.rows,bank.rows[0]]}),/ganda/);
 assert.throws(()=>integrateFinance([],[],{...bank,coverage:[{difference:1}]}),/Rekonsiliasi/);
 assert.equal(integrateFinance([],[],null).cashAvailable,false);assert.equal(integrateFinance([],[],null).bankClosing,null);
 const historical=integrateFinance([],[],{...bank,coverage:[{year:'2025',incoming:0,outgoing:0,difference:100},...bank.coverage]});assert.equal(historical.bankClosing,92000);assert.ok(historical.warnings.some(w=>w.id==='2025'&&w.difference===100));
});
test('integration endpoint denies staff and non-GET requests before reading any financial data',async()=>{
 const request=new Request('https://staff.yayasangambut.org/finance/integration/api');
 assert.equal((await financeIntegrationRoute(request,{}, {email:'zamharier@yayasangambut.org'})).status,403);
 assert.equal((await financeIntegrationRoute(new Request(request,{method:'POST'}),{}, {role:'admin',email:'mulyadi@yayasangambut.org'})).status,405);
});
test('the authorized endpoint reads current database changes immediately while bank balance and source rows remain unchanged',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE finance_requests(id TEXT,type TEXT,amount INTEGER,project TEXT,status TEXT);CREATE TABLE finance_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT);CREATE TABLE yg_advance_requests(id TEXT,seq INTEGER,creator_name TEXT,status TEXT,created_at TEXT,total INTEGER,actual INTEGER,payload TEXT,report TEXT,payment_reference TEXT,paid_date TEXT,settlement_reference TEXT)');
 db.prepare('INSERT INTO finance_settings VALUES(?,?)').run('finance_bank_history_v1',JSON.stringify(bank));
 db.prepare('INSERT INTO yg_advance_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(...['id','seq','creator_name','status','created_at','total','actual','payload','report','payment_reference','paid_date','settlement_reference'].map(k=>row[k]));
 const env={DB:{prepare(sql){return {async all(){return {results:db.prepare(sql).all()};},async first(){return db.prepare(sql).get();}};}}};
 const req=new Request('https://staff.yayasangambut.org/finance/integration/api'),owner={email:'mulyadi@yayasangambut.org',role:'admin'};
 let response=await financeIntegrationRoute(req,env,owner),data=await response.json();assert.equal(data.totals.pjumApproved,0);assert.match(response.headers.get('Cache-Control'),/no-store/);
 db.exec("UPDATE yg_advance_requests SET status='closed'");response=await financeIntegrationRoute(req,env,{email:'rienaprasiddha@yayasangambut.org',role:'staff'});data=await response.json();assert.equal(data.totals.pjumApproved,8000);assert.equal(data.totals.outstanding,0);assert.equal(data.bankClosing,92000);assert.equal(db.prepare('SELECT COUNT(*) n FROM finance_requests').get().n,0);assert.equal(db.prepare('SELECT setting_value FROM finance_settings').get().setting_value,JSON.stringify(bank));db.close();
});
test('a native UM already included in the project dossier reserves its budget once after live refresh',()=>{
 const source={id:'ARC3',activities:[{code:'1.1',legacyUm:300,legacyRealized:180,legacyCommitted:300,budget:1000}]};
 const records=[{id:'old',type:'UM',amount:200},{id:'UM-WORKFLOW-r',type:'UM',amount:100},{id:'PJUM-WORKFLOW-r',type:'PJUM',parentUmId:'UM-WORKFLOW-r',amount:80,status:'Disetujui'}];
 const clean=stripWorkflowArchive(source,records,[{...row,payload:{project_id:'ARC3',allocations:[{code:'1.1',amount:100}]}}]);
 assert.equal(clean.records.length,1);assert.equal(clean.source.activities[0].legacyUm,200);assert.equal(clean.source.activities[0].legacyRealized,100);assert.equal(clean.source.activities[0].legacyCommitted,200);
 const live=projectCommitments({...clean.source,archive:[]},[{...row,status:'closed',payload:{project_id:'ARC3',allocations:[{code:'1.1',amount:100}]},report:{total:80,items:[]}}]).activities[0];
 assert.equal(live.disbursed,100);assert.equal(live.reported,180);assert.equal(live.remaining,700);
});
test('build uses the validated history snapshot and replaces the obsolete monitor without rewriting bank sources',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finance-live-'));try{
  await mkdir(join(root,'app'));await writeFile(join(root,'app/finance-history.json'),JSON.stringify(bank));await writeFile(join(root,'app/layout.tsx'),'export default()=> <body><FinanceStaffTools />{children}</body>');
  const calls=[];await applyLiveFinanceIntegration(root,async(...args)=>calls.push(args));const once=await readFile(join(root,'app/layout.tsx'),'utf8');await applyLiveFinanceIntegration(root,async()=>{});
  assert.equal(await readFile(join(root,'app/layout.tsx'),'utf8'),once);assert.equal((once.match(/<IntegratedFinance \/>/g)||[]).length,1);assert.equal(JSON.parse(calls[0][1][1]).rows.length,3);assert.equal(await readFile(join(root,'app/finance-history.json'),'utf8'),JSON.stringify(bank));
 }finally{await rm(root,{recursive:true,force:true});}
});
