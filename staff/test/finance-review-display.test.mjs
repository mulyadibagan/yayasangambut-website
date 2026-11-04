import test from 'node:test';
import assert from 'node:assert/strict';
import {reportSummary,timelineMonth,receiptStatement} from '../scripts/finance-review-policy.mjs';

test('an advance without a report cannot be labelled fully verified',()=>{
 assert.equal(reportSummary([{advance:94750000,status:'Belum dilaporkan ke Riena'}],0),'1 aktivitas belum selesai dilaporkan');
 assert.equal(reportSummary([{advance:100000000,status:'Belum dilaporkan ke Riena'}],0),'1 aktivitas belum selesai dilaporkan');
 assert.equal(reportSummary([{advance:100,status:'Laporan sebagian'}],0),'1 aktivitas belum selesai dilaporkan');
 assert.equal(reportSummary([{advance:100,status:'Sudah dilaporkan'}],0),'Semua laporan terverifikasi');
 assert.equal(reportSummary([],0),'Belum ada aktivitas untuk diverifikasi');
 assert.equal(reportSummary([],2),'2 PJUM belum terverifikasi');
});
test('receipt evidence uses the row statement rather than arbitrary project attachments',()=>{
 const row={credit:100,balance:200,evidence:[{label:'Agreement',url:'https://docs.google.com/document/d/contract/edit'}],statementUrl:'https://drive.google.com/file/d/monthly-statement/view'};
 const before=structuredClone(row);
 assert.equal(receiptStatement(row),row.statementUrl);assert.deepEqual(row,before);
 assert.equal(receiptStatement({evidence:row.evidence}),undefined);
 assert.equal(receiptStatement({statementUrl:'javascript:alert(1)'}),undefined);
});
test('workplan month follows reporting cutoff, including year rollover',()=>{
 assert.equal(timelineMonth('2026-09-30'),4);
 assert.equal(timelineMonth('2026-10-31'),5);
 assert.equal(timelineMonth('2027-02-28'),9);
});
