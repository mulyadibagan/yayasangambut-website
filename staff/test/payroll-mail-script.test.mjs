import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../integrations/PayrollNotifications.gs',import.meta.url),'utf8');
const pdfBytes=Buffer.from('%PDF-1.7\nsynthetic attachment');
const payload=()=>({approvalPdfBase64:pdfBytes.toString('base64'),approvalPdfSha256:createHash('sha256').update(pdfBytes).digest('hex'),approvalPdfFilename:'Form-Gaji-2026-10-12345678.pdf',notificationKey:'payroll:11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',period:'2026-10',number:'GJ-TEST',total:5400000,approvedAt:'2026-10-19T05:00:00Z',approvedBy:'mulyadi@yayasangambut.org',recipients:['hisamsetiawan@yayasangambut.org','serena@gec.org.my','rienaprasiddha@yayasangambut.org']});
function setup(visible=true,uppercaseHash=false){
 const stored=new Map(),messages=[];let count=0;
 const context=vm.createContext({MimeType:{PDF:'application/pdf'},Utilities:{base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:(s,mime,name)=>({getBytes:()=>Buffer.from(s),getName:()=>name}),formatDate:()=> '19/10/2026 12:00:00',sleep(){}},sha256Hex_:b=>{const hash=createHash('sha256').update(Buffer.from(b)).digest('hex');return uppercaseHash?hash.toUpperCase():hash;},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>stored.get(k),setProperty:(k,v)=>stored.set(k,v)})},GmailApp:{search:()=>visible&&messages.length?[{getMessages:()=>messages}]:[],sendEmail(to,subject,body,options){count++;messages.push({getPlainBody:()=>body,getTo:()=>to,getCc:()=>'',getId:()=> 'gmail-test-id',getAttachments:()=>options.attachments||[]});}}});
 vm.runInContext(source,context);return {send:p=>context.sendPayrollApproval_(p),count:()=>count,show:()=>visible=true,messages};
}
test('payroll Apps Script sends only to approved recipients and deduplicates the same notification',()=>{
 const app=setup(),p=payload();assert.equal(app.send(p).sent,true);assert.equal(app.send(p).sent,true);assert.equal(app.count(),1);
 assert.equal(app.messages[0].getTo(),p.recipients.join(','));assert.doesNotMatch(app.messages[0].getPlainBody(),/001234/);
 assert.throws(()=>app.send({...p,total:1}),/terikat/);
 assert.throws(()=>app.send({...p,recipients:['attacker@example.org']}),/tidak valid/);
});
test('uncertain Gmail response never sends twice and later recovers the sent message',()=>{
 const app=setup(false),p=payload();assert.equal(app.send(p).code,'uncertain');assert.equal(app.send(p).code,'uncertain');assert.equal(app.count(),1);
 app.show();assert.equal(app.send(p).messageId,'gmail-test-id');assert.equal(app.count(),1);
});

test('PDF attachment is mandatory and hash-verified before sending',()=>{
 const app=setup(),p=payload();
 assert.throws(()=>app.send({...p,approvalPdfBase64:''}),/Integritas/);
 assert.throws(()=>app.send({...p,approvalPdfSha256:'0'.repeat(64)}),/Integritas/);
 assert.equal(app.count(),0);
 const result=app.send(p);assert.equal(result.attachmentVerified,true);assert.equal(result.attachmentSha256,p.approvalPdfSha256);
 assert.deepEqual(app.messages[0].getAttachments()[0].getBytes(),pdfBytes);
});

test('production uppercase hash helper verifies the PDF and recovers without duplicate mail',()=>{
 const app=setup(false,true),p=payload();assert.equal(app.send(p).code,'uncertain');assert.equal(app.count(),1);app.show();const result=app.send(p);assert.equal(result.sent,true);assert.equal(result.attachmentSha256,p.approvalPdfSha256);assert.equal(app.count(),1);
});
