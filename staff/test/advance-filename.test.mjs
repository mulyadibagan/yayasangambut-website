import test from 'node:test';import assert from 'node:assert/strict';import {advanceFilename} from '../src/advance-filename.mjs';
test('APRIL download names use project order while other projects retain their numbers',()=>{
 const request={number:'UM-2026-00006',payload:{project_id:'APRIL',activity:'Targeted Coaching 1: Penguatan Kelembagaan KUPS',items:[{activity_code:'1.2'}]}};
 assert.equal(advanceFilename(request,2),'02_UM_YG-APRDYN_1.2-Targeted-Coaching-1-Penguatan-Kelembagaan-KUPS.xlsx');
 assert.equal(advanceFilename({...request,payload:{project_id:'YG'}}),'UM-2026-00006.xlsx');
 assert.equal(advanceFilename({...request,payload:{...request.payload,activity:'1.2 · Targeted Coaching'}},2),'02_UM_YG-APRDYN_1.2-Targeted-Coaching.xlsx');
 assert.throws(()=>advanceFilename(request,0));
});
