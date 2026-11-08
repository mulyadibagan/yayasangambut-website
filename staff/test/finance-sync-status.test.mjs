import test from 'node:test';
import assert from 'node:assert/strict';
import {financeSyncStatus} from '../src/finance-sync-status.mjs';
test('successful zero-result job does not claim archive completeness or invent coverage',()=>{
 const view=financeSyncStatus({status:'success',scannedCount:0,lastSuccess:'2026-10-19T02:26:22Z'},Date.parse('2026-11-08T00:00:00Z'));
 assert.equal(view.stale,true);assert.match(view.warning,/0 pesan/);assert.match(view.coverage,/belum dilaporkan/);assert.equal(view.scanConfirmed,false);
 assert.equal(view.metric(0),'0');for(const v of [undefined,null,'',-1,1.5,Infinity,'bad'])assert.equal(view.metric(v),'Belum dilaporkan');
});
test('fresh confirmed scan reports execution separately from unknown coverage',()=>{
 const now=Date.parse('2026-11-08T00:00:00Z'),v=financeSyncStatus({status:'success',scanned:true,scannedCount:4,lastSuccess:new Date(now).toISOString()},now);
 assert.equal(v.stale,false);assert.equal(v.scanConfirmed,true);assert.equal(v.warning,'');assert.equal(v.metric(4),'4');assert.match(v.coverage,/belum dilaporkan/);
 assert.equal(financeSyncStatus({lastSuccess:'invalid'},now).stale,false);
});
