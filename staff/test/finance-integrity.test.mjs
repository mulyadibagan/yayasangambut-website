import test from 'node:test';
import assert from 'node:assert/strict';
import {financeCheckpoint,verifyFinanceUnchanged} from '../scripts/finance-integrity.mjs';

test('finance checkpoint detects changed values even when table and row counts remain identical',async()=>{
 const original=globalThis.fetch;let amount=100;
 globalThis.fetch=async(_url,init)=>{const {sql}=JSON.parse(init.body);assert(!/INSERT|UPDATE|DELETE|ALTER|DROP/i.test(sql));return Response.json({success:true,result:[{success:true,results:sql.includes('sqlite_master')?[{name:'finance_transactions'}]:[{id:'existing',amount}]}]});};
 try{const config={base:'https://test',database:'test',token:'test'},before=await financeCheckpoint(config);verifyFinanceUnchanged(before,await financeCheckpoint(config));assert.throws(()=>verifyFinanceUnchanged(before,[]),/changed/);amount=101;
  const after=await financeCheckpoint(config);assert.equal(before[0].count,after[0].count);assert.throws(()=>verifyFinanceUnchanged(before,after),/changed/);
 }finally{globalThis.fetch=original;}
});
