import test from 'node:test';
import assert from 'node:assert/strict';
import {compileHistory,summarize,category,isoDate} from '../scripts/finance-history-policy.mjs';
import {professionalCopy} from '../scripts/finance-presentation.mjs';
import {applyFinancePresentation} from '../scripts/finance-presentation.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('full cash history preserves exact totals, prior years, legitimate repeats and split allocations',()=>{
 const sources=[{year:2025,bank:{openingBalance:100,closingBalance:115.25,mutations:[{date:'15 Jan 2025',description:'Pencairan donor',reference:'A',debit:0,credit:20.25,balance:120.25},{date:'2025-12-30',description:'UM kegiatan',reference:'B',debit:5,credit:0,balance:115.25}]}},{year:2026,bank:{openingBalance:115.25,closingBalance:145.25,mutations:[{archiveIndex:0,postedAt:'2026-01-02',description:'Donasi staf',reference:'C',debit:0,credit:40,balance:155.25},{archiveIndex:1,postedAt:'2026-01-03',description:'Gaji',reference:'D',debit:5,credit:0,balance:150.25},{archiveIndex:2,postedAt:'2026-01-03',description:'Gaji',reference:'D',debit:5,credit:0,balance:145.25}]}}];
 const closing={entries:[{index:0,debit:0,credit:40,allocations:[{bucket:'STAFF',amount:25},{bucket:'YG',amount:15}]}]};
 const before=JSON.stringify({sources,closing}),report=compileHistory(sources,closing);
 assert.equal(JSON.stringify({sources,closing}),before);assert.equal(report.rows.length,6);assert.equal(report.coverage.length,2);
 assert.equal(report.coverage[0].difference,0);assert.equal(report.coverage[1].difference,0);assert.equal(report.coverage[1].carryDifference,0);
 for(const group of ['project','category','year','month']){const out=summarize(report.rows,group);assert.equal(out.reduce((n,r)=>n+r.incoming,0),6025);assert.equal(out.reduce((n,r)=>n+r.outgoing,0),1500);}
 assert.equal(summarize(report.rows,'year').reduce((n,r)=>n+r.count,0),5);
 assert.throws(()=>compileHistory([...sources,sources[0]],closing),/duplicated/);
 const invalid=structuredClone(closing);invalid.entries[0].credit=39;assert.throws(()=>compileHistory(sources,invalid),/link mismatch/);
});
test('internal reallocation is never counted as additional cash',()=>{
 const report=compileHistory([{year:2026,bank:{openingBalance:0,closingBalance:10,mutations:[{date:'2026-01-01',description:'Sisa UM',debit:0,credit:10,balance:10}]}}],{entries:[{index:0,debit:0,credit:10,allocations:[{bucket:'YG',amount:30},{bucket:'STAFF',amount:-20}]}]});
 assert.equal(report.rows.length,1);assert.equal(report.rows[0].credit,1000);assert.equal(report.rows[0].category,'Pengembalian uang muka');
});
test('uncertain classification remains explicit; cash receipts are not all donor income',()=>{
 assert.equal(category({credit:10,description:'Donasi ARC3'}),'Donasi');
 assert.equal(category({credit:10,description:'Angsuran tahap 8'}),'Pelunasan piutang');
 assert.equal(category({credit:10,description:'Bunga bank'}),'Bunga bank');
 assert.equal(category({credit:10,description:'Tidak jelas'}),'Penerimaan lain / perlu klasifikasi');
 assert.equal(category({debit:10,description:'Tarik tunai gaji dan peralatan kantor'}),'Pengeluaran gabungan');
 assert.equal(isoDate('13 November 2026'),'2026-11-13');assert.throws(()=>isoDate('yesterday'));
});
test('undated legacy rows remain in cash totals without an invented date',()=>{
 const legacy={year:2022,allowUncertainDates:true,bank:{openingBalance:0,closingBalance:25,mutations:[{date:'tanggal tidak terbaca',description:'Pencairan',debit:0,credit:25,balance:25}]}};
 const report=compileHistory([legacy]);assert.equal(report.rows.length,1);assert.equal(report.rows[0].date,'');assert.equal(report.rows[0].rawDate,'tanggal tidak terbaca');assert.equal(report.coverage[0].incoming,2500);assert.equal(report.coverage[0].uncertainDates,1);
 assert.throws(()=>compileHistory([{...legacy,allowUncertainDates:false}]));assert.throws(()=>isoDate('2022-02-31'));
 assert.equal(isoDate('13/11/2026'),'2026-11-13');
});
test('presentation changes preserve numerical expressions and financial identifiers',()=>{
 const source='<button>Cashflow Project</button><p>Belum dilaporkan ke Riena</p><strong>{idr(view.projectedMonthlyPayroll)}</strong>';const changed=professionalCopy(source);
 assert.ok(changed.includes('Arus Kas Proyek'));assert.ok(changed.includes('Bagian Keuangan'));assert.ok(changed.includes('{idr(view.projectedMonthlyPayroll)}'));assert.equal(professionalCopy(changed),changed);
});
test('presentation/report generation leaves source data byte-for-byte intact',async()=>{
 const root=await mkdtemp(join(tmpdir(),'yg-history-'));
 try{
  const app=join(root,'app');await mkdir(app);await writeFile(join(root,'package.json'),'{"type":"module"}');
  const bank=year=>`export const bankStatement${year}={openingBalance:1,closingBalance:2,mutations:[{date:'${year}-01-01',description:'test',debit:0,credit:1,balance:2}]};`;
  const ledger='{"entries":[],"unchanged":true}',policy='export const STAFF_POLICY={active:true,monthlySalary:123};';
  for(const [p,s] of Object.entries({'multi-year-source.json':JSON.stringify({years:[{year:2022,rows:[{opening:true,balance:0},{date:'2022-01-01',description:'test',incoming:1,outgoing:0,balance:1}]},{year:2025,rows:[{opening:true,balance:1},{date:'2025-01-01',description:'test',incoming:1,outgoing:0,balance:2}]}]}),'multi-year-reconciliation.js':'export const rowProjectKey=(year,row)=>row.project||"Belum dialokasikan";','bank-statement-2026.js':bank(2026),'closing-august-2026.json':ledger,'policy.ts':policy,'finance-staff-tools.tsx':'export default ()=> <nav><div><a href="/finance/invoices">Invoice</a></div></nav>;','finance-archive-dashboard.tsx':"import PayrollPaymentsPanel from './payroll-payments-panel';\nexport default ()=> <main><PayrollPaymentsPanel /><a id=\"finance-invoice-entry\" href=\"/finance/invoices\">Invoice</a><h1>Cashflow Project</h1></main>;",'salary-balance-enhancer.tsx':"import PendingStaffAllocation from './pending';\nexport default ()=> <main><PendingStaffAllocation /></main>;"}))await writeFile(join(app,p),s);
  await applyFinancePresentation(root);
  assert.equal(await readFile(join(app,'closing-august-2026.json'),'utf8'),ledger);assert.equal(await readFile(join(app,'policy.ts'),'utf8'),policy);
  assert.equal(await readFile(join(app,'bank-statement-2026.js'),'utf8'),bank(2026));
  assert.equal(JSON.parse(await readFile(join(app,'multi-year-source.json'),'utf8')).years[0].rows.length,2);
  const output=JSON.parse(await readFile(join(app,'finance-history.json'),'utf8'));assert.equal(output.rows.length,3);assert.equal(output.from,'2022-01-01');
  const page=await readFile(join(app,'finance-archive-dashboard.tsx'),'utf8');assert.ok(!page.includes('PayrollPaymentsPanel'));assert.ok(!page.includes('finance-invoice-entry'));assert.ok(page.includes('Arus Kas Proyek'));
  assert.ok((await readFile(join(app,'salary-balance-enhancer.tsx'),'utf8')).includes('<PayrollPaymentsPanel />'));
 }finally{await rm(root,{recursive:true,force:true});}
});
