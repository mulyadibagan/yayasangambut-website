import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {budgetInput,saveBudget,loadBudget,budgetPage} from '../src/project-budget.mjs';
import {advancesRoute} from '../src/advances.mjs';
const sample={version:0,contractStart:'2026-09-14',contractEnd:'2027-09-14',periodStart:'2026-10-01',periodEnd:'2026-12-31',proposalUrl:'https://docs.google.com/document/d/proposal/edit',termUrl:'https://docs.google.com/spreadsheets/d/period/edit',contractUrl:'https://drive.google.com/file/d/contract/view',rows:'JASA\tJASA.1\tPersonel\tOH\t12\t100\t1200\t0\nKEGIATAN\t1.1\tKegiatan\tpaket\t0\t0\t1000\t300'};
function setup(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0047_project_budgets.sql',import.meta.url),'utf8'));const env={DB:{prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},APP_ORIGIN:'https://staff.yayasangambut.org'};return {db,env};}
test('annual services and term activities stay separate; UM uses term ceilings',()=>{
 const d=budgetInput(sample);assert.equal(d.servicesTotal,1200);assert.equal(d.annualActivitiesTotal,1000);assert.equal(d.periodTotal,300);assert.equal(d.activities[1].budget,300);assert.equal(d.activities[0].management,true);
 assert.throws(()=>budgetInput({...sample,rows:sample.rows.replace('\t1200\t0','\t1300\t0')}));assert.throws(()=>budgetInput({...sample,contractStart:'2026-02-30'}));assert.throws(()=>budgetInput({...sample,proposalUrl:'https://untrusted.test/a'}));assert.throws(()=>budgetInput({...sample,rows:sample.rows+'\nKEGIATAN\t1.1\tDuplicate\tpaket\t0\t0\t100\t100'}));
});
test('budget updates are private, versioned, audited, and stale writes cannot overwrite',async()=>{
 const {db,env}=setup(),u={email:'director@example.test'};const d=await saveBudget(env,u,sample);assert.equal(d.version,1);assert.equal((await loadBudget(env)).periodTotal,300);assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_project_budget_history').get().n,1);
 await assert.rejects(()=>saveBudget(env,u,sample),e=>e.status===409);await saveBudget(env,u,{...sample,version:1,rows:sample.rows.replace('\t1000\t300','\t1000\t400')});assert.equal((await loadBudget(env)).periodTotal,400);assert.equal(db.prepare('SELECT COUNT(*) n FROM yg_project_budget_history').get().n,2);
 assert.equal(budgetPage(d,false).includes('id="budget-form"'),false);assert.equal(budgetPage({...d,activities:d.activities.map(a=>({...a,name:'<script>bad</script>'}))},false).includes('<script>bad</script>'),false);
});
test('only Director and Finance can update project budgets; applicant and cross-origin writes are denied',async()=>{
 const {env}=setup(),url=env.APP_ORIGIN+'/finance/advances/api/budget',req=origin=>new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(sample)});
 const staff={id:'z',email:'zamharier@yayasangambut.org',role:'editor'};await assert.rejects(()=>advancesRoute(req(env.APP_ORIGIN),env,staff),e=>e.status===403);
 const u={id:'m',email:'mulyadi@yayasangambut.org',role:'admin'};await assert.rejects(()=>advancesRoute(req('https://other.test'),env,u),e=>e.status===403);assert.equal((await advancesRoute(req(env.APP_ORIGIN),env,u)).status,200);
});
