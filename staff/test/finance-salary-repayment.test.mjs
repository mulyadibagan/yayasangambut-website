import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileBankUpdates} from '../scripts/finance-bank-updates.mjs';
import {reconcileStaffAllocations} from '../scripts/finance-reconciliation-updates.mjs';
import {advanceBreakdown} from '../scripts/finance-advance-breakdown.mjs';
import {availableCash} from '../scripts/finance-available-cash.mjs';

function fixture(){
 const staff=(name,position)=>({name,carry:position,claim:0,paid:0,usage:0,position,cash:Math.max(0,position),oldAdvance:Math.max(0,-position)});
 return {bank:{mutations:[],closingBalance:100},closing:{entries:[],projects:[],transfers:[],staff:[staff('A',-50),staff('B',20)],staffCash:20,ygCash:80,projectCash:0,pendingStaffCash:0,bankClosing:100,bankOpening:100,bankDebit:0,bankCredit:0,calculated:100,asOf:'2026-01-01'},salary:{rows:[]},updates:[]};
}
function receipt(f,amounts){
 const amount=amounts.reduce((s,r)=>s+r.amount,0),index=f.bank.mutations.length;
 const row={archiveIndex:index,postedAt:`2026-01-${String(index+2).padStart(2,'0')}`,description:'Verified replacement',reference:`R-${index}`,debit:Math.max(0,-amount),credit:Math.max(0,amount),balance:f.bank.closingBalance+amount};
 const bankUpdate={row,allocations:[{bucket:'STAFF_PENDING',amount}],expectedCount:index,expectedBalance:f.bank.closingBalance,asOf:row.postedAt,period:'January',source:'Verified statement',note:'Verified'};
 const pending=reconcileBankUpdates(f.bank,f.closing,[bankUpdate]);
 const update={index,date:row.postedAt,reference:row.reference,debit:row.debit,credit:row.credit,note:'Verified staff attribution',rows:amounts.map(r=>({savingId:`S-${index}-${r.staff}`,staff:r.staff,expenseDate:row.postedAt,year:2026,claimAmount:Math.max(0,r.amount),paidAmount:Math.max(0,-r.amount),usageAmount:0,carryForward:0,currency:'IDR',status:'AVAILABLE',sourceType:amount>0?'SALARY_CONFIRMED':'PAYMENT_CONFIRMED',sourceDescription:'Verified replacement',sourceUrl:'https://example.org/evidence'}))};
 const result=reconcileStaffAllocations(pending.snapshot,f.salary,[update]);
 return {...result,bank:pending.bank,updates:[...f.updates,update],bankUpdate,update};
}
function check(f){
 const cash=availableCash({generalSaving:f.closing.ygCash,salaryReserve:f.closing.staffCash},f.closing.projects);
 assert.equal(cash.totalCash,f.bank.closingBalance);assert.equal(f.closing.difference,0);assert.equal(f.closing.pendingStaffCash,0);
 assert.deepEqual(f.closing.transfers,[]);
 return advanceBreakdown(f.closing,f.updates);
}
test('salary replacement repays advance first for partial, exact and excess receipts',()=>{
 for(const amount of [20,50,80,20.25]){
  const f=receipt(fixture(),[{staff:'A',amount}]),report=check(f),a=f.closing.staff[0];
  assert.equal(f.closing.ygCash,80+Math.min(50,amount));assert.equal(a.position,amount-50);
  assert.equal(a.cash,Math.max(0,amount-50));assert.equal(f.closing.staffCash,20+a.cash);
  assert.equal(report.totals.recovered,Math.min(50,amount));assert.equal(report.totals.outstanding,Math.max(0,50-amount));
  assert.equal(report.totals.used,50);assert.equal(f.bank.mutations.length,1);
 }
});
test('replaying reconciliation and the original bank receipt cannot duplicate cash or recovery',()=>{
 const f=receipt(fixture(),[{staff:'A',amount:80}]);
 const r=reconcileStaffAllocations(f.closing,f.salary,[f.update]);assert.deepEqual(r,{closing:f.closing,salary:f.salary});
 assert.deepEqual(reconcileBankUpdates(f.bank,f.closing,[f.bankUpdate]).snapshot,f.closing);
 assert.deepEqual(advanceBreakdown(r.closing,f.updates),check(f));
 assert.throws(()=>advanceBreakdown(f.closing,[f.update,f.update]));
});
test('split receipts restore only the attributed staff advance and update each reserve',()=>{
 const f=receipt(fixture(),[{staff:'A',amount:20},{staff:'B',amount:30}]);
 assert.equal(f.closing.ygCash,100);assert.equal(f.closing.staff[0].position,-30);assert.equal(f.closing.staff[1].cash,50);assert.equal(check(f).totals.recovered,20);
 const other=receipt(fixture(),[{staff:'B',amount:30}]);assert.equal(check(other).totals.recovered,0);assert.equal(other.closing.ygCash,80);
});
test('successive replacements and renewed salary borrowing stay reconciled',()=>{
 let f=fixture();for(const amount of [20,-10,60])f=receipt(f,[{staff:'A',amount}]);
 const r=check(f);assert.equal(r.totals.recovered,60);assert.equal(r.totals.used,60);assert.equal(r.totals.outstanding,0);assert.equal(f.closing.staff[0].cash,20);
});
test('rejects unverified staff, mismatched amounts and conflicting duplicate receipts',()=>{
 assert.throws(()=>receipt(fixture(),[{staff:'Unknown',amount:20}]));
 const f=receipt(fixture(),[{staff:'A',amount:20}]);
 for(const alter of [u=>u.reference='wrong',u=>u.rows[0].claimAmount++,u=>u.rows[0].savingId='OTHER',u=>u.allocations=[{bucket:'STAFF',amount:20}]]){
  const u=structuredClone(f.update);alter(u);assert.throws(()=>reconcileStaffAllocations(f.closing,f.salary,[u]));
 }
});
