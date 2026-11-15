import test from 'node:test';
import assert from 'node:assert/strict';
import {syncArchive,archiveAllocations} from '../src/advance-sync.mjs';
const source={id:'SPMCLS',name:'SPM-CLS',activities:[{code:'1.1.3',name:'Agroforestry',budget:800,legacyCommitted:0},{code:'2.1.1',name:'Video',budget:200,legacyCommitted:0}]};
const email={id:'sent',type:'UM',project:'SPM-CLS Riau',title:'Pengajuan kegiatan',status:'Menunggu Persetujuan',amount:1000,documentName:'05_2026.11.14_UMSPMCLS_Agroforestry_Video.xlsx'};
test('multi-activity email and finance reply reserve the same two ceilings once',()=>{
 const result=syncArchive(source,[email,{...email,id:'reply',title:'Re: Pengajuan kegiatan'}]);
 assert.deepEqual(result.activities.map(a=>a.archivePending),[800,200]);assert.equal(result.archive.length,1);
});
test('partial or unrecognized multi-activity amounts remain unresolved, never split by guess',()=>{
 assert.deepEqual(archiveAllocations(source,{...email,amount:900}),[]);
 const r=syncArchive(source,[{...email,amount:900}]);assert.equal(r.unallocated,1);assert.equal(r.activities[0].archivePending,0);
});
test('paid records are already in dossier commitments and draft reports do not settle them',()=>{
 const paid={...email,code:'1.1.3',amount:800,status:'Dicairkan'};
 const result=syncArchive(source,[paid,{id:'report',type:'PJUM',parentUmId:paid.id,status:'Draf',amount:800}]);
 assert.equal(result.activities[0].archivePending,0);assert.equal(result.activities[0].archiveOutstanding,800);
 const reported=syncArchive(source,[paid,{id:'report',type:'PJUM',parentUmId:paid.id,status:'Dilaporkan ke Riena',actualAmount:790,balance:10,bankAmount:10,bankStatus:'Cocok'}]);
 assert.equal(reported.activities[0].archiveOutstanding,0);
});
test('unrelated projects, rejected emails and payroll cannot consume activity ceilings',()=>{
 const result=syncArchive(source,[{...email,project:'ARC3'},{...email,status:'Ditolak'},{...email,type:'GAJI'}]);assert.equal(result.archive.length,0);
});
test('private live budgets also reserve email disbursements without a static dossier baseline',()=>{
 const result=syncArchive({...source,liveBudget:true},[{...email,code:'1.1.3',amount:800,status:'Dicairkan'}]);
 assert.equal(result.activities[0].legacyCommitted,800);assert.equal(result.activities[0].archivePending,0);assert.equal(result.activities[0].archiveOutstanding,800);
});
