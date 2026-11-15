import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
const hook=registerHooks({resolve(s,c,next){if(s==='sanitize-html')return {url:'data:text/javascript,export default ()=>{}',shortCircuit:true};return next(s,c);}});
const {parseProjectActivities,projectCommitments,linkAdvanceProject}=await import('../src/advance-projects.mjs');hook.deregister();
const html='<article class="aramco-activity-card"><div class="aramco-activity-main"><code>1.1</code><span><b>Kegiatan &amp; pelatihan</b></span></div><div class="aramco-budget-cell"><b>Rp&nbsp;1.000.000</b></div><div data-label="UM kumulatif"><b>Rp 200.000</b></div><div data-label="Realisasi"><b>Rp 180.000</b></div></article>';
test('an archive without a RAB never turns past UM amounts into an invented budget',()=>{
 const archive='<table><tr><td><code>1</code></td><th>Kegiatan</th><td>15 Nov 2026</td><td>Rp 500.000</td><td>Rp 400.000</td><td>Rp 100.000</td><td>Laporan</td><td>Dokumen</td></tr></table>';
 const activities=parseProjectActivities(archive);assert.equal(activities[0].budget,null);assert.equal(activities[0].legacyUm,500000);assert.equal(projectCommitments({id:'X',activities},[]).activities[0].remaining,null);
});
test('project ceilings come from the same activity cards and existing commitments are not added twice',()=>{
 const activities=parseProjectActivities(html);assert.equal(activities[0].budget,1000000);assert.equal(activities[0].legacyCommitted,200000);assert.equal(activities[0].name,'Kegiatan & pelatihan');
 const rows=[['draft',900000],['submitted',300000],['closed',100000],['cancelled',900000]].map(([status,amount],i)=>({id:String(i),status,payload:{project_id:'X',allocations:[{code:'1.1',amount}]}}));
 const result=projectCommitments({id:'X',activities},rows).activities[0];assert.equal(result.draft,900000);assert.equal(result.pending,300000);assert.equal(result.disbursed,100000);assert.equal(result.remaining,400000);
 assert.equal(projectCommitments({id:'X',activities},rows,'1').activities[0].remaining,700000);
});
test('server owns project names and allocation ceilings, and rejects unknown activity codes',async()=>{
 const env={APP_ORIGIN:'https://staff.yayasangambut.org',FINANCE:{fetch:async r=>r.url.includes('/api/requests')?Response.json({requests:[]}):new Response(html)}};
 const data={project_id:'ARC3',project:'forged',items:[{activity_code:'1.1',subtotal:100000}]};const out=await linkAdvanceProject(env,{email:'director'},data);assert.equal(out.project,'Aramco Phase 3');assert.equal(out.allocations[0].budget,1000000);
 await assert.rejects(()=>linkAdvanceProject(env,{}, {...data,items:[{activity_code:'unknown',subtotal:1}]}),e=>e.status===400);
});
test('database atomically prevents competing submissions exceeding the same budget',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE users(id TEXT PRIMARY KEY);INSERT INTO users VALUES(\'u\');');db.exec(readFileSync(new URL('../migrations/0044_advance_requests.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0045_advance_project_budget.sql',import.meta.url),'utf8'));
 const insert=db.prepare('INSERT INTO yg_advance_requests(id,creator,creator_email,creator_name,payload,total,last_event,created_at,updated_at) VALUES(?,\'u\',\'u\',\'u\',?,600,\'x\',\'2026-11-15\',\'2026-11-15\')');
 const payload=JSON.stringify({project_id:'ARC3',allocations:[{code:'1',amount:600,budget:1000,legacyCommitted:0}]});insert.run('a',payload);insert.run('b',payload);db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='a'").run();assert.throws(()=>db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='b'").run(),/ADVANCE_BUDGET_EXCEEDED/);
 db.prepare("UPDATE yg_advance_requests SET status='returned' WHERE id='a'").run();db.prepare("UPDATE yg_advance_requests SET status='submitted' WHERE id='b'").run();assert.equal(db.prepare("SELECT status FROM yg_advance_requests WHERE id='b'").get().status,'submitted');
});

test('a linked archive PJUM draft stays outstanding and a submitted report settles it without reserving UM twice',()=>{
 const activities=[{code:'4.1',name:'Community-Based Protection',budget:1000,legacyCommitted:1000,legacyRealized:0,archiveOutstanding:1000}],archive=[{id:'old',reported:0}];
 const payload={legacy:{id:'old',code:'4.1',amount:1000},allocations:[]},row={id:'linked',status:'pjum_draft',payload,report:{total:1000,items:[]}};
 const draft=projectCommitments({id:'ARC3',activities,archive},[row]).activities[0];assert.equal(draft.remaining,0);assert.equal(draft.reportDraft,1000);assert.equal(draft.outstanding,1000);assert.equal(draft.disbursed,0);
 const submitted=projectCommitments({id:'ARC3',activities,archive},[{...row,status:'pjum_submitted'}]).activities[0];assert.equal(submitted.reported,1000);assert.equal(submitted.outstanding,0);assert.equal(submitted.remaining,0);
});

test('live email reservations also update the database ceiling used by new UM submissions',async()=>{
 const env={APP_ORIGIN:'https://staff.yayasangambut.org',FINANCE:{fetch:async r=>r.url.includes('/api/requests')?Response.json({requests:[{id:'email',type:'UM',project:'ARC3',code:'1.1',amount:300000,status:'Menunggu Persetujuan'}]}):new Response(html)}};
 const data=await linkAdvanceProject(env,{email:'director'},{project_id:'ARC3',items:[{activity_code:'1.1',subtotal:100000}]});assert.equal(data.allocations[0].legacyCommitted,500000);
});
