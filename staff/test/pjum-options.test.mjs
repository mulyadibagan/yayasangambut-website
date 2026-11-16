import test from 'node:test';
import assert from 'node:assert/strict';
import {pjumChoices,pjumReadiness} from '../public/pjum-options.js';
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

test('completeness and OCR warnings stay distinct; incomplete, future and unscanned reports block sending',()=>{
 const row={report:{items:[{}],report_date:'2026-11-16',notes:''},checks:{complete:true,rows:[{read:true,result:{error:'Unclear'},issues:[],warnings:['Manual check']}]}};
 assert.equal(pjumReadiness(row,'2026-11-16').complete,true);assert.equal(pjumReadiness(row,'2026-11-16').blocked,false);assert.equal(pjumReadiness(row,'2026-11-16').read,0);
 assert.equal(pjumReadiness(row,'2026-11-15').blocked,true);
 row.checks.rows[0].read=false;assert.equal(pjumReadiness(row,'2026-11-16').blocked,true);
 row.report.notes='Pemeriksaan manual';assert.equal(pjumReadiness(row,'2026-11-16').blocked,false);
 row.checks.complete=false;assert.equal(pjumReadiness(row,'2026-11-16').blocked,true);
});
