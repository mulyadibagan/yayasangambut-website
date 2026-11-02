import test from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {integrateAdditionalSalaryRows} from '../scripts/finance-salary-list.mjs';
const fixture=`import { useMemo } from "react";
const STAFF_POLICY={Alpha:{active:true,monthlySalary:10,label:'Active'},Beta:{active:true,monthlySalary:20,label:'Active'}};
const staffLabel=name=>name;
const policyFor=staff=>STAFF_POLICY[staff]||{active:false,monthlySalary:null,label:'Unknown'};
function panel(savingData,year){
  const view = useMemo(() => {
    const rows=savingData.rows;
    const names = [...new Set(rows.map((row) => row.staff))];
    const totals=names.map(staff=>{const policy = policyFor(staff);return {staff,...policy};});
    const currentMonthlyPayroll = totals.reduce((sum, row) => sum + (row.active ? row.monthlySalary ?? 0 : 0), 0);
    const projectedMonthlyPayroll = totals.reduce((sum, row) => sum + (row.monthlySalary ?? 0), 0);
    return {totals,monthlyPayroll:currentMonthlyPayroll,targetNeed:projectedMonthlyPayroll*13};
  }, [savingData, year]);
  return view;
}
const markup=\`    <PendingStaffAllocation /><span>Kebutuhan 5 orang / bulan</span><small>Seluruh staf sudah aktif</small>\`;
`;
test('effective live staff contribute once to monthly payroll and 13-month reserve',()=>{
 const source=integrateAdditionalSalaryRows(fixture);
 assert.equal(integrateAdditionalSalaryRows(source),source);
 const executable=stripTypeScriptTypes(source).replace('import { useEffect, useMemo, useState } from "react";','const useMemo=f=>f(),useEffect=()=>{},useState=()=>[live,()=>{}];');
 const calculate=new Function('live',executable+';return panel({rows:[{staff:"Alpha"},{staff:"Alpha"},{staff:"Beta"}]},2026);');
 const base=[{name:'Alpha',active:true,monthlySalary:10},{name:'Beta',active:true,monthlySalary:20}];
 const pending=[{name:'Gamma',active:false,monthlySalary:6,effectiveMonth:'2026-11'},{name:'Delta',active:false,monthlySalary:3,effectiveMonth:'2026-11'}];
 const before=calculate([...base,...pending]);assert.equal(before.monthlyPayroll,30);assert.equal(before.targetNeed,390);
 const after=calculate([...base,...pending.map(s=>({...s,active:true}))]);assert.equal(after.totals.length,4);assert.equal(after.monthlyPayroll,39);assert.equal(after.targetNeed,507);
 assert.throws(()=>integrateAdditionalSalaryRows('unrelated'),/anchor changed/);
});
