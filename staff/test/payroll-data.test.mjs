import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv} from 'node:crypto';
import {paymentReport,resolveBank} from '../src/payroll-data.mjs';
import {terbilang,payrollPrint} from '../src/payroll-print.mjs';
import {decryptProfiles,extractSalaryPolicy} from '../scripts/finance-payroll-bridge.mjs';
const source=()=>({asOf:'2026-10-01',policy:{Test:{active:true,monthlySalary:100}},rows:[{year:2026,staff:'Test',expenseDate:'2026-09-01',claimAmount:1000}],entries:[],bank:{account:'test',closing:2000},generalSaving:1000});
const pay=()=>({id:'test',paid_date:'2026-10-02',source_account:'test',amount:100,reference:'REF',allocations:[{staff_id:'staff:test',name:'Test',amount:100}],proof_ids:['proof']});
test('later imported matching mutation and salary row remove the supplement without double counting',()=>{
 const s=source(),p=pay();let report=paymentReport(s,[p]);assert.equal(report.bookBalance,1900);assert.equal(report.salaryReserve,900);
 s.asOf='2026-10-02';s.bank.closing=1900;s.entries.push({index:1,date:p.paid_date,reference:'REF',debit:100,credit:0});s.rows.push({year:2026,staff:'Test',expenseDate:p.paid_date,paidAmount:100});
 report=paymentReport(s,[p]);assert.equal(report.bookBalance,1900);assert.equal(report.salaryReserve,900);assert.equal(report.bankAdditional,0);assert.equal(report.issues.length,0);
});
test('ambiguous or missing historical matches hide uncertain balances; explicit selection resolves ambiguity',()=>{
 const s=source(),p=pay();s.asOf=p.paid_date;s.entries=[{index:1,date:p.paid_date,reference:'REF',debit:100,credit:0},{index:2,date:p.paid_date,reference:'REF',debit:100,credit:0}];
 assert.ok(resolveBank(s,p).issue);let r=paymentReport(s,[p]);assert.equal(r.bookBalance,null);assert.equal(r.salaryReserve,null);assert.equal(r.staff[0].position,null);
 assert.equal(resolveBank(s,{...p,bank_entry_id:'bank:2026:2'}).entry.index,2);
 s.entries=[];assert.ok(resolveBank(s,p).issue);
});
test('private profile package requires correct authenticated encryption key',()=>{
 const key=randomBytes(32),iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),cipher=Buffer.concat([c.update(JSON.stringify({applicant:'Synthetic',profiles:{Test:{account:'000-test'}}})),c.final()]),bytes=Buffer.concat([iv,c.getAuthTag(),cipher]);
 assert.equal(decryptProfiles(bytes,key.toString('hex')).profiles.Test.account,'000-test');assert.throws(()=>decryptProfiles(bytes,randomBytes(32).toString('hex')));bytes[bytes.length-1]^=1;assert.throws(()=>decryptProfiles(bytes,key.toString('hex')));
 assert.deepEqual(extractSalaryPolicy('const STAFF_POLICY: Record<string, object> = {\n "Test": { active: true, monthlySalary: 1_000_000, label: "Active", effectiveFrom: "2026-10-01" },\n};'),{Test:{active:true,monthlySalary:1000000,label:'Active'}});
});
test('print total words, escaping and approval state are derived from stored request',()=>{
 assert.equal(terbilang(30500000).replace(/\s+/g,' ').trim(),'tiga puluh juta lima ratus ribu');
 const r={id:'test',version:1,status:'draft',created_at:'2026-10-01',creator_email:'test',total:100,period:'2026-10',form_meta:{purpose:'<script>alert(1)</script>'},items:[]};
 const html=payrollPrint(r);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Menunggu persetujuan/);
});

test('private bridge uses normalized salary source and integrates both finance views without mutating existing policy',async()=>{
 const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{applyPayrollBridge}=await import('../scripts/finance-payroll-bridge.mjs');
 const root=await mkdtemp(join(tmpdir(),'yg-payroll-bridge-'));
 try{await mkdir(join(root,'app'));const policy='const STAFF_POLICY = {\n "Test": { active: true, monthlySalary: 1_000, label: "Active" },\n};';await writeFile(join(root,'app/salary-balance-enhancer.tsx'),policy+'\nconst staffLabel = (name: string) => name.replace("Test","T");');await writeFile(join(root,'app/finance-archive-dashboard.tsx'),'import ClosingAugustPanel from "./closing";\n      <section className="archive-workspace"><header className="archive-header"><h1>Ringkasan</h1></header>');await writeFile(join(root,'app/reconciliation-workspace.tsx'),'import PendingStaffAllocation from "./pending";\nreturn <main className="recon-workspace" data-tab={tab}>');
 await applyPayrollBridge(root,{applicant:'Test',profiles:{}});const api=await readFile(join(root,'app/api/payroll-source/route.ts'),'utf8');assert.match(api,/salaryRowsThrough\(savings.rows/);assert.match(api,/profiles/);assert.deepEqual(extractSalaryPolicy(await readFile(join(root,'app/salary-balance-enhancer.tsx'),'utf8')),extractSalaryPolicy(policy));assert.match(await readFile(join(root,'app/salary-balance-enhancer.tsx'),'utf8'),/fullStaffNames/);
 for(const name of ['finance-archive-dashboard.tsx','reconciliation-workspace.tsx'])assert.match(await readFile(join(root,'app',name),'utf8'),/<PayrollPaymentsPanel \/>/);
 }finally{await rm(root,{recursive:true,force:true});}
});


test('full team names preserve canonical salary IDs and bank account-holder names',async()=>{
 const {staffKey}=await import('../src/payroll-data.mjs'),{displayStaffName,staffDescription}=await import('../src/payroll-identity.mjs'),{payrollInput}=await import('../src/payroll.mjs');
 assert.equal(staffKey('Ir. Riena Rachmatillah P.'),staffKey('Riena Rachmatillah'));
 assert.equal(staffKey('Ainul Azizah, S.H.'),staffKey('Ainul Azizah'));
 assert.equal(displayStaffName('Riandra Hamdani'),'Riandra Hamdani, S.I.Kom.');
 assert.equal(staffDescription('Gaji a/n Riena Rachmatillah P','Riena Rachmatillah'),'Gaji a/n Ir. Riena Rachmatillah P.');
 const item={name:'Ainul Azizah, S.H.',program:'Saving gaji',base:100,allowance:0,deduction:0,account_name:'AINUL AZIZAH'};
 assert.equal(payrollInput({period:'2026-10',items:[item]}).items[0].account_name,'AINUL AZIZAH');
 assert.throws(()=>payrollInput({period:'2026-10',items:[item,{...item,name:'Ainul Azizah'}]}));
});
