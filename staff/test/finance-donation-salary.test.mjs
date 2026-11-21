import test from 'node:test';
import assert from 'node:assert/strict';
import {liveDonationSalary} from '../scripts/finance-donation-salary.mjs';
test('live salary display reads the same payment report and keeps the historical fallback',()=>{
 const fixture=`"use client";
 function panel(){
  const [effectiveSalaryStaff,setEffectiveSalaryStaff]=useState([]);
  useEffect(()=>{fetch('/finance/payroll/api/report').then(data=>{setEffectiveSalaryStaff(data.staff);});},[]);
  const view=useMemo(()=>{return {};}, [savingData, year, effectiveSalaryStaff]);
  return <Historical />;
 }`;
 const patched=liveDonationSalary(fixture);assert.ok(patched.startsWith('"use client";'));assert.ok(patched.includes('setLiveDonationReport(data)'));assert.ok(patched.includes('return <DonationSalaryPanel'));assert.ok(patched.includes('return <Historical />'));assert.equal(liveDonationSalary(patched),patched);
 assert.throws(()=>liveDonationSalary('unrelated'),/anchor changed/);
});
