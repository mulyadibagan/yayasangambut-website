import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAgendasUnchanged} from '../scripts/agenda-integrity.mjs';
test('migration checkpoint stops deployment if any existing agenda content or count changes',()=>{
 const before={count:5,digest:'original'};
 assert.doesNotThrow(()=>verifyAgendasUnchanged(before,{...before}));
 assert.throws(()=>verifyAgendasUnchanged(before,{count:4,digest:'original'}));
 assert.throws(()=>verifyAgendasUnchanged(before,{count:5,digest:'modified'}));
});
