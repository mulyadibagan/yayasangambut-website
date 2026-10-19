import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../integrations/PayrollNotifications.gs',import.meta.url),'utf8');
const payload=()=>({notificationKey:'payroll:11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222',period:'2026-10',number:'GJ-TEST',total:5400000,approvedAt:'2026-10-19T05:00:00Z',approvedBy:'mulyadi@yayasangambut.org',recipients:['hisamsetiawan@yayasangambut.org','serena@gec.org.my','rienaprasiddha@yayasangambut.org']});
function setup(visible=true){
 const stored=new Map(),messages=[];let count=0;
 const context=vm.createContext({Utilities:{newBlob:s=>({getBytes:()=>Buffer.from(s)}),formatDate:()=> '19/10/2026 12:00:00',sleep(){}},sha256Hex_:b=>createHash('sha256').update(b).digest('hex'),LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>stored.get(k),setProperty:(k,v)=>stored.set(k,v)})},GmailApp:{search:()=>visible&&messages.length?[{getMessages:()=>messages}]:[],sendEmail(to,subject,body){count++;messages.push({getPlainBody:()=>body,getTo:()=>to,getCc:()=>'',getId:()=> 'gmail-test-id'});}}});
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
