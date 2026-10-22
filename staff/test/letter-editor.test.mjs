import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readEditor} from '../public/letter-editor.js';
import {documentHtml,plainDocument,documentText} from '../public/letter-content.js';
const parse=html=>parseHTML('<!doctype html><html><body>'+html+'</body></html>').document.body;

test('Word paste preserves only permitted inline marks, alignment, indentation and paragraph spacing',()=>{
 const doc=readEditor(parse('<p class="MsoNormal" style="font-weight:bold;text-align:right;margin-left:36pt;margin-bottom:12pt;background:url(https://evil.example)">Dari <i>Word</i> <u>aman</u></p>'));
 const p=doc.blocks[0];assert.equal(p.align,'right');assert.equal(p.indent,2);assert.equal(p.space,12);assert(p.runs.every(r=>r.bold));assert(p.runs.some(r=>r.italic));assert(p.runs.some(r=>r.underline));
 const html=documentHtml(doc);assert(!html.includes('style='));assert(!html.includes('evil.example'));assert(!html.includes('MsoNormal'));
});

test('paste removes active HTML, remote resources, handlers, links, and unapproved CSS',()=>{
 const doc=readEditor(parse('<script>alert(1)</script><style>@import url(https://evil.example);</style><iframe src="https://evil.example"></iframe><svg onload="alert(1)"></svg><p onclick="alert(1)" style="text-align:expression(alert(1))">Aman <a href="javascript:alert(1)">tautan</a><img src="https://evil.example" onerror="alert(1)"></p>'));
 const html=documentHtml(doc);assert.equal(documentText(doc),'Aman tautan');for(const unsafe of ['<script','<style','<iframe','<svg','<img','<a ','onclick','javascript:','expression','evil.example'])assert(!html.includes(unsafe),unsafe);
});

test('Word mso-list paragraphs become editable numbered lists with retained start, alongside bullet lists',()=>{
 const doc=readEditor(parse('<p style="mso-list:l0 level1 lfo1">3. Ketiga</p><p style="mso-list:l0 level1 lfo1">4. Keempat</p><ul><li>Peluru</li></ul>'));
 assert.equal(doc.blocks.length,2);assert.equal(doc.blocks[0].ordered,true);assert.equal(doc.blocks[0].start,3);assert.equal(doc.blocks[0].items.length,2);assert.equal(doc.blocks[0].items[0].runs[0].text,'Ketiga');assert.equal(doc.blocks[1].ordered,false);
});

test('legacy angle brackets stay literal on editor round trip; explicit normal marks cancel inherited Word formatting',()=>{
 const legacy='Teks <b>literal</b> & <script>tidak dieksekusi</script>';const doc=plainDocument(legacy);assert.equal(documentText(readEditor(parse(documentHtml(doc)))),legacy);
 const p=readEditor(parse('<p style="font-weight:bold;font-style:italic">Tebal <span style="font-weight:normal;font-style:normal">normal</span></p>')).blocks[0];assert(p.runs[0].bold&&p.runs[0].italic);assert(!p.runs[1].bold&&!p.runs[1].italic);
});

test('long legacy plain letters open without interpreting markup or exceeding rich paragraph limits',()=>{
 const text=Array.from({length:1000},(_,i)=>'Baris '+i+' <b>literal</b>').join('\n').slice(0,18000);const doc=plainDocument(text);const html=documentHtml(doc);const reopened=readEditor(parse(html));assert.equal(documentText(reopened),text);assert(!html.includes('<b>literal'));
});

test('Word tables retain three column proportions, cell paragraphs and borderless choice',()=>{
 const doc=readEditor(parse('<table border="0"><tr><td width="100"><p><b>Nama</b></p></td><td width="15"><p>:</p></td><td width="385"><p>Mulyadi</p><p>Direktur</p></td></tr></table>'));
 const t=doc.blocks[0];assert.equal(t.border,'none');assert.deepEqual(t.widths,[20,3,77]);assert.equal(t.rows[0].length,3);assert.equal(t.rows[0][2].length,2);assert.equal(t.rows[0][0][0].runs[0].bold,true);assert.deepEqual(readEditor(parse(documentHtml(doc))),doc);
});
