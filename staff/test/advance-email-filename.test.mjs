import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../public/advances.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('function umReviewDraft(row){'),source.indexOf('async function act(action)'));
test('UM email draft uses the same project number and filename as the download',()=>{
 const context=vm.createContext({URL,URLSearchParams,me:{email:'mulyadi@yayasangambut.org'},location:{origin:'https://staff.yayasangambut.org'},money:n=>'Rp '+n});
 vm.runInContext(fn,context);
 const row={id:'id',number:'UM-2026-00006',document_number:'02 YG-APRDYN',download_filename:'02_UM_YG-APRDYN_1.2-Targeted-Coaching-1.xlsx',creator_name:'Mulyadi',total:46350000,payload:{activity:'Targeted Coaching 1',start:'2026-11-25',end:'2026-11-27',location:'Dayun'}};
 const url=new URL(context.umReviewDraft(row));assert.match(url.searchParams.get('su'),/^Pengajuan UM 02 YG-APRDYN/);
 assert.ok(url.searchParams.get('body').includes(row.download_filename));assert.ok(!url.searchParams.get('body').includes('UM-2026-00006'));
 assert.match(new URL(context.umReviewDraft({...row,document_number:undefined,download_filename:undefined})).searchParams.get('su'),/UM-2026-00006/);
});
