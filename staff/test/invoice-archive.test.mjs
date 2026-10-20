import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {saveInvoiceArchive,readInvoiceArchive,invoiceArchiveOptions,invoicePrintChoices} from '../src/invoice-archive.mjs';
import {invoiceSeed} from '../src/invoice-model.mjs';
import {pdfHash} from '../src/payroll-pdf.mjs';
const row={id:'local',number:'10/YG-RAPP/26',status:'issued',issued_by:'mulyadi@yayasangambut.org',issued_at:'2099-01-01T00:00:00Z',data:invoiceSeed,amount:199200000,total:199200000};
async function setup(){const objects=new Map(),png=new Uint8Array(readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url)));objects.set('document-private/director-signature-v1.png',{bytes:png,customMetadata:{activated_at:'2020-01-01',activated_by:row.issued_by,sha256:await pdfHash(png)}});return {objects,env:{MEDIA:{async get(k){const o=objects.get(k);return o?{...o,async arrayBuffer(){return o.bytes.buffer;}}:null;},async put(k,v,o={}){if(objects.has(k))return null;const x={bytes:new Uint8Array(v),customMetadata:o.customMetadata};objects.set(k,x);return x;}}}};}
async function images(b){const d=await PDFDocument.load(b);return d.getPages().reduce((n,p)=>n+(p.node.Resources()?.lookup(PDFName.of('XObject'),PDFDict)?.keys().length||0),0);}
test('approved invoice has immutable signed and unsigned PDF variants with independent hashes',async()=>{
 const {env,objects}=await setup(),key='invoice-private/final/local/event.pdf';const saved=await saveInvoiceArchive(env,row,key),r={...row,pdf_key:key,pdf_hash:saved.hash};
 const options=await invoiceArchiveOptions(env,r);assert.deepEqual(options,{withSignature:true,withoutSignature:true});const page=invoicePrintChoices(r,options);assert.ok(page.includes('?signature=with'));assert.ok(page.includes('?signature=without'));const original=await readInvoiceArchive(env,r),signed=await readInvoiceArchive(env,r,'with'),unsigned=await readInvoiceArchive(env,r,'without');assert.deepEqual(signed,original);assert.ok(await images(signed)>0);assert.equal(await images(unsigned),0);assert.notEqual(await pdfHash(unsigned),r.pdf_hash);assert.equal(await pdfHash(await readInvoiceArchive(env,r)),r.pdf_hash);
 await assert.rejects(()=>saveInvoiceArchive(env,row,key),e=>e.status===409);await assert.rejects(()=>saveInvoiceArchive(env,{...row,status:'draft'},'other'),e=>e.status===409);
 objects.get(key+'.without-signature.pdf').bytes[10]^=1;await assert.rejects(()=>readInvoiceArchive(env,r,'without'),e=>e.status===503);assert.equal(await pdfHash(await readInvoiceArchive(env,r)),r.pdf_hash);
});
test('legacy archives remain readable without regeneration and do not invent missing signature variants',async()=>{
 const {env,objects}=await setup();const key='legacy.pdf',bytes=new Uint8Array([37,80,68,70]);objects.set(key,{bytes});const r={...row,pdf_key:key,pdf_hash:await pdfHash(bytes)};assert.deepEqual(await invoiceArchiveOptions(env,r),{withSignature:false,withoutSignature:false});assert.deepEqual(await readInvoiceArchive(env,r),bytes);await assert.rejects(()=>readInvoiceArchive(env,r,'without'),e=>e.status===409);await assert.rejects(()=>readInvoiceArchive(env,r,'with'),e=>e.status===409);assert.deepEqual(objects.get(key).bytes,bytes);
});
test('Director may select an unsigned original while preserving a signed print variant',async()=>{
 const {env}=await setup(),key='selected-without.pdf',r={...row,data:{...row.data,signature_mode:'without'}};const {hash}=await saveInvoiceArchive(env,r,key);r.pdf_key=key;r.pdf_hash=hash;assert.equal(await images(await readInvoiceArchive(env,r)),0);assert.ok(await images(await readInvoiceArchive(env,r,'with'))>0);assert.equal(await pdfHash(await readInvoiceArchive(env,r,'without')),hash);
});
