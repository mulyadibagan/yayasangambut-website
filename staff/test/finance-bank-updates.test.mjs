import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileBankUpdates} from '../scripts/finance-bank-updates.mjs';
const fixture=()=>({bank:{mutations:[],openingBalance:100,closingBalance:100},snapshot:{entries:[],projects:[{key:'P',balance:100,incoming:0,outgoing:0}],asOf:'2026-01-01',bankOpening:100,bankClosing:100,bankDebit:0,bankCredit:0,projectCash:100,calculated:100,findings:[]},updates:[{expectedCount:0,expectedBalance:100,asOf:'2026-01-02',period:'January',source:'User statement',note:'User supplied bank statement',row:{archiveIndex:0,postedAt:'2 Jan 2026 12:00:00',description:'Project advance',reference:'C1',debit:25,credit:0,balance:75},allocations:[{bucket:'P',amount:-25}]}]});
test('private statement addition reconciles bank and project once, preserving source objects',()=>{
 const f=fixture(),r=reconcileBankUpdates(f.bank,f.snapshot,f.updates);
 assert.equal(r.bank.closingBalance,75);assert.equal(r.snapshot.projects[0].balance,75);assert.equal(r.snapshot.difference,0);assert.equal(r.snapshot.transactionCount,1);assert.equal(f.bank.mutations.length,0);
 const again=reconcileBankUpdates(r.bank,r.snapshot,f.updates);assert.equal(again.additions.length,0);assert.deepEqual(again.snapshot,r.snapshot);
});
test('mismatched baseline, balance, allocation and conflicting duplicates abort',()=>{
 for(const mutate of [u=>u.expectedBalance=99,u=>u.row.balance=74,u=>u.allocations[0].amount=-24,u=>u.allocations[0].bucket='UNKNOWN',u=>u.asOf='2025-12-31']){
  const f=fixture();mutate(f.updates[0]);assert.throws(()=>reconcileBankUpdates(f.bank,f.snapshot,f.updates),/validation/);assert.equal(f.bank.mutations.length,0);
 }
 const f=fixture(),r=reconcileBankUpdates(f.bank,f.snapshot,f.updates);f.updates[0].row.description='Conflicting transaction';assert.throws(()=>reconcileBankUpdates(r.bank,r.snapshot,f.updates),/validation/);
});
