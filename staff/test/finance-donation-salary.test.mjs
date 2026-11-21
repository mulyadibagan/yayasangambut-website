import test from 'node:test';
import assert from 'node:assert/strict';
import {liveDonationSalary} from '../scripts/finance-donation-salary.mjs';
import {transformSync} from 'esbuild';
test('live salary display reads the same payment report and keeps the historical fallback',()=>{
 const fixture=`"use client";
 function panel(){
  const [effectiveSalaryStaff,setEffectiveSalaryStaff]=useState([]);
  useEffect(()=>{fetch('/finance/payroll/api/report').then(data=>{setEffectiveSalaryStaff(data.staff);});},[]);
  const view=useMemo(()=>{return {};}, [savingData, year, effectiveSalaryStaff]);
  return <Historical />;
 }`;
 const patched=liveDonationSalary(fixture);assert.ok(patched.startsWith('"use client";'));assert.ok(patched.includes('setLiveDonationReport(data)'));assert.ok(patched.includes('? <DonationSalaryPanel'));assert.ok(patched.includes(': (<Historical />)'));assert.equal(liveDonationSalary(patched),patched);
 assert.throws(()=>liveDonationSalary('unrelated'),/anchor changed/);
});
test('async donation arrival executes every original hook before switching the rendered salary table',()=>{
 const fixture=`"use client";
 function panel(){
  const [effectiveSalaryStaff,setEffectiveSalaryStaff]=useState([]);
  const policyMonth='2026-11',year=2026,savingData={};
  useEffect(()=>{fetch('/finance/payroll/api/report').then(data=>{setEffectiveSalaryStaff(data.staff);});},[]);
  const view=useMemo(()=>{return {};}, [savingData, year, effectiveSalaryStaff]);
  const later=useMemo(()=>42,[]);
  return <Historical value={later}/>;
 }`;
 const patched=liveDonationSalary(fixture).replace(/import DonationSalaryPanel[^\n]*\n/,'');
 const js=transformSync(patched,{loader:'tsx',jsxFactory:'jsx',format:'cjs'}).code;
 let hooks=0,stateCalls=0,live=null;
 const useState=v=>{hooks++;const i=stateCalls++;return [i===0?live:v,()=>{}];},useMemo=f=>{hooks++;return f();},useEffect=()=>{hooks++;};
 const render=new Function('useState','useMemo','useEffect','jsx','DonationSalaryPanel','Historical',js+';return panel;')(useState,useMemo,useEffect,(type,props)=>({type,props}),'live','historical');
 assert.equal(render().type,'historical');const before=hooks;
 hooks=0;stateCalls=0;live={donations:[{id:'one'}],staff:[]};assert.equal(render().type,'live');assert.equal(hooks,before);assert.equal(hooks,6);
});
