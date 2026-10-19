import test from 'node:test';
import assert from 'node:assert/strict';
import {availableCash} from '../scripts/finance-available-cash.mjs';
const position={generalSaving:100,salaryReserve:40,ygAdvance:10,pendingStaffCash:0};
test('deducts project deficits once, keeps positive project funds separate, and does not deduct payroll again',()=>{
 const result=availableCash(position,[{balance:-30},{balance:5}]);
 assert.deepEqual(result,{projectAdvance:30,projectAvailable:5,generalAvailable:70,savingAvailable:110,totalCash:115});
 assert.equal(availableCash({...position,ygAdvance:999},[{balance:-30},{balance:5}]).totalCash,115);
});
test('confirmed project receipts repay their own advance before leaving a positive project balance',()=>{
 const before=availableCash(position,[{balance:-30},{balance:5}]);
 const partial=availableCash(position,[{balance:-10},{balance:5}]);
 const repaid=availableCash(position,[{balance:0},{balance:5}]);
 const excess=availableCash(position,[{balance:10},{balance:5}]);
 assert.equal(partial.generalAvailable-before.generalAvailable,20);
 assert.equal(repaid.generalAvailable,100);assert.equal(repaid.projectAvailable,5);
 assert.equal(excess.generalAvailable,100);assert.equal(excess.projectAvailable,15);
 assert.equal(excess.totalCash-before.totalCash,40);
});
test('receipt for another project and unconfirmed projections do not repay a deficit',()=>{
 assert.equal(availableCash(position,[{balance:-30,pendingIn:30},{balance:35}]).generalAvailable,70);
});
test('preserves cents and does not clamp an organizational deficit to zero',()=>{
 assert.equal(availableCash({generalSaving:0.1,salaryReserve:0.2},[{balance:-0.3}]).totalCash,0);
 assert.equal(availableCash({generalSaving:5,salaryReserve:20},[{balance:-10}]).generalAvailable,-5);
});
