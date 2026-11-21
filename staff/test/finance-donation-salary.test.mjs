import test from 'node:test';
import assert from 'node:assert/strict';
import {liveDonationSalary} from '../scripts/finance-donation-salary.mjs';
import {liveSalaryRows,liveSalaryPosition} from '../finance-ui/donation-salary-data.js';
import {transformSync} from 'esbuild';
const fixture=`"use client";
function panel(){
  const [effectiveSalaryStaff,setEffectiveSalaryStaff]=useState([]);
  const policyMonth='2026-11',year=2026,savingData={rows:[]};
  const canonicalSalaryName=name=>name;
  useEffect(()=>{fetch('/finance/payroll/api/report').then(data=>{setEffectiveSalaryStaff(data.staff);});},[]);
  const view=useMemo(()=>{const rows=savingData.rows;return {rows};}, [savingData, year, effectiveSalaryStaff]);
  const later=useMemo(()=>42,[]);
  return <Historical value={later} rows={view.rows}/>;
}`;
test('refreshes original salary inputs without replacing markup or changing hook order',()=>{
 const patched=liveDonationSalary(fixture);
 assert.ok(patched.includes('return <Historical value={later} rows={view.rows}/>;'));
 assert.ok(!patched.includes('DonationSalaryPanel'));assert.equal(liveDonationSalary(patched),patched);
 const js=transformSync(patched.replace(/import \{liveSalaryRows[^\n]*\n/,''),{loader:'tsx',jsxFactory:'jsx',format:'cjs'}).code;
 let hooks=0,states=0,report=null;
 const render=new Function('useState','useMemo','useEffect','jsx','Historical','liveSalaryRows',js+';return panel;')(()=>{hooks++;return [states++===0?report:[],()=>{}];},f=>{hooks++;return f();},()=>{hooks++;},(type,props)=>({type,props}),'original',liveSalaryRows);
 assert.equal(render().type,'original');const before=hooks;hooks=states=0;
 report={sourceAsOf:'2026-11-19',staff:[],issues:[]};assert.equal(render().type,'original');assert.equal(hooks,before);
});
test('applies the donation difference once and preserves historical rows and years',()=>{
 const rows=[{year:2026,staff:'Z',claimAmount:78.2,paidAmount:46.875},{year:2026,staff:'R',carryForward:-14.3565,claimAmount:56.75,paidAmount:60.5}];
 const report={sourceAsOf:'2026-11-19',bookBalance:552.811,generalSaving:322.194,salaryReserve:36.825,issues:[],staff:[{id:'z',name:'Z',opening:0,allocation:83.7,paid:46.875,usage:0,position:36.825},{id:'r',name:'R',opening:-14.3565,allocation:64.75,paid:60.5,usage:0,position:-10.1065}]};
 const result=liveSalaryRows(rows,report,2026);assert.equal(result.length,4);assert.equal(result[2].claimAmount,5.5);assert.equal(result[3].claimAmount,8);
 assert.equal(liveSalaryRows(result,report,2026).length,4);assert.equal(rows.length,2);assert.equal(liveSalaryRows(rows,report,2025),rows);
 assert.equal(liveSalaryPosition({},report,2026).ygAdvance,10.1065);
 assert.equal(liveSalaryRows(rows,{...report,issues:[{}]},2026),rows);
});
