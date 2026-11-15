import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
const hook=registerHooks({resolve(s,c,next){if(s==='sanitize-html')return {url:'data:text/javascript,export default ()=>{}',shortCircuit:true};return next(s,c);}});
const {parseProjectActivities,projectCommitments,linkAdvanceProject}=await import('../src/advance-projects.mjs');hook.deregister();
const html='<article class="aramco-activity-card"><div class="aramco-activity-main"><code>1.1</code><span><b>Kegiatan &amp; pelatihan</b></span></div><div class="aramco-budget-cell"><b>Rp&nbsp;1.000.000</b></div><div data-label="UM kumulatif"><b>Rp 200.000</b></div><div data-label="Realisasi"><b>Rp 180.000</b></div></article>';
test('project ceilings come from the same activity cards and existing commitments are not added twice',()=>{
 const activities=parseProjectActivities(html);assert.equal(activities[0].budget,1000000);assert.equal(activities[0].legacyCommitted,200000);assert.equal(activities[0].name,'Kegiatan & pelatihan');
 const rows=[['draft',900000],['submitted',300000],['closed',100000],['cancelled',900000]].map(([status,amount],i)=>({id:String(i),status,payload:{project_id:'X',allocations:[{code:'1.1',amount}]}}));
 const result=projectCommitments({id:'X',activities},rows).activities[0];assert.equal(result.draft,900000);assert.equal(result.pending,300000);assert.equal(result.disbursed,100000);assert.equal(result.remaining,400000);
 assert.equal(projectCommitments({id:'X',activities},rows,'1').activities[0].remaining,700000);
});
test('server owns project names and allocation ceilings, and rejects unknown activity codes',async()=>{
 const env={APP_ORIGIN:'https://staff.yayasangambut.org',FINANCE:{fetch:async()=>new Response(html)}};
 const data={project_id:'ARC3',project:'forged',items:[{activity_code:'1.1',subtotal:100000}]};const out=await linkAdvanceProject(env,{email:'director'},data);assert.equal(out.project,'Aramco Phase 3');assert.equal(out.allocations[0].budget,1000000);
 await assert.rejects(()=>linkAdvanceProject(env,{}, {...data,items:[{activity_code:'unknown',subtotal:1}]}),e=>e.status===400);
});
test('database atomically prevents competing submissions exceeding the same budget',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES(\'u\');');db.exec(readFileSync(new URL('../migrations/0044_advance_requests.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0045_advance_project_budget.sql',import.meta.url),'utf8'));
 const insert=db.prepare('INSERT INTO yg_advance_requests(id,creator,creator_email,creator_name,payload,total,last_event,created_at,updated_at) VALUES(?,\'u\',\'u\',\'u\',?,600,\'x\',\'2026-11-15\',\'2026-11-15\')');
 const payload=JSON.stringify({project_id:'ARC3',allocations:[{code:'1',amount:600,budget:1000,legacyCommitted:0}]});insert.run('a',payload);insert.run('b',payload);db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='a'").run();assert.throws(()=>db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='b'").run(),/ADVANCE_BUDGET_EXCEEDED/);
 db.prepare("UPDATE yg_advance_requests SET status='returned' WHERE id='a'").run();db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='b'").run();assert.equal(db.prepare("SELECT status FROM yg_advance_requests WHERE id='b'").get().status,'submitted');
});
