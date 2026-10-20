import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceBankDefaults,invoiceBankRoute,invoiceBankLines} from '../src/invoice-bank.mjs';
import {invoiceInput,invoiceSeed} from '../src/invoice-model.mjs';
import {invoicePrint} from '../src/invoice-print.mjs';
const origin='https://staff.yayasangambut.org',director={role:'admin',email:'mulyadi@yayasangambut.org'},data={account_name:'Yayasan uji',bank:'Bank uji',bank_address:'Alamat bank uji',swift:'TESTIDJA',account:'0001234567'};
test('private bank defaults require Director, valid Origin and valid fields; stored defaults cannot overwrite existing settings',async()=>{
 const objects=new Map(),env={APP_ORIGIN:origin,MEDIA:{async get(k){const value=objects.get(k);return value?{async arrayBuffer(){return new TextEncoder().encode(value).buffer;}}:null;},async put(k,v,o){assert.equal(o.onlyIf.get('If-None-Match'),'*');if(objects.has(k))return null;objects.set(k,v);return {};}}};
 const request=(value=data,site=origin)=>new Request(origin+'/finance/invoices/bank-settings/api',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(value)}),payload=r=>r.json();
 assert.deepEqual(await invoiceBankDefaults(env),{});
 await assert.rejects(()=>invoiceBankRoute(request(),env,{role:'staff',email:'finance@example.org'},payload),e=>e.status===403);
 await assert.rejects(()=>invoiceBankRoute(request(data,'https://evil.example'),env,director,payload),e=>e.status===403);
 await assert.rejects(()=>invoiceBankRoute(request({...data,account:'invalid'}),env,director,payload),e=>e.status===400);
 assert.equal((await invoiceBankRoute(request(),env,director,payload)).status,201);assert.deepEqual(await invoiceBankDefaults(env),data);
 await assert.rejects(()=>invoiceBankRoute(request(),env,director,payload),e=>e.status===409);assert.equal(objects.size,1);
 assert.equal(invoiceSeed.account,'');const newInvoice=invoiceInput({...invoiceSeed,...await invoiceBankDefaults(env)});assert.equal(newInvoice.data.account,'0001234567');
 const legacy=invoiceInput({...invoiceSeed,bank_address:undefined,swift:undefined});assert.equal(legacy.data.account,'');assert.equal(legacy.data.swift,'');
 const html=invoicePrint({id:'local',number:'CONTOH',status:'draft',data:newInvoice.data,amount:newInvoice.amount,total:newInvoice.total});for(const line of invoiceBankLines(data))assert.ok(html.includes(line));
});
