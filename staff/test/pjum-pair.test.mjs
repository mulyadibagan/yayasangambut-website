import test from 'node:test';
import assert from 'node:assert/strict';
import {processPjumPair} from '../public/pjum-pair.js';
const excel={name:'PJUM.xlsx',size:100},receipts={name:'Kuitansi.pdf',size:200};
function fixture(){
 const calls=[],items=Array.from({length:4},(_,i)=>({receipt_no:String(i+1),recipient:'Penerima',date:'2026-11-15',subtotal:100,description:'Honor',quantity:1,days:1,times:1,rate:100,unit:'orang'}));
 const initial={id:'existing',number:'10/YG_ARC3/10/2026',version:1,total:400,status:'pjum_draft',files:[],report:{report_date:'2026-11-16',notes:'Catatan tetap'}};
 let latest=structuredClone(initial);
 return {calls,items,initial,get latest(){return latest;},options:{excel,receipts,
  preview:async()=>{calls.push('preview');return {items,total:400,report_number:'PJ-10',um_number:initial.number,report_date:'2026-11-20'};},
  resolve:async n=>{calls.push(['resolve',n]);return latest;},
  upload:async(r,f)=>{calls.push(['upload',f.name]);latest={...r,version:r.version+1,files:[...r.files,{id:f.name,filename:f.name,size:f.size,purpose:'pjum',mime:f===receipts?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pages:f===receipts?4:null}]};return latest;},
  save:async(r,report)=>{calls.push('save');latest={...r,version:r.version+1,report,actual:report.items.reduce((n,i)=>n+i.subtotal,0)};return latest;},
  scan:async(r,pages)=>{calls.push(['scan',pages]);latest={...r,version:r.version+1};return latest;}}};
}
test('two files alone resolve the UM, map all pages, save and scan without a manual form or submitting',async()=>{
 const f=fixture(),r=await processPjumPair(f.options);assert.equal(r.id,'existing');assert.equal(r.report.items.length,4);assert.equal(r.report.report_date,'2026-11-16');assert.equal(r.report.notes,'Catatan tetap');assert.equal(r.actual,400);assert.equal(r.status,'pjum_draft');assert.deepEqual(r.report.items.map(i=>[i.receipt_no,i.file_id,i.page]),[['1','Kuitansi.pdf',1],['2','Kuitansi.pdf',2],['3','Kuitansi.pdf',3],['4','Kuitansi.pdf',4]]);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0]==='scan').length,2);assert.equal(f.calls.indexOf('save')<f.calls.findIndex(c=>Array.isArray(c)&&c[0]==='scan'),true);
});
test('missing files and wrong types fail before any server mutation',async()=>{
 const f=fixture();await assert.rejects(()=>processPjumPair({...f.options,receipts:null}));await assert.rejects(()=>processPjumPair({...f.options,excel:{...excel,name:'source.xlsm'}}));assert.equal(f.calls.length,0);
});
test('ambiguous UM and mismatched PDF page counts never save a misleading report',async()=>{
 const f=fixture();await assert.rejects(()=>processPjumPair({...f.options,resolve:async()=>({...f.initial,number:'different'})}));assert.equal(f.calls.includes('save'),false);
 const g=fixture(),upload=g.options.upload;await assert.rejects(()=>processPjumPair({...g.options,upload:async(r,file)=>{const out=await upload(r,file);return {...out,files:out.files.map(f=>({...f,pages:f.mime==='application/pdf'?3:null}))};}}),/Jumlah halaman/);assert.equal(g.calls.includes('save'),false);
});
test('an OCR interruption preserves the saved draft and never submits it',async()=>{
 const f=fixture();await assert.rejects(()=>processPjumPair({...f.options,scan:async()=>{throw Error('Temporary failure');}}));assert.equal(f.latest.report.items.length,4);assert.equal(f.latest.status,'pjum_draft');
});
