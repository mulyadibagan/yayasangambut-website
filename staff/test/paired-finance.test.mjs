import test from 'node:test';
import assert from 'node:assert/strict';
import {pairedFinanceView} from '../finance-ui/paired-finance.js';
const row={id:'u',number:'01/2026',title:'Monitoring',submitter:'Mulyadi',date:'5 Nov 2026',amount:10000,paid:true,reported:8000,underReview:8000,approved:0,refund:2000,unaccounted:0,outstanding:8000,reports:[{number:'PJUM-1'}]};
const data={projects:[{id:'ARC3',requests:[row,{...row,id:'old',date:'2025-11-05',reported:10000,approved:10000,underReview:0,outstanding:0},{...row,id:'draft',paid:false},{...row,id:'zero',amount:0}]}]};
test('paired rekap filters the same UM rows and totals by year, project, report and owner',()=>{
 const view=pairedFinanceView(data,{year:'2026',search:'PJUM-1'});assert.equal(view.rows.length,1);assert.equal(view.totals.amount,10000);assert.equal(view.totals.reported,8000);assert.equal(view.totals.approved,0);assert.equal(view.totals.refund,2000);assert.equal(view.totals.unaccounted,0);assert.deepEqual(view.years,['2026','2025']);
 assert.equal(pairedFinanceView(data,{project:'PPCF'}).rows.length,0);assert.equal(pairedFinanceView(data,{status:'review'}).rows.length,1);assert.equal(pairedFinanceView(data,{status:'complete'}).rows.length,1);assert.equal(pairedFinanceView(data,{search:'riena'}).rows.length,0);
});
test('missing report means no paired document; drafts and reports under review are never called missing',()=>{
 const pending={projects:[{id:'ARC3',requests:[{...row,reports:[],reported:0},{...row,id:'draft-report',reports:[{status:'Draf'}]}]}]};assert.equal(pairedFinanceView(pending,{status:'missing'}).rows.length,1);
});
