import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileUmReturns,mergeUmReturnRegister,projectUmReturnMetadata} from '../scripts/finance-um-returns.mjs';
import {reconcileBankUpdates} from '../scripts/finance-bank-updates.mjs';
import {availableCash} from '../scripts/finance-available-cash.mjs';
import {advanceBreakdown} from '../scripts/finance-advance-breakdown.mjs';
function initial(){return {bank:{mutations:[],closingBalance:50},snapshot:{entries:[],projects:[{key:'P',balance:-50},{key:'Q',balance:0}],staff:[],transfers:[],ygCash:100,staffCash:0,pendingStaffCash:0,projectCash:-50,bankOpening:50,bankClosing:50,bankDebit:0,bankCredit:0,calculated:50,asOf:'2026-01-01'},records:[{id:'U',type:'UM',project:'P',bankStatus:'Cocok',bankAmount:100},{id:'J',type:'PJUM',project:'P',parentUmId:'U',actualAmount:20,balance:80,submissionVerified:true}],links:[]};}
function receive(f,amount){const index=f.bank.mutations.length,date=`2026-01-0${index+2}`,reference=`R${index}`;const update={row:{archiveIndex:index,postedAt:date,description:'UM return',reference,debit:0,credit:amount,balance:f.bank.closingBalance+amount},allocations:[{bucket:'P',amount}],expectedCount:index,expectedBalance:f.bank.closingBalance,asOf:date,period:'January',source:'Verified statement',note:'Verified UM return'};const posted=reconcileBankUpdates(f.bank,f.snapshot,[update]);const links=[...f.links,{index,date,reference,project:'P',umId:'U',pjumId:'J',amount,evidenceUrl:`https://drive.google.com/file/d/receipt-${index}/view`}];return {...posted,update,links,records:reconcileUmReturns(f.records,posted.snapshot,links)};}
test('partial, exact advance recovery and excess UM return use one bank receipt',()=>{
 for(const amount of [20,50,80]){const f=receive(initial(),amount),cash=availableCash({generalSaving:f.snapshot.ygCash,salaryReserve:0},f.snapshot.projects),report=advanceBreakdown(f.snapshot);
  assert.equal(cash.generalAvailable,50+Math.min(50,amount));assert.equal(cash.projectAvailable,Math.max(0,amount-50));assert.equal(cash.totalCash,f.bank.closingBalance);assert.equal(report.totals.recovered,Math.min(50,amount));
  assert.equal(f.records[1].bankAmount,amount);assert.equal(f.records[1].balance-f.records[1].bankAmount,80-amount);assert.equal(f.bank.mutations.length,1);assert.deepEqual(f.snapshot.transfers,[]);
 }
});
test('installments and replay keep project, return register and PJUM amounts unique',()=>{
 const first=receive(initial(),20),f=receive(first,60);
 assert.equal(f.records[1].bankAmount,80);assert.equal(advanceBreakdown(f.snapshot).totals.recovered,50);
 assert.deepEqual(reconcileUmReturns(f.records,f.snapshot,f.links),f.records);
 assert.deepEqual(reconcileBankUpdates(f.bank,f.snapshot,[f.update]).snapshot,f.snapshot);
 const register=mergeUmReturnRegister([],f.links);assert.equal(register.reduce((n,r)=>n+r.amount,0),80);assert.deepEqual(mergeUmReturnRegister(register,f.links),register);
 const legacy=[{project:'P',amount:20,evidenceUrl:first.links[0].evidenceUrl,bankMatched:true}];assert.equal(mergeUmReturnRegister(legacy,f.links).length,2);
});
test('rejects wrong project, parent, bank identity, duplicate, over-return and missing installment',()=>{
 const f=receive(initial(),20);
 for(const change of [l=>l.project='Q',l=>l.umId='wrong',l=>l.reference='wrong',l=>l.amount=21,l=>l.evidenceUrl='http://example.org']){const links=structuredClone(f.links);change(links[0]);assert.throws(()=>reconcileUmReturns(initial().records,f.snapshot,links));}
 assert.throws(()=>reconcileUmReturns(f.records,f.snapshot,[...f.links,...f.links]));assert.throws(()=>receive(f,70));
 const done=receive(f,60);assert.throws(()=>reconcileUmReturns(done.records,done.snapshot,[done.links[1]]));
 const reports=structuredClone(initial().records);reports[1].project='Q';assert.throws(()=>reconcileUmReturns(reports,f.snapshot,f.links));
});
test('a shared receipt can settle two reports only within its one project allocation',()=>{
 const f=receive(initial(),80),records=initial().records;records[1].balance=30;records.push({...records[1],id:'J2',balance:50});
 const links=[{...f.links[0],amount:30},{...f.links[0],pjumId:'J2',amount:50}];
 const r=reconcileUmReturns(records,f.snapshot,links);assert.equal(r[1].bankAmount+r[2].bankAmount,80);
 links[1].amount=80;assert.throws(()=>reconcileUmReturns(records,f.snapshot,links));
});
test('unposted return and report approval stay separate from cash',()=>{const f=initial();f.records[1].status='Menunggu Persetujuan';const r=reconcileUmReturns(f.records,f.snapshot,[]);assert.equal(r[1].bankAmount,undefined);assert.equal(r[1].status,'Menunggu Persetujuan');const paid=receive(f,80);assert.equal(paid.records[1].status,'Menunggu Persetujuan');});

test('filtered project views retain the validated return without unrelated parent rows',()=>{const f=receive(initial(),20);assert.equal(projectUmReturnMetadata([f.records[1]],f.links)[0].bankAmount,20);assert.deepEqual(projectUmReturnMetadata([],f.links),[]);});
