import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {signatureRoute,documentSignature,signatureDataUrl} from '../src/document-signature.mjs';
import {invoicePdf} from '../src/invoice-pdf.mjs';
import {invoicePrint} from '../src/invoice-print.mjs';
import {invoiceSeed} from '../src/invoice-model.mjs';
import {payrollPdf,savePayrollPdf,pdfHash} from '../src/payroll-pdf.mjs';
import {payrollPrint} from '../src/payroll-print.mjs';
const png=new Uint8Array(readFileSync(new URL('../public/brand/yayasan-gambut-logo.png',import.meta.url))),origin='https://staff.yayasangambut.org';
const director={email:'mulyadi@yayasangambut.org',role:'admin'},finance={email:'rienaprasiddha@yayasangambut.org',role:'staff'};
function setup(){const objects=new Map(),env={APP_ORIGIN:origin,MEDIA:{async get(k){const o=objects.get(k);return o?{...o,async arrayBuffer(){return o.bytes.buffer;}}:null;},async put(k,b,o={}){if(o.onlyIf?.get('If-None-Match')==='*'&&objects.has(k))return null;const obj={bytes:new Uint8Array(b),customMetadata:o.customMetadata};objects.set(k,obj);return obj;}}};return {env,objects};}
const req=(method='GET',data,headers={})=>new Request(origin+'/finance/signature/api',{method,headers:{Origin:origin,'X-Confirm-Signature':'invoice-payroll-after-approval',...headers},...(data?{body:data}:{})});
const limited=async(r,n)=>{const b=new Uint8Array(await r.arrayBuffer());if(b.length>n)throw {status:413};return b;};
const activate=e=>signatureRoute(req('POST',png),e,director,limited);
const invoice={id:'local',number:'10/YG-RAPP/26',status:'issued',issued_by:director.email,issued_at:'2099-01-01T00:00:00Z',data:invoiceSeed,amount:199200000,total:199200000};
const payroll={id:'local',period:'2026-10',status:'approved',reviewer_email:director.email,reviewed_at:'2099-01-01T00:00:00Z',created_at:'2026-10-20',creator_email:finance.email,version:3,items:[{name:'Penerima uji',net:1000000}],total:1000000};
async function images(b){const d=await PDFDocument.load(b);return d.getPages().reduce((n,p)=>n+(p.node.Resources()?.lookup(PDFName.of('XObject'),PDFDict)?.keys().length||0),0);}
test('private signature activation is director-only, origin protected, validated and cannot be replaced',async()=>{
 const {env,objects}=setup();await assert.rejects(()=>signatureRoute(req('POST',png),env,finance,limited),e=>e.status===403);
 await assert.rejects(()=>signatureRoute(req('POST',png,{Origin:'https://evil.example'}),env,director,limited),e=>e.status===403);
 await assert.rejects(()=>signatureRoute(req('POST',png,{'X-Confirm-Signature':''}),env,director,limited),e=>e.status===400);
 await assert.rejects(()=>signatureRoute(req('POST',new Uint8Array([1,2,3])),env,director,limited),e=>e.status===400);
 assert.equal(objects.size,0);assert.equal((await activate(env)).status,201);assert.equal(objects.size,1);
 const status=await(await signatureRoute(req(),env,director,limited)).json();assert.equal(status.active,true);assert.equal(status.activated_by,director.email);assert.equal(status.sha256,await pdfHash(png));assert.ok(!JSON.stringify(status).includes('base64'));
 await assert.rejects(()=>activate(env),e=>e.status===409);assert.deepEqual(await documentSignature(env,invoice),png);
});
test('draft, returned, cancelled, preview, other approvers and historic approvals never receive the signature',async()=>{
 const {env}=setup();await activate(env);
 for(const r of [{...invoice,status:'draft'},{...invoice,status:'cancelled'},{...invoice,issued_by:finance.email},{...payroll,status:'submitted'},{...payroll,status:'returned'},{...payroll,cancelled_at:'2099-02-01'},{...payroll,preview:true},{...payroll,reviewer_email:finance.email},{...payroll,reviewed_at:'2020-01-01'}])assert.equal(await documentSignature(env,r),null);
 assert.deepEqual(await documentSignature(env,payroll),png);
 assert.ok(!invoicePrint({...invoice,status:'draft'},signatureDataUrl(png)).includes('alt="Tanda tangan'));
 assert.ok(!payrollPrint({...payroll,status:'submitted'},signatureDataUrl(png)).includes('alt="Tanda tangan'));
 assert.ok(invoicePrint(invoice,signatureDataUrl(png)).includes('alt="Tanda tangan Mulyadi"'));
 assert.ok(payrollPrint(payroll,signatureDataUrl(png)).includes('alt="Tanda tangan Mulyadi"'));
});
test('PDF signature is approval gated and stored approval PDF keeps its exact signed bytes',async()=>{
 assert.equal(await images(await invoicePdf({...invoice,status:'draft'},null,png)),0);assert.equal(await images(await payrollPdf({...payroll,status:'draft'},null,png)),0);
 assert.ok(await images(await invoicePdf(invoice,null,png))>0);assert.ok(await images(await payrollPdf(payroll,null,png))>0);
 const {env,objects}=setup();await activate(env);const saved=await savePayrollPdf(env,payroll,'test-event','2099-01-01');const bytes=objects.get(saved.object_key).bytes;assert.equal(await pdfHash(bytes),saved.sha256);assert.ok(await images(bytes)>0);
 const sig=[...objects.values()][0];sig.bytes[0]^=1;await assert.rejects(()=>documentSignature(env,invoice),e=>e.status===503);assert.equal(await pdfHash(bytes),saved.sha256);
});
