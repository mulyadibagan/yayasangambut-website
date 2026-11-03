import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {taskDocument,documentText} from '../public/letter-content.js';
import {letterDocuments} from '../src/letters-documents.mjs';
import {letterTemplates} from '../src/letter-templates.mjs';
test('SPT uses centered title and number, aligned identities and one-page export',async()=>{
 const body='Yang bertanda tangan di bawah ini:\nNama : Mulyadi\nJabatan : Direktur Yayasan Gambut\n\nDengan ini menugaskan kepada:\nNama : Ainul Azizah\nJabatan : Support Program and Communication Staff\n\nUntuk mengikuti workshop pada:\nHari / Tanggal : Selasa / 3 November 2026\nWaktu : 08.00 - 17.00 WIB\nTempat : Hotel Pangeran Pekanbaru\n\nDemikian Surat Tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.';
 const bodyDoc=taskDocument({body});assert.equal(bodyDoc.blocks.filter(b=>b.type==='table').length,3);assert(documentText(bodyDoc).includes('Ainul Azizah'));
 const rich=taskDocument({bodyFormat:'rich-v1',bodyDoc});assert.deepEqual(rich,bodyDoc);
 const img=readFileSync(new URL('../public/brand/surat-letterhead.png',import.meta.url));const docs=await letterDocuments({status:'draft',data:{date:'2026-11-03',kind:'SPT',subject:'Tugas workshop',body}},img,img);
 const xml=Buffer.from(docs.docx).toString('utf8');assert(xml.includes('SURAT PERINTAH TUGAS'));assert(xml.includes('Nomor: Belum dialokasikan'));assert(!xml.includes('Kepada Yth.'));assert(!xml.includes('Lampiran'));assert(xml.includes('<w:tbl>'));assert.equal((await PDFDocument.load(docs.pdf)).getPageCount(),1);assert(letterTemplates.some(t=>t.id==='spt-v1'&&t.kind==='SPT'));
});
