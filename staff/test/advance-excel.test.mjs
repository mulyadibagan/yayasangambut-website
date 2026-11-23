import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {advanceExcel} from '../src/advance-excel.mjs';
const template=readFileSync(new URL('../public/um-template-yg.xlsx',import.meta.url));
test('Excel keeps YG header, grouped activity subtotals, PRODUCT formulas, and exact cached totals',()=>{
 const input={number:'UM-2026-00001',creator_name:'Pengaju',creator_email:'pengaju@yayasangambut.org',status:'draft',version:1,created_at:'2026-11-15',total:1500000,payload:{project:'SPM-CLS',activity:'Dua kegiatan',location:'Riau',start:'2026-11-15',end:'2026-11-16',account:'001234567',allocations:[{code:'A',name:'Tanam'},{code:'B',name:'Video'}],items:[{activity_code:'A',description:'=2+2',rate:250000,quantity:2,times:1,days:2,subtotal:1000000,unit:'orang'},{activity_code:'B',description:'Produksi',rate:500000,quantity:1,times:1,days:1,subtotal:500000,unit:'paket'}]}};
 const output=unzipSync(advanceExcel(template,input)),sheet=strFromU8(output['xl/worksheets/sheet1.xml']);assert.match(sheet,/ROUND\(PRODUCT\(C14:I14\),0\)/);assert.match(sheet,/<v>1500000<\/v>/);assert.match(sheet,/<t[^>]*>=2\+2<\/t>/);assert.match(sheet,/001234567/);assert.ok(output['xl/media/image1.png']);assert.ok(!output['xl/media/image2.png']);assert.ok(!output['xl/sharedStrings.xml']);assert.equal((sheet.match(/Subtotal kegiatan/g)||[]).length,2);
 assert.throws(()=>advanceExcel(template,{...input,total:1}),/Total UM/);
});

test('submitted director image occupies signature space, preserves letterhead, and stays out of drafts',()=>{
 const input={number:'UM-6',creator_name:'Mulyadi',creator_email:'mulyadi@yayasangambut.org',status:'submitted',version:2,created_at:'2026-11-23',total:100,events:[{action:'submit',actor_email:'mulyadi@yayasangambut.org',version:2,created_at:'2026-11-23T10:00:00Z'}],payload:{project:'APRIL',activity:'Coaching',location:'Dayun',start:'2026-11-25',end:'2026-11-27',items:[{activity_code:'1.2',description:'Biaya',rate:100,quantity:1,times:1,days:1,subtotal:100,unit:'unit'}]}};
 const png=unzipSync(template)['xl/media/image1.png'];
 const out=unzipSync(advanceExcel(template,input,{applicant:png}));
 assert.deepEqual(out['xl/media/um-signature-0.png'],png);
 assert.deepEqual(out['xl/media/image1.png'],png);
 const drawing=strFromU8(out['xl/drawings/drawing1.xml']);
 assert.match(drawing,/rIdUmSignature0/);assert.match(drawing,/r:embed="rId1"/);
 assert.match(strFromU8(out['xl/drawings/_rels/drawing1.xml.rels']),/um-signature-0.png/);
 assert.doesNotMatch(strFromU8(out['xl/worksheets/sheet1.xml']),/Ditandatangani secara elektronik oleh/);
 for(const status of ['draft','returned','cancelled'])assert.ok(!unzipSync(advanceExcel(template,{...input,status},{applicant:png}))['xl/media/um-signature-0.png']);
});
