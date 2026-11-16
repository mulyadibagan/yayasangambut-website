import {pjumChoices,pjumReadiness} from '../public/pjum-options.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {zipSync,strToU8} from 'fflate';
const hook=registerHooks({resolve(s,c,next){if(s==='sanitize-html')return {url:'data:text/javascript,export default ()=>""',shortCircuit:true};return next(s,c);}});
const {importPjumExcel}=await import('../src/pjum-excel.mjs');
const {receiptChecks,receiptImage,receiptNumberCrop,scanReceipt}=await import('../src/pjum-evidence.mjs');
const {PDFDocument}=await import('pdf-lib');
hook.deregister();
function workbook(extra=''){
 const c=(r,v)=>`<c r="${r}"><v>${v}</v></c>`,s=(r,v)=>`<c r="${r}" t="inlineStr"><is><t>${v}</t></is></c>`;
 return zipSync(Object.fromEntries(Object.entries({'xl/workbook.xml':'<workbook><sheets><sheet name="PJUM" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':'<worksheet><sheetData>'+c('A14','4.1')+c('A15',46293)+s('B15','Honor tim patroli a.n. Seplia Pikar Desa Sepahat')+c('C15',1500000)+c('D15',1)+s('E15','orang')+c('F15',1)+c('J15',1500000)+s('K15','01')+extra+'</sheetData></worksheet>'}).map(([p,v])=>[p,strToU8(v)])));
}
test('YG importer keeps receipt numbering and recomputes totals without evaluating formulas',()=>{
 const p=importPjumExcel(workbook());assert.equal(p.total,1500000);assert.equal(p.items[0].receipt_no,'01');assert.equal(p.items[0].date,'2026-09-28');assert.equal(p.items[0].recipient,'Seplia Pikar');assert.equal(p.items[0].activity_code,'4.1');
 assert.throws(()=>importPjumExcel(new Uint8Array([1,2,3])));
});
const item={receipt_no:'01',recipient:'Seplia Pikar',date:'2026-09-28',subtotal:1500000,description:'Honor tim patroli Seplia Pikar Desa Sepahat',file_id:'proof',page:1};
const file={id:'proof',purpose:'pjum',mime:'application/pdf'};
const scan={file_id:'proof',page:1,result:{receipt_no:'01',recipient:'Seplia Pikar',date:'2026-09-28',amount:1500000,description:'Honor tim patroli Seplia Pikar Desa Sepahat'}};
test('missing, duplicate, future or wrong-ownership evidence never passes completeness',()=>{
 assert.equal(receiptChecks({items:[item]},[file],[scan]).matched,1);
 assert.equal(receiptChecks({items:[item,item]},[file],[scan]).complete,false);
 assert.equal(receiptChecks({items:[{...item,file_id:'another-request'}]},[file],[scan]).complete,false);
 assert.equal(receiptChecks({items:[{...item,date:'2099-01-01'}]},[file],[scan]).complete,false);
 assert.equal(receiptChecks({items:[item]},[file],[{...scan,result:{...scan.result,amount:1}}]).matched,0);
 assert.match(receiptChecks({items:[item]},[file],[scan],'2026-10-05').rows[0].warnings.join(),/mendahului/);
 assert.equal(receiptChecks({items:[item]},[file],[]).rows[0].read,false);
});
test('unsupported PDFs remain explicitly manual and invalid pages are rejected',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();assert.ok((await receiptImage(bytes,'application/pdf',1)).error);await assert.rejects(()=>receiptImage(bytes,'application/pdf',2));
});
test('OCR never uses expected receipt values and malformed model output stays unverified',async()=>{
 const jpeg=new Uint8Array([255,216,255]);const env={AI:{async run(model,input){assert.ok(input.messages[0].content[0].text.includes('Never infer'));return {choices:[{message:{content:'{"receipt_no":"01","recipient":"Seplia Pikar","date":"2026-09-28","amount":1500000,"description":"Honor"}'}}]};}}};
 assert.equal((await scanReceipt(env,jpeg,'image/jpeg',1)).amount,1500000);
 env.AI.run=async()=>({response:'not JSON'});assert.ok((await scanReceipt(env,jpeg,'image/jpeg',1)).error);
});

test('Excel file selection reaches the import API while genuinely edited report fields block it',async()=>{
 const {readFile}=await import('node:fs/promises'),{parseHTML}=await import('linkedom'),{createContext,runInContext}=await import('node:vm'),{advancesPage}=await import('../src/advances-page.mjs');
 const {document,Event}=parseHTML(advancesPage());let imports=0;
 const context=createContext({document,pjumChoices,pjumReadiness,window:{addEventListener(){}},location:{search:''},URLSearchParams,confirm:()=>true,fetch:async url=>{if(url.includes('import_excel')){imports++;throw Error('Import request reached');}return {ok:true,json:async()=>url.endsWith('/me')?{id:'mul',name:'Mulyadi',director:true}:[]};}});
 runInContext((await readFile(new URL('../public/advances.js',import.meta.url),'utf8')).replace("import {pjumChoices,pjumReadiness} from '/pjum-options.js';",''),context);await new Promise(setImmediate);
 runInContext("current={id:'request',creator:'mul',version:1,status:'disbursed',total:1,payload:{},files:[]};",context);
 runInContext("addItem('#pjum-items',{date:'2026-11-15',description:'Honor',receipt_no:'1',recipient:'Penerima',page:1,quantity:1,times:1,days:1,rate:1500000,unit:'orang'},true);",context);for(const input of document.querySelectorAll('#pjum-items input[type=number]')){const value=Number(input.value),min=Number(input.min),step=Number(input.step);assert.ok(value>=min,input.dataset.key+' minimum');assert.ok(Math.abs((value-min)/step-Math.round((value-min)/step))<0.00001,input.dataset.key+' accepts whole-number input');}runInContext('dirty=false',context);
 const picker=document.querySelector('#import-pjum');Object.defineProperty(picker,'files',{value:[{name:'test.xlsx',size:100}]});picker.dispatchEvent(new Event('input',{bubbles:true}));picker.onchange();await new Promise(setImmediate);assert.equal(imports,1);
 document.querySelector('#pjum-form textarea').dispatchEvent(new Event('input',{bubbles:true}));picker.onchange();await new Promise(setImmediate);assert.equal(imports,1);assert.match(document.querySelector('#notice').textContent,/Simpan perubahan/);
 runInContext("dirty=false;current={id:'sent',creator:'mul',creator_name:'Mulyadi',number:'10/ARC3',status:'pjum_submitted',total:100,actual:100,payload:{activity:'Monitoring'},report:{items:[{receipt_no:'1',date:'2026-11-01',recipient:'Tim',description:'Honor',subtotal:100,file_id:'pdf',page:1}],report_date:'2026-11-16',total:100,notes:''},checks:{complete:true,rows:[{index:0,receipt_no:'1',issues:[],warnings:[],read:true,result:{}}]},files:[{id:'pdf',purpose:'pjum',mime:'application/pdf',filename:'kuitansi.pdf'}]};rows=[current,{...current,id:'sent2',number:'11/ARC3',status:'pjum_draft'}];renderSubmittedPjum();renderPairSummary();",context);
 assert.equal(document.querySelectorAll('#submitted-pjum-list button').length,2);assert.equal(document.querySelector('#send-pjum'),null);assert.ok(document.querySelector('.pjum-report-preview').open);assert.match(document.querySelector('.pjum-saved-files a').href,/preview=1/);
});

test('number retry reads a cropped top-right margin and preserves previously read receipt fields',async()=>{
 const {default:jpeg}=await import('jpeg-js');const data=new Uint8Array(100*100*4).fill(255);const bytes=jpeg.encode({data,width:100,height:100},90).data;let calls=0;const previous={receipt_no:null,recipient:'Seplia Pikar',date:'2026-09-28',amount:1500000,description:'Honor'};
 const env={AI:{async run(model,input){calls++;const content=input.messages[0].content;assert.match(content[0].text,/Never infer/);const image=jpeg.decode(Buffer.from(content[1].image_url.url.split(',')[1],'base64'));assert.equal(image.width,50);assert.equal(image.height,20);return {response:'{\"receipt_no\":\"1\"}'};}}};
 const result=await scanReceipt(env,bytes,'image/jpeg',1,previous);assert.equal(calls,1);assert.equal(result.receipt_no,'1');assert.equal(result.amount,previous.amount);assert.equal(result.recipient,previous.recipient);
 env.AI.run=async()=>({response:'{\"receipt_no\":null}'});const unread=await scanReceipt(env,bytes,'image/jpeg',1,previous);assert.equal(unread.receipt_no,null);assert.equal(unread.amount,previous.amount);
});

test('header JPEG encoding works when the worker has no global Buffer',async()=>{const {default:jpeg}=await import('jpeg-js');const bytes=jpeg.encode({data:new Uint8Array(40000).fill(255),width:100,height:100},90).data;const saved=globalThis.Buffer;try{delete globalThis.Buffer;const cropped=receiptNumberCrop(bytes);assert.ok(cropped.length>0);}finally{globalThis.Buffer=saved;}});
