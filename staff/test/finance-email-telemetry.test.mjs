import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {patchAppsScriptScan} from '../scripts/finance-email-telemetry.mjs';
import {emailScanTelemetry} from '../src/finance-email-telemetry.mjs';
test('Apps Script reports inspected messages separately from recognized documents, without altering records',()=>{
 const source=`function scan(){const messages=[1,2,3],threads=[1,2],latest={same:{sourceEmailId:'one'}};return {
    records: Object.keys(latest).map(function (key) { return latest[key]; }),
 };}`;
 const patched=patchAppsScriptScan(source);assert.equal(patchAppsScriptScan(patched),patched);
 const result=vm.runInNewContext(patched+';scan()',{YGFMS_CONFIG:{MAX_SCAN_THREADS:2}});
 assert.equal(result.scannedCount,3);assert.equal(result.scannedThreads,2);assert.equal(result.limited,true);assert.equal(result.records.length,1);assert.equal(result.records[0].sourceEmailId,'one');
 assert.throws(()=>patchAppsScriptScan('unknown source'),/source drift/);
});
test('runtime telemetry never substitutes matched-document counts for unknown inspected-message counts',()=>{
 let data=emailScanTelemetry({scanned:7,matchedRecords:0,scannedThreads:4,queryAfter:'2026/10/12'});
 assert.equal(data.scannedCount,7);assert.equal(data.matchedRecords,0);assert.equal(data.queryAfter,'2026/10/12');
 data=emailScanTelemetry({matchedRecords:3,queryAfter:'<script>'});assert.equal(data.scannedCount,undefined);assert.equal(data.matchedRecords,3);assert.equal(data.queryAfter,undefined);
 for(const scanned of [null,-1,2.5,'7',NaN])assert.equal(emailScanTelemetry({scanned}).scannedCount,undefined);
});
