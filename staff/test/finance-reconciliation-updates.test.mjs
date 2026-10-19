import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileStaffAllocations} from '../scripts/finance-reconciliation-updates.mjs';
function fixture(){
 const closing={entries:[{index:0,reference:'check',date:'2026-01-02',debit:30,credit:0,balance:70,allocations:[{bucket:'STAFF_PENDING',amount:-30}]}],staff:[{name:'Example',carry:20,claim:0,paid:0,usage:0,position:20,cash:20,oldAdvance:0}],staffCash:20,ygCash:80,projectCash:0,pendingStaffCash:-30,bankClosing:70};
 const row={savingId:'PAY-EXAMPLE',staff:'Example',expenseDate:'2026-01-02',year:2026,claimAmount:0,paidAmount:30,usageAmount:0,carryForward:0,currency:'IDR',status:'AVAILABLE',sourceType:'PAYMENT_CONFIRMED',sourceDescription:'Verified payout',sourceUrl:'https://example.org/evidence'};
 const salary={rows:[{...row,savingId:'OPEN',paidAmount:0,carryForward:20,sourceType:'OPENING'}]};
 const update={...closing.entries[0],rows:[row],allocations:[{bucket:'STAFF',amount:-20},{bucket:'YG',amount:-10}],note:'Verified'};
 return {closing,salary,update};
}
test('reclassifies a paid salary with an advance without changing bank history; repeat is idempotent',()=>{
 const {closing,salary,update}=fixture();const result=reconcileStaffAllocations(closing,salary,[update]);
 assert.equal(result.closing.bankClosing,70);assert.equal(result.closing.entries.length,1);assert.equal(result.closing.entries[0].balance,70);
 assert.equal(result.closing.staffCash,0);assert.equal(result.closing.ygCash,70);assert.equal(result.closing.pendingStaffCash,0);assert.equal(result.closing.staff[0].newAdvance,10);assert.equal(result.closing.difference,0);
 assert.deepEqual(reconcileStaffAllocations(result.closing,result.salary,[update]),result);assert.equal(closing.staff[0].paid,0);
});
test('rejects wrong bank references, incomplete allocations, conflicting duplicates and excessive amounts',()=>{
 for(const mutate of [u=>u.reference='wrong',u=>u.rows[0].paidAmount=29,u=>u.allocations[0].amount=-19,u=>u.rows.push({...u.rows[0]})]){
 const {closing,salary,update}=fixture();mutate(update);assert.throws(()=>reconcileStaffAllocations(closing,salary,[update]));
 }
 const {closing,salary,update}=fixture();salary.rows.push({...update.rows[0],savingId:'OTHER'});assert.throws(()=>reconcileStaffAllocations(closing,salary,[update]));
});
