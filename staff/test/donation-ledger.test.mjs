import test from 'node:test';
import assert from 'node:assert/strict';
import {donationReport} from '../src/donation-ledger.mjs';
const source=()=>({asOf:'2026-11-19',entries:[],rows:[]});
const report=()=>({staff:[{id:'staff:zamharir',name:'Zamharir, S.Pi.',opening:0,allocation:100,paid:0,usage:0,position:100,sources:[]},{id:'staff:riena-rachmatillah',name:'Ir. Riena Rachmatillah P.',opening:0,allocation:0,paid:80,usage:0,position:-80,sources:[]}],bookBalance:1000,bankBalance:1000,generalSaving:900,salaryReserve:100,issues:[]});
const donation=()=>({id:'one',seq:1,version:1,payload:{amount:135,date:'2026-11-21',donor:'Donor',reference:'UNIQUE123',allocations:[{kind:'salary',staff:'Zamharir',amount:55},{kind:'salary',staff:'Riena Rachmatillah',amount:80}]}});
test('accepted split increases salary reserve and restores deficit without creating bank income',()=>{
 const s=source(),r=report(),d=donation(),out=donationReport(r,s,[d]);
 assert.equal(out.staff[0].position,155);assert.equal(out.staff[1].position,0);assert.equal(out.salaryReserve,155);assert.equal(out.generalSaving,980);assert.equal(out.bookBalance,1135);assert.equal(out.bankBalance,1000);assert.equal(out.donationAdditional,135);
 assert.equal(r.staff[0].position,100);assert.equal(s.entries.length,0);assert.deepEqual(donationReport(r,s,[d]),out);
});
test('later bank import consumes pending allocation without counting cash twice',()=>{
 const s=source();s.asOf='2026-11-21';s.entries=[{index:8,date:'21 Nov 2026 10:00:00',reference:'UNIQUE123',credit:135,debit:0,allocations:[{bucket:'STAFF_PENDING',amount:135}]}];
 const r=report();r.bookBalance=r.bankBalance=1135;const out=donationReport(r,s,[donation()]);
 assert.equal(out.bookBalance,1135);assert.equal(out.donationAdditional,0);assert.equal(out.donationPendingUsed,135);assert.equal(out.salaryReserve,155);assert.equal(out.generalSaving,980);
});
test('existing staff source rows are replaced rather than duplicated; editing allocation recomputes',()=>{
 const s=source();s.asOf='2026-11-21';s.rows=[{savingId:'old',staff:'Zamharir',claimAmount:135}];s.entries=[{index:8,date:'2026-11-21',reference:'UNIQUE123',credit:135,debit:0,allocations:[{bucket:'STAFF',amount:135}]}];
 const r=report();r.staff[0].position=235;r.staff[0].allocation=235;r.salaryReserve=235;r.bookBalance=1135;
 const cfg={staffAllocations:[{index:8,rows:[{savingId:'old'}]}]};const out=donationReport(r,s,[donation()],cfg);
 assert.equal(out.staff[0].position,155);assert.equal(out.staff[1].position,0);assert.equal(out.donationAdditional,0);assert.equal(out.generalSaving,980);
 const changed=donation();changed.payload.allocations=[{kind:'general',amount:135}];const edited=donationReport(r,s,[changed],cfg);assert.equal(edited.staff[0].position,100);assert.equal(edited.generalSaving,1035);
});
test('ambiguous match, project allocation and old unrecognized income never add a second receipt',()=>{
 for(const ref of ['OTHERREF','UNIQUE123']){const s=source();s.asOf='2026-11-21';s.entries=[{index:8,date:'2026-11-21',reference:ref,credit:135,debit:0,allocations:[{bucket:'ARC3',amount:135}]}];const out=donationReport(report(),s,[donation()]);assert.equal(out.donationAdditional,0);assert.equal(out.staff[0].position,100);assert.equal(out.donationIssues.length,1);}
 const s=source();s.asOf='2026-11-21';const out=donationReport(report(),s,[donation()]);assert.equal(out.bookBalance,1000);assert.equal(out.donationIssues.length,1);
});
