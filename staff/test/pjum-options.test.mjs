import test from 'node:test';
import assert from 'node:assert/strict';
import {pjumChoices,pjumReadiness,pjumEmailDraft} from '../public/pjum-options.js';
test('PJUM choices include own unpaid reports, exclude submitted reports and deduplicate adopted archives',()=>{
 const me={id:'mul',email:'mulyadi@yayasangambut.org'},base={creator:'mul',number:'UM-1',payload:{activity:'Monitoring',project:'ARC3'},total:100};
 const rows=['draft','approved','disbursed','pjum_draft','pjum_returned','pjum_submitted','closed'].map((status,i)=>({...base,id:String(i),status,...(status==='pjum_draft'?{legacy_id:'adopted'}:{})}));
 rows.push({...base,id:'other',creator:'riena',status:'disbursed'});
 const old={number:'02/ARC3',title:'Arsip',amount:200,applicant:'Mulyadi',bank_status:'Cocok',bank_amount:200,paid_date:'2026-10-01'};
 const archive=[{...old,id:'available',reported:0},{...old,id:'reported',reported:200},{...old,id:'adopted',linked:{id:'3',status:'pjum_draft'}},{...old,id:'other-owner',applicant:'Riena'},{...old,id:'missing-bank',bank_amount:0}];
 const choices=pjumChoices(rows,archive,me);
 assert.deepEqual(choices.map(r=>r.key),['app:2','app:3','app:4','archive:available','archive:missing-bank']);
 assert.equal(choices.at(-1).needsReview,true);assert.equal(choices.at(-2).requiresResolve,true);
});

test('completeness and OCR warnings stay distinct; only incomplete and future reports block sending',()=>{
 const row={report:{items:[{}],report_date:'2026-11-16',notes:''},checks:{complete:true,rows:[{read:true,result:{error:'Unclear'},issues:[],warnings:['Manual check']}]}};
 assert.equal(pjumReadiness(row,'2026-11-16').complete,true);assert.equal(pjumReadiness(row,'2026-11-16').blocked,false);assert.equal(pjumReadiness(row,'2026-11-16').read,0);
 assert.equal(pjumReadiness(row,'2026-11-15').blocked,true);
 row.checks.rows[0].read=false;row.checks.unresolved=4;assert.equal(pjumReadiness(row,'2026-11-16').blocked,false);
 row.report.notes='Pemeriksaan manual';assert.equal(pjumReadiness(row,'2026-11-16').blocked,false);
 row.checks.complete=false;assert.equal(pjumReadiness(row,'2026-11-16').blocked,true);
});

test('email compose uses the reporter account and exact private Finance link without sending',()=>{
 const row={id:'123',creator_email:'reporter@yayasangambut.org',creator_name:'Pelapor',number:'10/ARC3',payload:{activity:'Patroli'}};
 const url=new URL(pjumEmailDraft(row,row.creator_email));
 assert.equal(url.searchParams.get('su'),'PJUM — Patroli — 10/ARC3');assert.equal(url.origin,'https://mail.google.com');assert.equal(url.searchParams.get('authuser'),row.creator_email);
 assert.equal(url.searchParams.get('to'),'rienaprasiddha@yayasangambut.org');
 assert.ok(url.searchParams.get('body').includes('https://staff.yayasangambut.org/finance/advances?id=123'));
 assert.equal(pjumEmailDraft(row,'other@yayasangambut.org'),null);
});

test('surplus requires refund evidence while zero balance remains optional',()=>{const row={total:100,report:{total:80,items:[{}],report_date:'2026-11-17'},checks:{complete:true,rows:[]},files:[]};assert.equal(pjumReadiness(row,'2026-11-17').blocked,true);assert.equal(pjumReadiness({...row,files:[{purpose:'settlement'}]},'2026-11-17').blocked,false);assert.equal(pjumReadiness({...row,total:80},'2026-11-17').blocked,false);assert.equal(pjumReadiness({...row,total:70},'2026-11-17').blocked,false);});
