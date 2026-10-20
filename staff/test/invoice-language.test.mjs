import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {invoiceLanguage} from '../src/invoice-language.mjs';
import {invoiceSeed,invoiceInput} from '../src/invoice-model.mjs';
import {invoicePrint} from '../src/invoice-print.mjs';
import {invoicePdf} from '../src/invoice-pdf.mjs';
test('Indonesian and English invoices use their own labels, dates, money and words while preserving financial values',async()=>{
 const id=invoiceLanguage({language:'id'}),en=invoiceLanguage({language:'en'});
 assert.equal(id.money(199200000),'199.200.000');assert.equal(en.money(199200000),'199,200,000');assert.equal(id.date('2026-10-20'),'20 Oktober 2026');assert.equal(en.date('2026-10-20'),'20 October 2026');
 assert.equal(en.words(199200000),'one hundred ninety-nine million two hundred thousand Indonesian rupiah.');assert.equal(en.words(0),'zero Indonesian rupiah.');assert.equal(en.words(1000000000000),'one trillion Indonesian rupiah.');assert.ok(id.words(199200000).includes('sembilan puluh sembilan juta'));
 for(const language of ['id','en']){
  const v=invoiceInput({...invoiceSeed,language,description:language==='en'?'Contract instalment payment.':'Pembayaran termin kontrak.'}),r={id:'test',number:'10/YG-RAPP/26',status:'draft',...v};
  assert.equal(v.amount,199200000);assert.equal(v.total,199200000);assert.equal(v.data.language,language);
  const html=invoicePrint(r);assert.ok(html.includes('lang="'+language+'"'));assert.ok(html.includes(language==='en'?'Please make payment to:':'Pembayaran kepada:'));assert.ok(html.includes(language==='en'?'Yours faithfully,':'Hormat kami,'));assert.ok(html.includes(language==='en'?'DRAFT - NOT ISSUED':'DRAFT - BELUM DITERBITKAN'));assert.ok(html.includes(language==='en'?'Director':'Direktur'));
  const pdf=await PDFDocument.load(await invoicePdf(r));assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getWidth()-595.28)<.01);
 }
 assert.equal(invoiceInput({...invoiceSeed,language:undefined}).data.language,'id');assert.throws(()=>invoiceInput({...invoiceSeed,language:'other'}));
});


test('USD and SGD render their own table headings, two decimals and cents while the payment account stays IDR',async()=>{
 for(const currency of ['USD','SGD'])for(const language of ['id','en']){
 const v=invoiceInput({...invoiceSeed,currency,language,contract_amount:12500.25,percentage:40,bank:'Bank Mandiri',account:'123456789',account_name:'Yayasan Gambut'}),r={id:'local',number:'10/YG-TEST/26',status:'draft',...v},L=invoiceLanguage(v.data),html=invoicePrint(r);
 assert.equal(v.amount,500010);assert.equal(v.total,500010);assert.equal(v.data.contract_amount,12500.25);assert.equal(L.money(v.total),language==='en'?'5,000.10':'5.000,10');assert.ok(L.words(v.total).includes(language==='en'?'ten cents':'sepuluh sen'));assert.ok(L.words(v.total).includes(currency==='USD'?(language==='en'?'US dollars':'dolar Amerika Serikat'):(language==='en'?'Singapore dollars':'dolar Singapura')));assert.ok(html.includes('TOTAL ('+currency+')'));assert.ok(html.includes('A/c No: 123456789 (IDR)'));assert.equal((await PDFDocument.load(await invoicePdf(r))).getPageCount(),1);
 }
 assert.equal(invoiceLanguage({currency:'USD',language:'en'}).words(101),'one US dollar and one cent.');assert.equal(invoiceLanguage({currency:'SGD',language:'id'}).words(1),'nol dolar Singapura dan satu sen.');
});
test('currency amounts use integer minor units and explicit half-up cent rounding without exchange conversion',()=>{
 assert.equal(invoiceInput({...invoiceSeed,currency:undefined}).data.currency,'IDR');
 for(const currency of ['USD','SGD']){
  assert.equal(invoiceInput({...invoiceSeed,currency,contract_amount:10.01,percentage:33.33}).amount,334);
  assert.equal(invoiceInput({...invoiceSeed,currency,contract_amount:0.05,percentage:50}).amount,3);
  assert.equal(invoiceInput({...invoiceSeed,currency,contract_amount:100.25,percentage:100,tax_status:'pkp',tax_mode:'added',vat:1.25,withholding:0.5}).total,10100);
  assert.throws(()=>invoiceInput({...invoiceSeed,currency,contract_amount:1.001}));
 }
 assert.throws(()=>invoiceInput({...invoiceSeed,currency:'EUR'}));assert.throws(()=>invoiceInput({...invoiceSeed,currency:'IDR',contract_amount:10.01}));assert.throws(()=>invoiceInput({...invoiceSeed,currency:'USD',percentage:33.333}));
});
