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
