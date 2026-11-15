import test from 'node:test';
import assert from 'node:assert/strict';
import {aprilCashEntry} from '../scripts/finance-april-cash.mjs';
import {aprilCash} from '../finance-ui/april-cash-policy.js';
test('APRIL entry belongs to project cashflow with selector navigation and preserves client directive',()=>{
 const source=`'use client';import {useState} from 'react';export default function Page(){return <section><h2>Proyek {year}</h2><label>Pilih proyek<select value={p} onChange={e=>setP(e.target.value)}>{projects.map(p=><option key={p.id}>{p.name}</option>)}</select></label></section>}`;
 const out=aprilCashEntry(source);assert.ok(out.startsWith("'use client';"));assert.ok(out.includes('<AprilCashflow compact />'));assert.ok(out.includes('<option value="__APRIL">APRIL Dayun</option>'));assert.ok(out.includes("window.location.assign('/finance/projects/april-dayun')"));assert.ok(out.includes('onChange={e=>setP(e.target.value)}'));assert.equal(aprilCashEntry(out),out);assert.throws(()=>aprilCashEntry('<section/>'));
});
test('cash uses allocated APRIL bank rows only, preserves real repeated transfers, excludes budgets and other projects',()=>{
 const rows=[{id:'a',project:'APRIL Dayun',year:2026,credit:10000,debit:0},{id:'b',project:'APRIL Group',year:2026,credit:0,debit:2500},{id:'c',project:'ARC3',year:2026,credit:50000,debit:0},{id:'d',project:'APRIL Dayun',year:2027,credit:0,debit:2500}];
 const snapshot=JSON.stringify(rows),r=aprilCash(rows);assert.equal(r.incoming,10000);assert.equal(r.outgoing,5000);assert.equal(aprilCash(rows,2026).outgoing,2500);assert.equal(JSON.stringify(rows),snapshot);assert.equal(aprilCash([]).incoming,0);
});
